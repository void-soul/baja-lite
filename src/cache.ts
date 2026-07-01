import { DBType } from 'baja-lite-field';
import { sleep } from './fn.js';
import { Throw } from './error.js';
import {
    _dao,
    _EventBus,
    _GlobalSqlOption,
    _LoggerService,
    _memCache,
    _memInflight,
    _primaryDB,
} from './const/symbols.js';
import { LoggerService } from './logger.js';
import { StorageType } from './const/index.js';

/** @internal 输出缓存分类日志（仅当 setLogLevels 包含 'cache' 时生效） */
function cacheLog(message: string, ...params: any[]) {
    const logger = globalThis[_LoggerService]! as LoggerService;
    // pino-pretty 的 messageFormat 会根据 level=24 自动添加 [CACHE] 前缀
    (logger as any).debugCategory?.('cache', message, ...params);
}

/**
 * @internal 全局 stale 刷新 Promise 映射。
 *  key = 缓存 key（不含前缀），value = 正在进行的 stale 刷新 Promise。
 * @MethodCache 内部的 staleBackgroundRefresh 通过这个映射注册刷新 Promise，
 * 同一 key 的并发 stale 命中复用同一个 Promise，避免重复执行 fn()。
 * Redis 后端下此映射是每个进程本地的；但因为 [cache-sf]key 在 Redis 里全局可见，
 * 所以跨进程的 single-flight 仍然有效。
 */
const globalStaleInflight = new Map<string, Promise<any>>();

/**
 * @internal [cache] 前缀下的子 key 命名全部收拢到这里，避免散落在各处 magic string。
 *
 * 命名规范：
 * - [cache]key                    缓存值（JSON: { v, d, s } — v=版本 d=数据 s=是否 stale）
 * - [cache-sf]key                 single-flight 首飞标记（SETNX 抢锁用）
 * - [cache-meta]key               stale-allowed 标记（带 TTL，与缓存同生命周期）
 * - [cache-parent]key / [cache-child]key   关联清除的 parent↔child 双向 set
 */
const CacheKey = {
    value:       (k: string) => `[cache]${k}`,
    sf:          (k: string) => `[cache-sf]${k}`,
    meta:        (k: string) => `[cache-meta]${k}`,
    parent:      (k: string) => `[cache-parent]${k}`,
    child:       (k: string) => `[cache-child]${k}`,
} as const;

/**
 * @internal 统一缓存值格式。
 *  - t: timestamp，写入时的毫秒时间戳。用于观测（debug 日志），不影响逻辑。
 *  - d: data，业务数据的 JSON 序列化字符串。
 *  - s: stale 标志。1 = 已过期但保留旧值（stale 窗口内）；不存在 = 新鲜。
 *  - sa: staleAllowed 标志。1 = 该 key 配置了 StaleWhileRevalidate，clear 时保留旧值。
 *
 * 好处：
 * 1. 一次读取拿到全部信息（值 + 是否 stale + 是否允许 stale），热路径 1 次 IO。
 * 2. staleAllowed 与缓存同生命周期，无需外部 registry，clear 时自动判断。
 * 3. t 用时间戳，无需先读取旧值。
 */
interface CacheValue {
    t: number;
    d: string;
    s?: 1;
    sa?: 1;   // 标记该 key 是否配置了 StaleWhileRevalidate
}

/** @internal 序列化缓存值 */
function serializeCacheValue(data: string, timestamp: number, stale = false, staleAllowed = false): string {
    const v: CacheValue = { t: timestamp, d: data };
    if (stale) v.s = 1;
    if (staleAllowed) v.sa = 1;
    return JSON.stringify(v);
}

/** @internal 反序列化缓存值 */
function deserializeCacheValue(raw: string): CacheValue & { isNullish: boolean } {
    try {
        const v = JSON.parse(raw) as CacheValue;
        return { ...v, isNullish: v.d === 'null' || v.d === 'undefined' };
    } catch {
        // 旧格式兼容：纯字符串（无 JSON 包装）
        return { t: 0, d: raw, isNullish: raw === 'null' || raw === 'undefined' };
    }
}

/**
 * @internal 统一的 stale-allowed 注册表 key。
 * 用带 TTL 的 string（而非全局 set），每个 stale-allowed 缓存独立管理自己的标记。
 * key = [cache-meta]realKey，value = '1'，TTL = 缓存 TTL。
 * 好处：自动过期，不再需要全局 set，内存占用与缓存数量而非请求数量成正比。
 */

/**
 * 缓存被清理时的行为策略。
 * 由 @MethodCache 的 `staleMode` 配置决定，clearMethodCache 依此自动选择清理方式。
 */
export enum CacheStaleMode {
    /**
     * 默认。清理时直接删除缓存值，下次请求触发 single-flight 重建。
     * 优点：数据强一致，不会读到旧值。
     * 缺点：重建期间所有请求被阻塞，直到 fn() 执行完毕。
     */
    Purge,
    /**
     * 清理时保留旧值并标记为过期（stale），同时设一个 stale 窗口（默认 30s）。
     * 窗口内：请求仍读到旧值（零阻塞），同时后台 single-flight 异步刷新。
     * 窗口过后：stale 标记自动消失，退化回 Purge 行为。
     *
     * 适用场景：读多写少、能容忍秒级旧数据、fn() 执行代价高。
     * 注意：开启后业务层可能收到乱序数据，需自行处理（如按时间戳丢弃过期包）。
     */
    StaleWhileRevalidate,
}

export function getRedisDB<T = any>(db?: string): T {
    const rd = globalThis[_dao][DBType.Redis][db ?? _primaryDB];
    Throw.if(!rd, 'not found redis!');
    return rd as T;
}
/**
 redlock —— 用 redlock 做一把元锁（[lockex]key），把"读 count、判断 count、incr"做成原子操作。
 原实现失败时 `return await GetRedisLock(...)` 递归调用自己，redis 长时间不可用会栈溢出；
 改成循环 + 指数退避 + 最大重试上限，达到上限后抛出（让上层决定是否走降级路径）。
 */
const GET_REDIS_LOCK_MAX_RETRIES = 10;
const GET_REDIS_LOCK_BASE_DELAY = 50;  // 毫秒
export async function GetRedisLock(key: string, lockMaxActive?: number): Promise<boolean> {
    const lock = globalThis[_dao][DBType.RedisLock];
    Throw.if(!lock, 'not found lock!');
    const db = getRedisDB();
    let lastError: any;
    for (let attempt = 0; attempt < GET_REDIS_LOCK_MAX_RETRIES; attempt++) {
        let initLock: any;
        try {
            initLock = await lock.acquire([`[lockex]${key}`], 5000);
            const count = await db.get(key);
            if (count === null || parseInt(count) < (lockMaxActive ?? 1)) {
                await db.incr(key);
                return true;
            } else {
                return false;
            }
        } catch (er: any) {
            lastError = er;
            // 指数退避，避免 redis 抖动时打死服务
            const delay = Math.min(GET_REDIS_LOCK_BASE_DELAY * Math.pow(2, attempt), 1000);
            (globalThis[_LoggerService]! as any).debugCategory?.('sql', `GetRedisLock ${key} attempt ${attempt + 1} failed: ${er?.message}, retry after ${delay}ms`);
            await sleep(delay);
        } finally {
            if (initLock) {
                try {
                    await initLock.release();
                    // eslint-disable-next-line no-empty
                } catch (error: any) {
                }
            }
        }
    }
    throw new Error(`GetRedisLock ${key} failed after ${GET_REDIS_LOCK_MAX_RETRIES} retries: ${lastError?.message ?? lastError}`);
};
/** 对FN加锁、缓存执行 */
export async function excuteWithLock<T>(config: {
    /** 返回缓存key,参数=方法的参数+当前用户对象，可以用来清空缓存。 */
    key: ((...args: any[]) => string) | string;
    /** 被锁定线程是否sleep直到解锁为止? 默认true */
    lockWait?: boolean;
    /** 当设置了lockWait=true时，等待多少【毫秒】进行一次锁查询? 默认：100MS */
    lockRetryInterval?: number;
    /** 当设置了lockWait=true时，等待多少【毫秒】即视为超时，放弃本次访问？默认：永不放弃 */
    lockMaxWaitTime?: number;
    /** 错误信息 */
    errorMessage?: string;
    /** 允许的并发数，默认：1 */
    lockMaxActive?: number;
    /** 单个锁多少【毫秒】后自动释放?默认：60*1000MS  */
    lockMaxTime?: number;
}, fn__: () => Promise<T>): Promise<T> {
    const key = `[lock]${typeof config.key === 'function' ? config.key() : config.key}`;
    const db = getRedisDB();
    let wait_time = 0;
    const fn = async () => {
        const lock = await GetRedisLock(key, config.lockMaxActive);
        if (lock === false) {
            if (config.lockWait !== false && ((config.lockMaxWaitTime ?? 0) === 0 || (wait_time + (config.lockRetryInterval ?? 100)) <= (config.lockMaxWaitTime ?? 0))) {
                (globalThis[_LoggerService]! as any).debugCategory?.('sql', `get lock ${key} fail, retry after ${config.lockRetryInterval ?? 100}ms...`);
                await sleep(config.lockRetryInterval ?? 100);
                wait_time += (config.lockRetryInterval ?? 100);
                return await fn();
            } else {
                (globalThis[_LoggerService]! as any).debugCategory?.('sql', `get lock ${key} fail`);
                throw new Error(config.errorMessage || `get lock fail: ${key}`);
            }
        } else {
            (globalThis[_LoggerService]! as any).debugCategory?.('sql', `get lock ${key} ok!`);
            await db.pexpire(key, config.lockMaxTime ?? 60000);
            try {
                return await fn__();
            } finally {
                (globalThis[_LoggerService]! as any).debugCategory?.('sql', `unlock ${key} ok!`);
                await db.decr(key);
            }
        }
    };
    return await fn();
}
/**
 * 方法加锁装饰器。
 * 与 `MethodCache` 组合时，**不要**手工叠装饰器——`MethodCache` 内部已经实现了
 * "先查缓存 → miss 才加锁 → 锁内二次检查 → 仍 miss 才执行" 的 single-flight 语义，
 * 直接给方法加 `@MethodCache` 即可。`@MethodLock` 单独使用时仅做并发互斥，不感知缓存。
 */
export function MethodLock<T = any>(config: {
    /** 返回缓存key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来清空缓存。 */
    key: ((this: T, ...args: any[]) => string) | string;
    /** 被锁定线程是否sleep直到解锁为止? 默认true */
    lockWait?: boolean;
    /** 当设置了lockWait=true时，等待多少【毫秒】进行一次锁查询? 默认100ms */
    lockRetryInterval?: number;
    /** 当设置了lockWait=true时，等待多少【毫秒】即视为超时，放弃本次访问？默认永不放弃 */
    lockMaxWaitTime?: number;
    /** 错误信息 */
    errorMessage?: string;
    /** 允许的并发数，默认=1 */
    lockMaxActive?: number;
    /** 单个锁多少【毫秒】后自动释放?即时任务没有执行完毕或者没有主动释放锁?  */
    lockMaxTime?: number;
}) {
    return function (target: T, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn__ = descriptor.value;
        descriptor.value = async function (this: any, ...args: any[]) {
            // 注意：装饰器闭包里的 `config` 是所有调用共享的同一个对象，
            // 不能把 per-call 的状态写回去——必须每次构造一份新的 config 传给 excuteWithLock。
            const resolvedKey = typeof config.key === 'function' ? config.key.call(this, ...args) : config.key;
            const perCallConfig = { ...config, key: resolvedKey };
            return await excuteWithLock(perCallConfig, async () => await fn__.call(this, ...args));
        };
    };
}

/**
 * 内存 LRU 条目，存储格式与 Redis 一致（CacheValue）。
 * `expiresAt = 0` 表示永不过期。
 */
interface MemCacheEntry {
    /** 缓存值信息（与 Redis 端 CacheValue 格式一致） */
    cache: CacheValue;
    /** 毫秒时间戳。0 表示永不过期。 */
    expiresAt: number;
}

/** @internal 从 MemCacheEntry 获取实际数据（解析 JSON） */
function memGetValue(entry: MemCacheEntry): any {
    return JSON.parse(entry.cache.d);
}

/** @internal 判断 MemCacheEntry 是否处于 stale 窗口 */
function memIsStale(entry: MemCacheEntry): boolean {
    return entry.cache.s === 1;
}

/** 全局 LRU 上限。可在 boot 时通过 `globalThis[_GlobalSqlOption].memCacheMaxSize` 覆盖。 */
const MEMORY_CACHE_DEFAULT_MAX_SIZE = 10_000;

function getMemCache(): Map<string, MemCacheEntry> {
    let m = globalThis[_memCache] as Map<string, MemCacheEntry> | undefined;
    if (!m) {
        m = new Map();
        globalThis[_memCache] = m;
    }
    return m;
}
function getMemInflight(): Map<string, Promise<any>> {
    let m = globalThis[_memInflight] as Map<string, Promise<any>> | undefined;
    if (!m) {
        m = new Map();
        globalThis[_memInflight] = m;
    }
    return m;
}
function getMemCacheMaxSize(): number {
    return (globalThis[_GlobalSqlOption]?.memCacheMaxSize as number | undefined) ?? MEMORY_CACHE_DEFAULT_MAX_SIZE;
}

/** 内存侧的 stale-allowed 注册表，对应 redis 的 [cache-stale-allowed] set。
 *  记录哪些缓存 key 启用了 StaleWhileRevalidate，供 clearMethodCache 查表。 */
const memStaleAllowed = new Set<string>();

/** 内存版的 parent→children 关联表，对应 redis 的 [cache-parent]* / [cache-child]* set。 */
const memParentChild = {
    parentToChildren: new Map<string, Set<string>>(),
    childToParents: new Map<string, Set<string>>(),
    link(parents: string[], child: string) {
        for (const p of parents) {
            let s = this.parentToChildren.get(p);
            if (!s) { s = new Set(); this.parentToChildren.set(p, s); }
            s.add(child);
            let r = this.childToParents.get(child);
            if (!r) { r = new Set(); this.childToParents.set(child, r); }
            r.add(p);
        }
    },
    unlinkChild(child: string) {
        const parents = this.childToParents.get(child);
        if (!parents) return;
        for (const p of parents) {
            this.parentToChildren.get(p)?.delete(child);
        }
        this.childToParents.delete(child);
    },
    drainParent(parent: string): string[] {
        const children = this.parentToChildren.get(parent);
        if (!children) return [];
        const list = [...children];
        for (const c of list) {
            this.childToParents.get(c)?.delete(parent);
        }
        this.parentToChildren.delete(parent);
        return list;
    }
};

/**
 * 写一条内存缓存。
 * - 用 Map 的插入顺序天然实现 LRU：先 delete 再 set，把 key 放到尾部；
 *   超过上限时从头部（最少recently used）开始淘汰。
 * - `cacheNullValue=true` 时，null/undefined 也会以 null 形式写入（防穿透）。
 * - 存储格式与 Redis 一致（CacheValue: { t, d, s }）。
 */
function memSet(
    key: string,
    result: any,
    config: {
        autoClearTime?: number;
        cacheNullValue?: boolean;
        nullCacheTime?: number;
        clearKey?: string[];
        /** 清理策略。StaleWhileRevalidate 时注册到 memStaleAllowed，供 clearMethodCache 查表。 */
        staleMode?: CacheStaleMode;
    }
) {
    const isNullish = result === null || result === undefined;
    if (isNullish && !config.cacheNullValue) {
        return;
    }
    const ttlMinutes = isNullish ? (config.nullCacheTime ?? config.autoClearTime) : config.autoClearTime;
    const expiresAt = ttlMinutes ? Date.now() + ttlMinutes * 60_000 : 0;
    const dataStr = isNullish ? 'null' : JSON.stringify(result);
    const timestamp = Date.now();

    const cache = getMemCache();
    const staleAllowed = config.staleMode === CacheStaleMode.StaleWhileRevalidate;
    const entry: MemCacheEntry = {
        cache: { t: timestamp, d: dataStr, ...(staleAllowed ? { sa: 1 } : {}) },
        expiresAt
    };

    if (cache.has(key)) cache.delete(key);
    cache.set(key, entry);

    const max = getMemCacheMaxSize();
    while (cache.size > max) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
        memParentChild.unlinkChild(oldest);
    }

    if (config.clearKey && config.clearKey.length > 0) {
        memParentChild.link(config.clearKey, key);
    }

    cacheLog(`memcache ${key} seted t${timestamp}${isNullish ? ' (null)' : ''}!`);
}

/** 读内存缓存，lazy expire。命中后挪到 LRU 尾部。
 *  stale 窗口内的条目也算命中（`stale: true`），由调用方决定是否触发后台刷新。 */
function memGet(key: string): { hit: true; value: any; stale: boolean; timestamp: number } | { hit: false } {
    const cache = getMemCache();
    const entry = cache.get(key);
    if (!entry) return { hit: false };
    // 自然过期
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
        cache.delete(key);
        memParentChild.unlinkChild(key);
        return { hit: false };
    }
    // stale 标志（s=1）且已过期 → 视为 miss
    if (entry.cache.s === 1 && entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
        cache.delete(key);
        memParentChild.unlinkChild(key);
        return { hit: false };
    }
    // 命中（新鲜 or stale 窗口内）
    cache.delete(key);
    cache.set(key, entry);
    return { hit: true, value: memGetValue(entry), stale: memIsStale(entry), timestamp: entry.cache.t };
}

/** 设置方法缓存 */
async function setMethodCache(
    config: {
        key: string;
        clearKey?: string[];
        /** 自动清空缓存的时间，单位分钟 */
        autoClearTime?: number;
        /** 是否缓存 null / undefined（负缓存），用于防穿透。默认 false，保持旧行为。 */
        cacheNullValue?: boolean;
        /** 负缓存 TTL（分钟）。默认沿用 autoClearTime；都不设时不写入。 */
        nullCacheTime?: number;
        result: any;
        /** 清理策略。StaleWhileRevalidate 时需要注册到 stale-allowed 标记，供 clearMethodCache 查表。 */
        staleMode?: CacheStaleMode;
    },
    devid?: string | false | undefined
) {
    const db = getRedisDB();
    const isNullish = config.result === null || config.result === undefined;
    // 旧行为：null / undefined 不进缓存；新增 cacheNullValue=true 时写入 'null'（穿透防御）。
    if (isNullish && !config.cacheNullValue) {
        return;
    }
    // 统一序列化：undefined 不是合法 JSON，归一化成 null。
    const dataStr = isNullish ? 'null' : JSON.stringify(config.result);
    // 负缓存通常用更短 TTL，避免业务恢复后还长时间返回旧的 null。
    const ttl = isNullish
        ? (config.nullCacheTime ?? config.autoClearTime)
        : config.autoClearTime;

    // 映射关系存放（负缓存也参与关联清除，因为外部清缓存的语义不区分正负）
    if (config.clearKey && config.clearKey.length > 0) {
        for (const clear of config.clearKey) {
            await db.sadd(CacheKey.parent(clear), config.key);
            await db.sadd(CacheKey.child(config.key), clear);
        }
    }
    // 写入缓存值（带时间戳 + staleAllowed 标志）。时间戳用本地时钟，无需读取旧值。
    const timestamp = Date.now();
    const staleAllowed = config.staleMode === CacheStaleMode.StaleWhileRevalidate;
    const payload = serializeCacheValue(dataStr, timestamp, false, staleAllowed);
    if (ttl) { // 自动清空
        await db.set(CacheKey.value(config.key), payload, 'EX', ttl * 60);
        cacheLog(`cache ${config.key} seted t${timestamp}${isNullish ? ' (null)' : ''}!`);
    } else {
        await db.set(CacheKey.value(config.key), payload);
        cacheLog(`cache ${config.key} seted t${timestamp}${isNullish ? ' (null)' : ''}!`);
    }
    // staleAllowed 已存储在缓存值内部（CacheValue.sa），无需单独的 meta key
    // 删除旧格式残留（兼容升级）
    await db.del(CacheKey.meta(config.key));
    // 订阅：清空 clear list —— 同一 key 在缓存生命周期内只注册一次监听器，
    // 否则每次 miss 都会 .on 一次，clearMethodCache 触发时回调会被执行 N 遍，
    // 长期运行造成监听器泄漏。
    if (config.clearKey && config.clearKey.length > 0) {
        const event = CacheKey.value(config.key);
        if (globalThis[_EventBus].listenerCount(event) === 0) {
            globalThis[_EventBus].on(event, async (key: string) => {
                await clearCacheKey(key, 30);
                cacheLog(`cache ${key} clear by key!`);
            });
        }
    }
    if (devid) {
        // 订阅：清空 clear list —— 同样去重，避免每次 miss 都重复注册。
        const event = `user-${devid}`;
        if (globalThis[_EventBus].listenerCount(event) === 0) {
            globalThis[_EventBus].on(event, async function (key: string) {
                await clearCacheKey(key, 30);
                cacheLog(`cache ${key} clear by devid!`);
            });
        }
    }
}
/**
 * 单个缓存 key 的 stale-or-purge 决策与执行。
 * - stale-allowed（[cache-meta]key 存在）→ 只标记 stale（s=1），保留缓存值（StaleWhileRevalidate）
 * - 否则 → 直接删缓存值（Purge）
 *
 * 无论哪种路径，parent↔child 关联关系都清理。
 *
 * @returns 受影响的 children 列表（parent 路径会返回所有被级联清理的 child key）
 */
async function clearCacheKey(key: string, staleTimeoutSec: number): Promise<string[]> {
    const db = getRedisDB();
    const affectedChildren: string[] = [];

    // 1. 先处理 parent 级联：把关联的 children 全部清掉
    const parentType = await db.type(CacheKey.parent(key));
    if (parentType === 'set') {
        const childKeys = await db.smembers(CacheKey.parent(key));
        for (const child of childKeys) {
            cacheLog(`cache ${child} cleared via parent ${key}!`);
            await clearCacheKey(child, staleTimeoutSec);
            affectedChildren.push(child);
        }
        await db.del(CacheKey.parent(key));
    }

    // 2. 判断 stale-allowed：查 [cache-meta]key（带 TTL 的 string）
    const meta = await db.get(CacheKey.meta(key));

    if (meta !== null) {
        // stale-allowed：保留缓存值，在缓存值内标记 stale（s=1）
        const valueRaw = await db.get(CacheKey.value(key));
        if (valueRaw) {
            const v = deserializeCacheValue(valueRaw);
            const newPayload = serializeCacheValue(v.d, v.t, true);  // 标记 stale，保留原时间戳
            // 保留原 TTL：用 TTL 命令查询剩余时间，重新 SET
            const ttlSec = await db.ttl(CacheKey.value(key));
            if (ttlSec > 0) {
                await db.set(CacheKey.value(key), newPayload, 'EX', ttlSec);
            } else {
                await db.set(CacheKey.value(key), newPayload);
            }
            cacheLog(`cache ${key} marked stale (t${v.t})`);
        }
        // 删除 stale meta（已转移到缓存值内）
        await db.del(CacheKey.meta(key));
    } else {
        // Purge：直接删缓存值 + meta
        await db.del(CacheKey.value(key));
        await db.del(CacheKey.meta(key));
        cacheLog(`cache ${key} purged!`);
    }

    // 3. 清理 child→parent 反向关联
    const childType = await db.type(CacheKey.child(key));
    if (childType === 'set') {
        const parentKeys = await db.smembers(CacheKey.child(key));
        for (const pk of parentKeys) {
            const t = await db.type(CacheKey.parent(pk));
            if (t === 'set') {
                await db.srem(CacheKey.parent(pk), key);
            }
        }
        await db.del(CacheKey.child(key));
    }

    return affectedChildren;
}

/**
 * 清空方法缓存。同时清 redis 和 memory 两边，业务侧无需关心存储是哪种。
 * - redis 侧只在配置了 redis 时才操作；没配 redis 时安静跳过，不抛错。
 * - 关联清除（clearKey）在两边都生效。
 * - 被清理的 key 如果启用了 StaleWhileRevalidate，会保留旧值并标记 stale（零阻塞窗口）。
 *
 * @param key       要清理的缓存 key 或 parent key
 * @param staleTimeoutSec  stale 窗口秒数（仅对 StaleWhileRevalidate 的 key 生效）。默认 30。
 */
export async function clearMethodCache(key: string, staleTimeoutSec = 30) {
    // ── 内存侧 ──
    const cache = getMemCache();
    const staleExpiresAt = Date.now() + staleTimeoutSec * 1000;
    const childrenFromParent = memParentChild.drainParent(key);
    for (const child of childrenFromParent) {
        if (memStaleAllowed.has(child)) {
            const childEntry = cache.get(child);
            if (childEntry) {
                // 在统一格式内标记 stale（s=1），并限制 stale 窗口不超过 staleTimeoutSec
                childEntry.cache.s = 1;
                if (childEntry.expiresAt === 0 || childEntry.expiresAt > staleExpiresAt) {
                    childEntry.expiresAt = staleExpiresAt;
                }
                cache.delete(child);
                cache.set(child, childEntry);
                cacheLog(`memcache ${child} marked stale (t${childEntry.cache.t})`);
            }
        } else {
            cache.delete(child);
            memParentChild.unlinkChild(child);
            memStaleAllowed.delete(child);
        }
    }
    if (cache.has(key)) {
        if (memStaleAllowed.has(key)) {
            const entry = cache.get(key)!;
            entry.cache.s = 1;
            if (entry.expiresAt === 0 || entry.expiresAt > staleExpiresAt) {
                entry.expiresAt = staleExpiresAt;
            }
            cache.delete(key);
            cache.set(key, entry);
            cacheLog(`memcache ${key} marked stale (t${entry.cache.t})`);
        } else {
            cache.delete(key);
            memParentChild.unlinkChild(key);
            memStaleAllowed.delete(key);
        }
    }

    // ── redis 侧：没配 redis 时跳过 ──
    const redisDao = globalThis[_dao]?.[DBType.Redis]?.[_primaryDB];
    if (!redisDao) return;

    await clearCacheKey(key, staleTimeoutSec);
}
/**
 * Redis 缓存执行：先查缓存 → miss 后单飞抢锁执行 → 其它等待者只盯缓存、不抢锁。
 *
 * 关键点（区别于"锁内二次检查"的朴素实现）：等待者并不进入 redlock 竞争队列，
 * 只用轻量 SETNX 选出"首飞"，其它人在 `wait_for_cache` 循环里轮询缓存。
 * 这样首飞一旦写完缓存，所有等待者下一次 sleep 醒来就能并行命中，
 * 而不是排着队一个个 acquire/release 锁——避免串行化。
 *
 * 命中判断用 `cached !== null`（ioredis 在 key 不存在时返回 `null`），
 * 这样 `cacheNullValue=true` 时存进去的字面量 `'null'` 也会算作命中，达到防穿透效果。
 *
 * 命中时若发现 stale 标记（[cache-stale]key 存在），说明该值是"已被声明过期但保留的旧值"，
 * 此时仍返回旧值（零阻塞），同时触发后台 single-flight 异步刷新。
 * 这样 clearMethodCache 后的首次读取不会被阻塞，后续读取将命中刷新后的新值。
 *
 * redis 不可用或 SETNX 异常时退化为无锁直跑，保留可用性。
 */
const SINGLEFLIGHT_LOCK_TTL_MS = 30_000;       // 首飞标记 TTL，兜底首飞挂掉的情况
const SINGLEFLIGHT_POLL_INTERVAL_MS = 50;       // 等待者轮询缓存的间隔
const SINGLEFLIGHT_MAX_WAIT_MS = 30_000;        // 等待者最长等多久；超时就自己跑 fn（保底，不应该常发生）

interface CacheCoreOpts<T> {
    key: string;
    clearKey?: string[];
    autoClearTime?: number;
    /** 是否缓存 null（负缓存防穿透），默认 false。 */
    cacheNullValue?: boolean;
    /** 负缓存 TTL（分钟），默认沿用 autoClearTime。 */
    nullCacheTime?: number;
    /** 传给 setMethodCache 的 user devid，用于按用户 session 清缓存 */
    devid?: string | false | undefined;
    /**
     * 缓存被清理时的行为策略。默认 Purge。
     * StaleWhileRevalidate 时，setMethodCache 会注册到 stale-allowed set，
     * 使 clearMethodCache 对该 key 走"标记 stale + 保留旧值"路径。
     */
    staleMode?: CacheStaleMode;
    /**
     * 方法的输入参数。在调用 onCacheUpdated 时作为第二个参数传入，便于回调内根据入参做差异化处理。
     */
    args?: any[];
    /**
     * 缓存更新回调。异步方法，在 setMethodCache 成功写缓存后调用（包括正常 single-flight 和 stale 后台刷新）。
     * 调用时三个参数：this → 方法的执行上下文；args → 方法的输入参数；value → 缓存值。
     *
     * @example
     * ```ts
     * @MethodCache({
     *     key: ({ deviceId }) => `calibration:${deviceId}`,
     *     async onCacheUpdated(this: MyService, args, value) {
     *         await this.broadcastToClients(args[0], value);
     *     }
     * })
     * ```
     */
    onCacheUpdated?: (this: any, value: T, ...args: any[]) => void | Promise<void>;
    /**
     * 方法的执行上下文（this）。在调用 onCacheUpdated 时作为 this 传入。
     * 由 @MethodCache 装饰器自动填充，调用方无需手动传递。
     */
    ctx?: any;
    fn: () => Promise<T>;
}

/**
 * 后台异步刷新：fire-and-forget，不阻塞调用方。
 * 只有抢到首飞标记的实例才会执行 fn() 并写缓存；其它实例直接放弃。
 * 刷新完成后删除 stale 标记，后续读取将命中新值。
 * 如果配置了 onCacheUpdated 回调，调用时传入 ctx（方法的 this 上下文）。
 */
async function staleBackgroundRefresh<T>(opts: CacheCoreOpts<T>, setOpts: any): Promise<void> {
    const db = getRedisDB();
    const sfKey = CacheKey.sf(opts.key);
    try {
        const ok = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
        if (ok !== 'OK') return;  // 别人已经在刷新了，自己放弃
    } catch {
        return;  // redis 出错，放弃刷新，下次读取再试
    }
    try {
        const result = await opts.fn();
        // 写新值（setMethodCache 内部会清除 stale 标志 s=1）
        await setMethodCache({ key: opts.key, ...setOpts, result }, opts.devid);
        // 调用缓存更新回调（带 ctx）
        void opts.onCacheUpdated?.call(opts.ctx, result, ...(opts.args ?? []));
        cacheLog(`cache ${opts.key} stale background refresh done!`);
    } catch (error: any) {
        (globalThis[_LoggerService]! as LoggerService).warn?.(`cache ${opts.key} stale background refresh failed: ${error?.message}`);
    } finally {
        try { await db.del(sfKey); } catch { /* TTL 兜底 */ }
    }
}

async function redisCacheCore<T>(opts: CacheCoreOpts<T>): Promise<T> {
    const db = getRedisDB();
    const cacheKey = CacheKey.value(opts.key);
    const raw = await db.get(cacheKey);
    if (raw !== null) {
        // 一次读取拿到全部信息（值 + stale 状态）
        const v = deserializeCacheValue(raw);
        const isStale = v.s === 1;
        if (isStale) {
            // stale 窗口内：返回旧值 + 触发后台刷新（不阻塞）
            cacheLog(`cache ${opts.key} hit (stale t${v.t})!`);
            const setOpts = {
                clearKey: opts.clearKey,
                autoClearTime: opts.autoClearTime,
                cacheNullValue: opts.cacheNullValue,
                nullCacheTime: opts.nullCacheTime,
                staleMode: opts.staleMode
            };
            if (!globalStaleInflight.has(opts.key)) {
                const refreshP = staleBackgroundRefresh(opts, setOpts).finally(() => {
                    globalStaleInflight.delete(opts.key);
                });
                globalStaleInflight.set(opts.key, refreshP);
            }
        } else {
            cacheLog(`cache ${opts.key} hit (t${v.t})!`);
        }
        return JSON.parse(v.d);
    }
    cacheLog(`cache ${opts.key} miss!`);

    const setOpts = {
        clearKey: opts.clearKey,
        autoClearTime: opts.autoClearTime,
        cacheNullValue: opts.cacheNullValue,
        nullCacheTime: opts.nullCacheTime,
        staleMode: opts.staleMode
    };

    // 用一个独立的"首飞标记" key 选出谁去执行 fn——SET NX PX 是原子操作，
    // 同一时刻只有一个调用者拿到 true，其它返回 null。这把"标记"不重入也不计数，
    // 只是个 single-flight 指示器，和 redlock / GetRedisLock 的并发计数器不冲突。
    const sfKey = CacheKey.sf(opts.key);
    let isLeader = false;
    try {
        const ok = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
        isLeader = ok === 'OK';
    } catch (error: any) {
        // redis 出错：退化为无锁直跑，保留可用性
        (globalThis[_LoggerService]! as LoggerService).warn?.(`single-flight setnx ${opts.key} failed: ${error?.message}, fallback to no-lock`);
        const result = await opts.fn();
        await setMethodCache({ key: opts.key, ...setOpts, result }, opts.devid);
        void opts.onCacheUpdated?.call(opts.ctx, result, ...(opts.args ?? []));
        return result;
    }

    if (isLeader) {
        // 首飞：跑 fn、写缓存、释放首飞标记
        try {
            const result = await opts.fn();
            await setMethodCache({ key: opts.key, ...setOpts, result }, opts.devid);
            void opts.onCacheUpdated?.call(opts.ctx, result, ...(opts.args ?? []));
            return result;
        } finally {
            try {
                await db.del(sfKey);
            } catch {
                // 标记 TTL 会兜底，删失败不影响正确性
            }
        }
    }

    // 等待者：循环只看缓存，不抢锁
    const waitStart = Date.now();
    while (true) {
        await sleep(SINGLEFLIGHT_POLL_INTERVAL_MS);
        const recheck = await db.get(cacheKey);
        if (recheck !== null) {
            cacheLog(`cache ${opts.key} hit after wait!`);
            return JSON.parse(deserializeCacheValue(recheck).d);
        }
        // 首飞挂了（TTL 到期，sf 标记自动消失）但缓存仍然空——抢做下一任首飞
        const leaderGone = await db.get(sfKey);
        if (leaderGone === null) {
            const taken = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
            if (taken === 'OK') {
                cacheLog(`cache ${opts.key}: previous leader gone, taking over`);
                try {
                    const result = await opts.fn();
                    await setMethodCache({ key: opts.key, ...setOpts, result }, opts.devid);
                    void opts.onCacheUpdated?.call(opts.ctx, result, ...(opts.args ?? []));
                    return result;
                } finally {
                    try { await db.del(sfKey); } catch { /* TTL 兜底 */ }
                }
            }
            // 没抢到说明又有别人接手了，继续等
        }
        // 等待上限保底：极端情况下首飞和接班都不正常时，自己直接跑，宁可重复执行也不挂死
        if (Date.now() - waitStart > SINGLEFLIGHT_MAX_WAIT_MS) {
            (globalThis[_LoggerService]! as LoggerService).warn?.(`cache ${opts.key}: wait timed out, running fn without lock`);
            const result = await opts.fn();
            await setMethodCache({ key: opts.key, ...setOpts, result }, opts.devid);
            void opts.onCacheUpdated?.call(opts.ctx, result, ...(opts.args ?? []));
            return result;
        }
    }
}

/**
 * 内存缓存执行：单进程内的 single-flight 不需要任何分布式协调——
 * JS 单线程 + 同一份 in-flight Map 就够了。同一 key 的并发调用全部 await 同一个 Promise，
 * Promise 解析后所有等待者下个事件循环 tick 并发返回，零序列化、零 redis 往返。
 *
 * 注意：Memory 后端的 stale 标记仅对当前进程可见。PM2 多实例模式下，
 * 实例 A 标记 stale 后，实例 B 看不到该标记，仍会走正常 single-flight。
 * 因此 StaleWhileRevalidate 推荐搭配 Redis 后端使用。
 */
async function memoryCacheCore<T>(opts: CacheCoreOpts<T>): Promise<T> {
    const cacheKey = opts.key;

    // 1. 看缓存
    const hit = memGet(cacheKey);
    if (hit.hit) {
        if (hit.stale) {
            // stale 窗口内：返回旧值 + 触发后台刷新（不阻塞）
            cacheLog(`memcache ${opts.key} hit (stale)!`);
            if (!globalStaleInflight.has(opts.key)) {
                const refreshP = memoryStaleBackgroundRefresh(opts, cacheKey).finally(() => {
                    globalStaleInflight.delete(opts.key);
                });
                globalStaleInflight.set(opts.key, refreshP);
            }
        } else {
            cacheLog(`memcache ${opts.key} hit!`);
        }
        return hit.value as T;
    }
    cacheLog(`memcache ${opts.key} miss!`);

    // 2. 已有等待中的 Promise → 直接 await，single-flight 自动达成
    const inflight = getMemInflight();
    const existing = inflight.get(cacheKey);
    if (existing) {
        return await existing as T;
    }

    // 3. 首飞：把 Promise 提前塞进 inflight，让后到者命中
    const p = (async () => {
        try {
            const result = await opts.fn();
            memSet(cacheKey, result, {
                autoClearTime: opts.autoClearTime,
                cacheNullValue: opts.cacheNullValue,
                nullCacheTime: opts.nullCacheTime,
                clearKey: opts.clearKey,
                staleMode: opts.staleMode
            });
            void opts.onCacheUpdated?.call(opts.ctx, result, ...(opts.args ?? []));
            return result;
        } finally {
            inflight.delete(cacheKey);
        }
    })();
    inflight.set(cacheKey, p);
    return await p as T;
}

/**
 * 内存后端的后台 stale 刷新：fire-and-forget。
 * 用现有的 inflight Map 做 single-flight —— 只有第一个请求会真正执行 fn()，
 * 后续请求复用同一个 Promise。刷新完成后删除 stale 标记。
 */
async function memoryStaleBackgroundRefresh<T>(opts: CacheCoreOpts<T>, cacheKey: string): Promise<void> {
    const inflight = getMemInflight();
    const inflightKey = `__stale__${cacheKey}`;   // 用独立 key 避免与正常 single-flight 冲突
    const existing = inflight.get(inflightKey);
    if (existing) return await existing as Promise<void>;  // 已在刷新，直接等它

    const p = (async () => {
        try {
            const result = await opts.fn();
            memSet(cacheKey, result, {
                autoClearTime: opts.autoClearTime,
                cacheNullValue: opts.cacheNullValue,
                nullCacheTime: opts.nullCacheTime,
                clearKey: opts.clearKey,
                staleMode: opts.staleMode
            });
            // 清除 stale 标志（s=1 → 删除 s 字段）
            const cache = getMemCache();
            const entry = cache.get(cacheKey);
            if (entry) {
                delete entry.cache.s;
                cache.delete(cacheKey);
                cache.set(cacheKey, entry);
            }
            // 调用缓存更新回调（带 ctx）
            void opts.onCacheUpdated?.call(opts.ctx, result, ...(opts.args ?? []));
            cacheLog(`memcache ${opts.key} stale background refresh done!`);
        } catch (error: any) {
            (globalThis[_LoggerService]! as LoggerService).warn?.(`memcache ${opts.key} stale background refresh failed: ${error?.message}`);
        } finally {
            inflight.delete(inflightKey);
        }
    })();
    inflight.set(inflightKey, p);
    return await p;
}

/**
 * @internal 内存后端的 strict stale 等待：不返回旧值，等刷新完成后返回新值。
 * 复用 memoryStaleBackgroundRefresh 的 single-flight（基于 inflight Map）。
 * 超时后降级为直接执行 fn()。
 */
async function excuteCacheCore<T>(opts: CacheCoreOpts<T> & { storage?: StorageType }): Promise<T> {
    return opts.storage === StorageType.Memory ? await memoryCacheCore(opts) : await redisCacheCore(opts);
}

/**
 * 执行一个方法fn，
 * 如果有缓存，则返回缓存，否则【加锁、二次检查】后执行方法并缓存，防止缓存击穿。
 * 可选 `cacheNullValue=true` 开启负缓存，防穿透；负缓存默认沿用 autoClearTime，可单独用 nullCacheTime 设短。
 * 可选 `staleMode: CacheStaleMode.StaleWhileRevalidate` 开启异步重新验证（清理时保留旧值，零阻塞）。
 */
export async function excuteWithCache<T>(config: {
    /** 返回缓存key,参数=方法的参数+当前用户对象，可以用来清空缓存。 */
    key: ((...args: any[]) => string) | string;
    /** 返回缓存清除key,参数=方法的参数+当前用户对象，可以用来批量清空缓存 */
    clearKey?: string[];
    /** 自动清空缓存的时间，单位分钟 */
    autoClearTime?: number;
    /** 是否缓存 null / undefined（负缓存防穿透），默认 false。 */
    cacheNullValue?: boolean;
    /** 负缓存 TTL（分钟），默认沿用 autoClearTime。 */
    nullCacheTime?: number;
    /** 存储后端：'redis'（默认，跨进程共享）或 'memory'（进程内 LRU，更快但不跨进程）。 */
    storage?: StorageType;
    /** 随着当前用户sesion的清空而一起清空 */
    clearWithSession?: boolean;
    /**
     * 缓存被清理时的行为策略。默认 Purge（直接删除，重建时阻塞）。
     * StaleWhileRevalidate：清理时保留旧值并标记过期，读取时零阻塞返回旧值 + 后台刷新。
     * 注意：StaleWhileRevalidate 推荐搭配 Redis 后端，Memory 后端在 PM2 多实例下 stale 标记不可跨进程可见。
     */
    staleMode?: CacheStaleMode;
    /** stale 窗口秒数（仅 StaleWhileRevalidate 生效）。默认 30。 */
    staleTimeout?: number;
    /**
     * 缓存更新回调。异步方法，在 setMethodCache 成功写缓存后调用。
     * 调用时三个参数：this → 执行上下文（config.ctx）；args → 方法输入参数；value → 缓存值。
     */
    onCacheUpdated?: (this: any, value: T, ...args: any[]) => void | Promise<void>;
    /**
     * 方法的执行上下文。在 onCacheUpdated 回调中作为 this 传入。
     * @example
     * ```ts
     * excuteWithCache({
     *     key: 'calibration',
     *     ctx: service,
     *     args: ['device001'],
     *     onCacheUpdated(this: MyService, args, value) {
     *         this.broadcast(value);
     *     },
     * }, () => service.getCalibration('device001'));
     * ```
     */
    ctx?: any;
    /**
     * 方法的输入参数。在 onCacheUpdated 回调中作为 args 传入。
     * 用于告知回调是哪些参数触发了本次缓存更新。
     */
    args?: any[];
}, fn: () => Promise<T>): Promise<T> {
    const key = typeof config.key === 'function' ? config.key() : config.key;
    return await excuteCacheCore({
        key,
        clearKey: config.clearKey,
        autoClearTime: config.autoClearTime,
        cacheNullValue: config.cacheNullValue,
        nullCacheTime: config.nullCacheTime,
        storage: config.storage,
        staleMode: config.staleMode,
        onCacheUpdated: config.onCacheUpdated,
        ctx: config.ctx,
        args: config.args ?? [],
        fn
    });
}
/**
 * 缓存注解：先查缓存 → miss 才加锁 → 锁内再查一次 → 仍 miss 才执行原方法。
 * 已内置 single-flight，不需要再叠 `@MethodLock`。
 * 可选 `cacheNullValue=true` 开启负缓存，防穿透。
 * 可选 `storage: 'memory'` 用进程内 LRU 替代 redis（单进程场景，毫秒级延迟）。
 * 可选 `staleMode: CacheStaleMode.StaleWhileRevalidate` 开启异步重新验证（清理时保留旧值，零阻塞）。
 * 可选 `onCacheUpdated` 设置缓存更新回调（带 this 上下文）。
 */
export function MethodCache<T = any>(config: {
    /** 返回缓存key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来清空缓存。 */
    key: ((this: T, ...args: any[]) => string) | string;
    /** 返回缓存清除key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来批量清空缓存 */
    clearKey?: ((this: T, ...args: any[]) => string[]) | string[];
    /** 自动清空缓存的时间，单位分钟 */
    autoClearTime?: number;
    /** 是否缓存 null / undefined（负缓存防穿透），默认 false。 */
    cacheNullValue?: boolean;
    /** 负缓存 TTL（分钟），默认沿用 autoClearTime。 */
    nullCacheTime?: number;
    /** 存储后端：'redis'（默认，跨进程共享）或 'memory'（进程内 LRU，更快但不跨进程）。 */
    storage?: StorageType;
    /** 随着当前用户sesion的清空而一起清空 */
    clearWithSession?: boolean;
    /**
     * 缓存被清理时的行为策略。默认 Purge（直接删除，重建时阻塞）。
     * StaleWhileRevalidate：清理时保留旧值并标记过期，读取时零阻塞返回旧值 + 后台刷新。
     * 注意：StaleWhileRevalidate 推荐搭配 Redis 后端，Memory 后端在 PM2 多实例下 stale 标记不可跨进程可见。
     */
    staleMode?: CacheStaleMode;
    /** stale 窗口秒数（仅 StaleWhileRevalidate 生效）。默认 30。 */
    staleTimeout?: number;
    /**
     * 缓存更新回调。异步方法，在 setMethodCache 成功写缓存后调用。
     * 调用时三个参数：this → 执行上下文；args → 方法输入参数；value → 缓存值。
     */
    onCacheUpdated?: (this: any, value: T, ...args: any[]) => void | Promise<void>;
}) {
    return function (_target: T, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn = descriptor.value;
        descriptor.value = async function (this: any, ...args: any[]) {
            const key = typeof config.key === 'function' ? config.key.call(this, ...args) : config.key;
            const clearKey = config.clearKey
                ? (typeof config.clearKey === 'function' ? config.clearKey.call(this, ...args) : config.clearKey)
                : undefined;
            const devid = config.clearWithSession && this.ctx && this.ctx.me && this.ctx.me.devid;
            return await excuteCacheCore({
                key,
                clearKey,
                autoClearTime: config.autoClearTime,
                cacheNullValue: config.cacheNullValue,
                nullCacheTime: config.nullCacheTime,
                storage: config.storage,
                staleMode: config.staleMode,
                onCacheUpdated: config.onCacheUpdated,
                ctx: this,   // 传递当前 this 上下文
                args,        // 传递方法输入参数
                devid,
                fn: async () => await fn.call(this, ...args)
            });
        };
    };
}

/**
 * 外部直接设置缓存值。用于绕过 @MethodCache 装饰器直接更新缓存的场景
 * （如外部事件驱动的数据变更、手动刷新等）。
 *
 * 内部使用统一格式 { v, d, s } 序列化，确保与 @MethodCache 的读取逻辑兼容。
 *
 * @param cacheKey   缓存 key（不含 [cache] 前缀，与 @MethodCache 的 key 一致）
 * @param value      要缓存的值
 * @param options    选项
 *
 * @example
 * ```ts
 * // 外部事件驱动更新缓存
 * await setCache('match-timer-123', timer, { autoClearTime: 120 });
 *
 * // 同时触发 onCacheUpdated 回调（如果有）
 * await setCache('match-timer-123', timer, {
 *     autoClearTime: 120,
 *     onCacheUpdated(this: MyService, value) {
 *         this.broadcast(value);
 *     }
 * });
 * ```
 */
export async function setCache<T = any>(
    cacheKey: string,
    value: T,
    options: {
        /** 自动清空缓存的时间，单位分钟。不设则永不过期。 */
        autoClearTime?: number;
        /** 是否缓存 null / undefined。默认 false。 */
        cacheNullValue?: boolean;
        /** 缓存更新回调 */
        onCacheUpdated?: (this: any, value: T, ...args: any[]) => void | Promise<void>;
        /** 回调的 this 上下文 */
        ctx?: any;
        /** 回调的 args 参数 */
        args?: any[];
    } = {}
): Promise<void> {
    const {
        autoClearTime,
        cacheNullValue = false,
        onCacheUpdated,
        ctx,
        args = []
    } = options;

    const isNullish = value === null || value === undefined;
    if (isNullish && !cacheNullValue) {
        return;
    }
    const dataStr = isNullish ? 'null' : JSON.stringify(value);
    const timestamp = Date.now();
    const payload = serializeCacheValue(dataStr, timestamp);

    const db = getRedisDB();
    if (autoClearTime) {
        await db.set(CacheKey.value(cacheKey), payload, 'EX', autoClearTime * 60);
    } else {
        await db.set(CacheKey.value(cacheKey), payload);
    }

    // 同步更新内存缓存
    const memCache = getMemCache();
    const ttlMs = autoClearTime ? autoClearTime * 60_000 : 0;
    const memEntry: MemCacheEntry = {
        cache: { t: timestamp, d: dataStr },
        expiresAt: ttlMs ? Date.now() + ttlMs : 0
    };
    if (memCache.has(cacheKey)) memCache.delete(cacheKey);
    memCache.set(cacheKey, memEntry);

    // 触发回调
    void onCacheUpdated?.call(ctx, value, ...args);

    cacheLog(`cache ${cacheKey} externally set (t${timestamp})`);
}
