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
            (globalThis[_LoggerService]! as LoggerService).debug?.(`GetRedisLock ${key} attempt ${attempt + 1} failed: ${er?.message}, retry after ${delay}ms`);
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
                (globalThis[_LoggerService]! as LoggerService).debug?.(`get lock ${key} fail, retry after ${config.lockRetryInterval ?? 100}ms...`);
                await sleep(config.lockRetryInterval ?? 100);
                wait_time += (config.lockRetryInterval ?? 100);
                return await fn();
            } else {
                (globalThis[_LoggerService]! as LoggerService).debug?.(`get lock ${key} fail`);
                throw new Error(config.errorMessage || `get lock fail: ${key}`);
            }
        } else {
            (globalThis[_LoggerService]! as LoggerService).debug?.(`get lock ${key} ok!`);
            await db.pexpire(key, config.lockMaxTime ?? 60000);
            try {
                return await fn__();
            } finally {
                (globalThis[_LoggerService]! as LoggerService).debug?.(`unlock ${key} ok!`);
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

/** 内存 LRU 条目。`expiresAt = 0` 表示永不过期。 */
interface MemCacheEntry {
    /** 已经按 isNullish 做过归一化的最终值：要么是业务真值，要么是 null（用于负缓存）。 */
    value: any;
    /** 毫秒时间戳。0 表示永不过期。 */
    expiresAt: number;
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
 *   超过上限时从头部（最少最近使用）开始淘汰。
 * - `cacheNullValue=true` 时，null/undefined 也会以 null 形式写入（防穿透）。
 */
function memSet(
    key: string,
    result: any,
    config: {
        autoClearTime?: number;
        cacheNullValue?: boolean;
        nullCacheTime?: number;
        clearKey?: string[];
    }
) {
    const isNullish = result === null || result === undefined;
    if (isNullish && !config.cacheNullValue) {
        return;
    }
    const ttlMinutes = isNullish ? (config.nullCacheTime ?? config.autoClearTime) : config.autoClearTime;
    const expiresAt = ttlMinutes ? Date.now() + ttlMinutes * 60_000 : 0;
    const value = isNullish ? null : result;

    const cache = getMemCache();
    if (cache.has(key)) cache.delete(key);
    cache.set(key, { value, expiresAt });

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

    (globalThis[_LoggerService]! as LoggerService).debug?.(`memcache ${key} seted${isNullish ? ' (null)' : ''}!`);
}

/** 读内存缓存，lazy expire。命中后挪到 LRU 尾部。 */
function memGet(key: string): { hit: true; value: any } | { hit: false } {
    const cache = getMemCache();
    const entry = cache.get(key);
    if (!entry) return { hit: false };
    if (entry.expiresAt !== 0 && entry.expiresAt <= Date.now()) {
        cache.delete(key);
        memParentChild.unlinkChild(key);
        return { hit: false };
    }
    cache.delete(key);
    cache.set(key, entry);
    return { hit: true, value: entry.value };
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
    const payload = isNullish ? 'null' : JSON.stringify(config.result);
    // 负缓存通常用更短 TTL，避免业务恢复后还长时间返回旧的 null。
    const ttl = isNullish
        ? (config.nullCacheTime ?? config.autoClearTime)
        : config.autoClearTime;

    // 映射关系存放（负缓存也参与关联清除，因为外部清缓存的语义不区分正负）
    if (config.clearKey && config.clearKey.length > 0) {
        for (const clear of config.clearKey) {
            await db.sadd(`[cache-parent]${clear}`, config.key);
            await db.sadd(`[cache-child]${config.key}`, clear);
        }
    }
    if (ttl) { // 自动清空
        await db.set(`[cache]${config.key}`, payload, 'EX', ttl * 60);
        (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${config.key} seted${isNullish ? ' (null)' : ''}!`);
        // 订阅：清空 clear list —— 同一 key 在缓存生命周期内只注册一次监听器，
        // 否则每次 miss 都会 .on 一次，clearMethodCache 触发时回调会被执行 N 遍，
        // 长期运行造成监听器泄漏。
        if (config.clearKey && config.clearKey.length > 0) {
            const event = `[cache]${config.key}`;
            if (globalThis[_EventBus].listenerCount(event) === 0) {
                globalThis[_EventBus].on(event, async (key: string) => {
                    await clearChild(key, true);
                    (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${key} clear by key!`);
                });
            }
        }
    } else {
        await db.set(`[cache]${config.key}`, payload);
        (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${config.key} seted${isNullish ? ' (null)' : ''}!`);
    }
    if (devid) {
        // 订阅：清空 clear list —— 同样去重，避免每次 miss 都重复注册。
        const event = `user-${devid}`;
        if (globalThis[_EventBus].listenerCount(event) === 0) {
            globalThis[_EventBus].on(event, async function (key: string) {
                await clearChild(key);
                (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${key} clear by devid!`);
            });
        }
    }
}
/**
 * 清空方法缓存。同时清 redis 和 memory 两边，业务侧无需关心存储是哪种。
 * - redis 侧只在配置了 redis 时才操作；没配 redis 时安静跳过，不抛错。
 * - 关联清除（clearKey）在两边都生效。
 */
export async function clearMethodCache(key: string) {
    // 内存侧
    const cache = getMemCache();
    // 1. 如果 key 是 parent，把它关联的所有 children 都清掉
    const childrenFromParent = memParentChild.drainParent(key);
    for (const child of childrenFromParent) {
        cache.delete(child);
        memParentChild.unlinkChild(child);
    }
    // 2. 如果 key 本身是个缓存条目，直接清，并清掉它的反向链接
    if (cache.has(key)) {
        cache.delete(key);
    }
    memParentChild.unlinkChild(key);

    // redis 侧：没配 redis 时跳过
    const redisDao = globalThis[_dao]?.[DBType.Redis]?.[_primaryDB];
    if (!redisDao) return;

    const db = getRedisDB();
    let type = await db.type(`[cache-parent]${key}`);
    if (type === 'set') {
        await clearParent(key);
    }
    type = await db.type(`[cache]${key}`);
    if (type !== 'none') {
        await clearChild(key);
    }
}
async function clearChild(key: string, skipDel = false) {
    const db = getRedisDB();
    if (skipDel === false) {
        await db.del(`[cache]${key}`);
    }
    const childtype = await db.type(`[cache-child]${key}`);
    if (childtype === 'set') {
        const parentKeys = await db.smembers(`[cache-child]${key}`);
        for (const clear of parentKeys) {
            const type = await db.type(`[cache-parent]${clear}`);
            if (type === 'set') {
                await db.srem(`[cache-parent]${clear}`, key);
            }
        }
        await db.del(`[cache-child]${key}`);
    }
}
async function clearParent(clearKey: string) {
    const db = getRedisDB();
    const keys = await db.smembers(`[cache-parent]${clearKey}`);
    if (keys) {
        for (const key of keys) {
            (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${key} cleared!`);
            await clearChild(key);
        }
    }
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
    fn: () => Promise<T>;
}

async function redisCacheCore<T>(opts: CacheCoreOpts<T>): Promise<T> {
    const db = getRedisDB();
    const cacheKey = `[cache]${opts.key}`;
    const cached = await db.get(cacheKey);
    if (cached !== null) {
        (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${opts.key} hit!`);
        return JSON.parse(cached as string);
    }
    (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${opts.key} miss!`);

    const setOpts = {
        clearKey: opts.clearKey,
        autoClearTime: opts.autoClearTime,
        cacheNullValue: opts.cacheNullValue,
        nullCacheTime: opts.nullCacheTime
    };

    // 用一个独立的"首飞标记" key 选出谁去执行 fn——SET NX PX 是原子操作，
    // 同一时刻只有一个调用者拿到 true，其它返回 null。这把"标记"不重入也不计数，
    // 只是个 single-flight 指示器，和 redlock / GetRedisLock 的并发计数器不冲突。
    const sfKey = `[sf]${opts.key}`;
    let isLeader = false;
    try {
        const ok = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
        isLeader = ok === 'OK';
    } catch (error: any) {
        // redis 出错：退化为无锁直跑，保留可用性
        (globalThis[_LoggerService]! as LoggerService).warn?.(`single-flight setnx ${opts.key} failed: ${error?.message}, fallback to no-lock`);
        const result = await opts.fn();
        await setMethodCache({ key: opts.key, ...setOpts, result }, opts.devid);
        return result;
    }

    if (isLeader) {
        // 首飞：跑 fn、写缓存、释放首飞标记
        try {
            const result = await opts.fn();
            await setMethodCache({ key: opts.key, ...setOpts, result }, opts.devid);
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
            (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${opts.key} hit after wait!`);
            return JSON.parse(recheck as string);
        }
        // 首飞挂了（TTL 到期，sf 标记自动消失）但缓存仍然空——抢做下一任首飞
        const leaderGone = await db.get(sfKey);
        if (leaderGone === null) {
            const taken = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
            if (taken === 'OK') {
                (globalThis[_LoggerService]! as LoggerService).debug?.(`cache ${opts.key}: previous leader gone, taking over`);
                try {
                    const result = await opts.fn();
                    await setMethodCache({ key: opts.key, ...setOpts, result }, opts.devid);
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
            return result;
        }
    }
}

/**
 * 内存缓存执行：单进程内的 single-flight 不需要任何分布式协调——
 * JS 单线程 + 同一份 in-flight Map 就够了。同一 key 的并发调用全部 await 同一个 Promise，
 * Promise 解析后所有等待者下个事件循环 tick 并发返回，零序列化、零 redis 往返。
 */
async function memoryCacheCore<T>(opts: CacheCoreOpts<T>): Promise<T> {
    const cacheKey = opts.key;

    // 1. 看缓存
    const hit = memGet(cacheKey);
    if (hit.hit) {
        (globalThis[_LoggerService]! as LoggerService).debug?.(`memcache ${opts.key} hit!`);
        return hit.value as T;
    }
    (globalThis[_LoggerService]! as LoggerService).debug?.(`memcache ${opts.key} miss!`);

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
                clearKey: opts.clearKey
            });
            return result;
        } finally {
            inflight.delete(cacheKey);
        }
    })();
    inflight.set(cacheKey, p);
    return await p as T;
}

async function excuteCacheCore<T>(opts: CacheCoreOpts<T> & { storage?: StorageType }): Promise<T> {
    return opts.storage === StorageType.Memory ? await memoryCacheCore(opts) : await redisCacheCore(opts);
}

/**
 * 执行一个方法fn，
 * 如果有缓存，则返回缓存，否则【加锁、二次检查】后执行方法并缓存，防止缓存击穿。
 * 可选 `cacheNullValue=true` 开启负缓存，防穿透；负缓存默认沿用 autoClearTime，可单独用 nullCacheTime 设短。
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
}, fn: () => Promise<T>): Promise<T> {
    const key = typeof config.key === 'function' ? config.key() : config.key;
    return await excuteCacheCore({
        key,
        clearKey: config.clearKey,
        autoClearTime: config.autoClearTime,
        cacheNullValue: config.cacheNullValue,
        nullCacheTime: config.nullCacheTime,
        storage: config.storage,
        fn
    });
}
/**
 * 缓存注解：先查缓存 → miss 才加锁 → 锁内再查一次 → 仍 miss 才执行原方法。
 * 已内置 single-flight，不需要再叠 `@MethodLock`。
 * 可选 `cacheNullValue=true` 开启负缓存，防穿透。
 * 可选 `storage: 'memory'` 用进程内 LRU 替代 redis（单进程场景，毫秒级延迟）。
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
                devid,
                fn: async () => await fn.call(this, ...args)
            });
        };
    };
}
