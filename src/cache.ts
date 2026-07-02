import { DBType } from 'baja-lite-field';
import { sleep } from './fn.js';
import { Throw } from './error.js';
import {
    _dao,
    _EventBus,
    _GlobalSqlOption,
    _LoggerService,
    _memInflight,
    _primaryDB,
} from './const/symbols.js';
import { LoggerService } from './logger.js';

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
 * @internal [cache] 前缀下的子 key 命名全部收拢到这里。
 *
 * 命名规范：
 * - [cache]key                    缓存值（JSON: { t, d, sa?, n? }）
 * - [cache-sf]key                 single-flight 首飞标记（SETNX 抢锁用）
 * - [cache-parent]key / [cache-child]key   关联清除的 parent↔child 双向 set
 */
const CacheKey = {
    value:  (k: string) => `[cache]${k}`,
    sf:     (k: string) => `[cache-sf]${k}`,
    parent: (k: string) => `[cache-parent]${k}`,
    child:  (k: string) => `[cache-child]${k}`,
} as const;

/**
 * @internal 统一缓存值格式。
 *  - t: timestamp，写入时的毫秒时间戳。用于观测（debug 日志），不影响逻辑。
 *  - d: data，业务数据的 JSON 序列化字符串。
 *  - sa: staleAllowed 标志。1 = 该 key 配置了 StaleWhileRevalidate。
 *  - n: stale 计数器。0 = 最新，>0 = 需刷新次数（每次 clear +1，每次后台刷新完成 -1）。
 *
 * 好处：
 * 1. 一次读取拿到全部信息（值 + sa + n），热路径 1 次 IO。
 * 2. staleAllowed 与缓存同生命周期，无需外部 registry，clear 时自动判断。
 * 3. n 计数器处理刷新期间多次 clear 的情况——避免"刚刷新完又被标记过期"的问题。
 */
interface CacheValue {
    t: number;
    d: string;
    sa?: 1;
    n?: number;   // 0 或不存在 = 最新；>0 = 待刷新次数
}

/** @internal 序列化缓存值 */
function serializeCacheValue(data: string, timestamp: number, staleAllowed = false, staleCount = 0): string {
    const v: CacheValue = { t: timestamp, d: data };
    if (staleAllowed) v.sa = 1;
    if (staleCount > 0) v.n = staleCount;
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
                } catch {
                    // ignore
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
    /** 最大重试次数。默认 5。超过后抛出异常。 */
    lockMaxRetries?: number;
    /** 错误信息 */
    errorMessage?: string;
    /** 允许的并发数，默认：1 */
    lockMaxActive?: number;
    /** 单个锁多少【毫秒】后自动释放?默认：60*1000MS  */
    lockMaxTime?: number;
}, fn__: () => Promise<T>): Promise<T> {
    const key = `[lock]${typeof config.key === 'function' ? config.key() : config.key}`;
    const db = getRedisDB();
    const maxRetries = config.lockMaxRetries ?? 5;
    let retries = 0;
    let wait_time = 0;
    const fn = async (): Promise<T> => {
        const lock = await GetRedisLock(key, config.lockMaxActive);
        if (lock === false) {
            retries++;
            const timeOk = (config.lockMaxWaitTime ?? 0) === 0 || (wait_time + (config.lockRetryInterval ?? 100)) <= (config.lockMaxWaitTime ?? 0);
            const retryOk = retries < maxRetries;
            if (config.lockWait !== false && timeOk && retryOk) {
                (globalThis[_LoggerService]! as any).debugCategory?.('sql', `get lock ${key} fail, retry ${retries}/${maxRetries} after ${config.lockRetryInterval ?? 100}ms...`);
                await sleep(config.lockRetryInterval ?? 100);
                wait_time += (config.lockRetryInterval ?? 100);
                return await fn();
            } else {
                (globalThis[_LoggerService]! as any).debugCategory?.('sql', `get lock ${key} fail after ${retries} retries`);
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
    /** 最大重试次数。默认 5。超过后抛出异常。 */
    lockMaxRetries?: number;
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

/** 设置方法缓存 */
async function setMethodCache(
    config: {
        key: string;
        clearKey?: string[];
        autoClearTime?: number;
        cacheNullValue?: boolean;
        nullCacheTime?: number;
        result: any;
        staleMode?: CacheStaleMode;
        /** 显式控制 sa：undefined = 沿用旧值（默认）；true = sa=1；false = sa=0 */
        staleAllowedOverride?: boolean;
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
    // 写入缓存值（带时间戳 + staleAllowed 标志）。
    const timestamp = Date.now();
    let staleAllowed: boolean;
    if (config.staleAllowedOverride !== undefined) {
        staleAllowed = config.staleAllowedOverride;  // 显式指定
    } else {
        // 保留旧 sa：显式 StaleWhileRevalidate → 1，否则沿用旧值
        const existingSa = await db.get(CacheKey.value(config.key)).then(r => r ? deserializeCacheValue(r).sa : undefined);
        staleAllowed = config.staleMode === CacheStaleMode.StaleWhileRevalidate ? true : (existingSa ?? false);
    }
    const payload = serializeCacheValue(dataStr, timestamp, staleAllowed);
    if (ttl) { // 自动清空
        await db.set(CacheKey.value(config.key), payload, 'EX', ttl * 60);
        cacheLog(`${config.key} seted t${timestamp}${isNullish ? ' (null)' : ''}!`);
    } else {
        await db.set(CacheKey.value(config.key), payload);
        cacheLog(`${config.key} seted t${timestamp}${isNullish ? ' (null)' : ''}!`);
    }
    // staleAllowed 已存储在缓存值内部（CacheValue.sa），无需单独的 meta key
    // 删除旧格式残留（兼容升级）
    // await db.del(`[cache-meta]${config.key}`);   // 清理旧格式残留
    // 订阅：清空 clear list —— 同一 key 在缓存生命周期内只注册一次监听器，
    // 否则每次 miss 都会 .on 一次，clearMethodCache 触发时回调会被执行 N 遍，
    // 长期运行造成监听器泄漏。
    if (config.clearKey && config.clearKey.length > 0) {
        const event = CacheKey.value(config.key);
        if (globalThis[_EventBus].listenerCount(event) === 0) {
            globalThis[_EventBus].on(event, async (key: string) => {
                await clearCacheKey(key);
                cacheLog(`${key} clear by key!`);
            });
        }
    }
    if (devid) {
        // 订阅：清空 clear list —— 同样去重，避免每次 miss 都重复注册。
        const event = `user-${devid}`;
        if (globalThis[_EventBus].listenerCount(event) === 0) {
            globalThis[_EventBus].on(event, async (key: string) => {
                await clearCacheKey(key);
                cacheLog(`${key} clear by devid!`);
            });
        }
    }
}
/**
 * 单个缓存 key 的 stale-or-purge 决策与执行。
 * - CacheValue.sa=1 → 标记 s=1（保留缓存值，StaleWhileRevalidate）
 * - 否则 → 直接删缓存值（Purge）
 *
 * 无论哪种路径，parent↔child 关联关系都清理。
 *
 * @returns 受影响的 children 列表（parent 路径会返回所有被级联清理的 child key）
 */
async function clearCacheKey(key: string): Promise<string[]> {
    const db = getRedisDB();
    const affectedChildren: string[] = [];

    // 1. 先处理 parent 级联：把关联的 children 全部清掉
    const parentType = await db.type(CacheKey.parent(key));
    if (parentType === 'set') {
        const childKeys = await db.smembers(CacheKey.parent(key));
        for (const child of childKeys) {
            cacheLog(`${child} cleared via parent ${key}!`);
            await clearCacheKey(child);
            affectedChildren.push(child);
        }
        await db.del(CacheKey.parent(key));
    }

    // 2. 判断 stale-allowed：查缓存值内部的 sa 标志
    const valueRaw = await db.get(CacheKey.value(key));
    const v = valueRaw ? deserializeCacheValue(valueRaw) : null;

    if (v?.sa) {
        // stale-allowed：n + 1（原子 Lua；失败退化为普通写入）
        try {
            await db.eval(CLEAR_INCR_LUA, 1, CacheKey.value(key));
        } catch {
            const newPayload = serializeCacheValue(v.d, v.t, true, (v.n ?? 0) + 1);
            const ttlSec = await db.ttl(CacheKey.value(key));
            if (ttlSec > 0) {
                await db.set(CacheKey.value(key), newPayload, 'EX', ttlSec);
            } else {
                await db.set(CacheKey.value(key), newPayload);
            }
        }
        cacheLog(`${key} clear → n+1`);
    } else {
        // Purge：直接删缓存值
        await db.del(CacheKey.value(key));
        cacheLog(`${key} purged!`);
    }
    // 清理旧格式残留
    // await db.del(`[cache-meta]${key}`);       // 清理旧格式残留

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
 * 清理指定 key 的缓存。支持两种模式：
 *
 * **直接清理** — 传入具体缓存 key：
 * - Purge 模式（sa=0）：物理删除缓存
 * - Stale 模式（sa=1）：保留旧值，n 计数器 +1，后续请求读到 stale 数据并触发后台刷新
 *
 * **级联清理** — 传入 clearKey（关联清除 key）：
 * - 遍历所有注册了该 clearKey 的缓存，逐个执行上述清理逻辑
 *
 * @example <caption>直接清理某个缓存</caption>
 * ```ts
 * // Purge 模式：删除缓存，下次请求执行 fn 重建
 * await clearMethodCache(`user-${userId}`);
 *
 * // Stale 模式：保留旧值 + 标记过期，后台异步刷新
 * await clearMethodCache(`match-${matchId}`);
 * ```
 *
 * @example <caption>级联清理 — 清理所有关联了某 clearKey 的缓存</caption>
 * ```ts
 * // 假设以下缓存都注册了 clearKey: ['match']
 * //   - match-${id}
 * //   - match-timer-${id}
 * //   - match-stat-${id}
 *
 * // 一次调用清理所有
 * await clearMethodCache('match');
 * ```
 */
export async function clearMethodCache(key: string) {
    const redisDao = globalThis[_dao]?.[DBType.Redis]?.[_primaryDB];
    if (!redisDao) return;
    await clearCacheKey(key);
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
 * 命中时若发现 stale 标志（CacheValue.s=1），说明该值是"已被声明过期但保留的旧值"，
 * 此时仍返回旧值（零阻塞），同时触发后台 single-flight 异步刷新。
 * 这样 clearMethodCache 后的首次读取不会被阻塞，后续读取将命中刷新后的新值。
 *
 * redis 不可用或 SETNX 异常时退化为无锁直跑，保留可用性。
 */
const SINGLEFLIGHT_LOCK_TTL_MS = 30_000;        // 首飞标记 TTL，兜底首飞挂掉的情况
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
     * StaleWhileRevalidate 时，设 sa=1 使 clearMethodCache 对该 key 走"标记 stale + 保留旧值"路径。
     * 未指定时沿用旧值的 sa（不会清除已有标志）。
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
     *     async onCacheUpdated(this: MyService, value, args) {
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
 * Lua 脚本：clear —— 原子 n+1（保留旧值和 TTL）。
 * 返回新 n 值；-1 表示 key 不存在或不是 sa。
 */
const CLEAR_INCR_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return -1 end
local ok, val = pcall(cjson.decode, raw)
if not ok then return -1 end
if not val.sa then return -1 end
val.n = (tonumber(val.n) or 0) + 1
local ttl = redis.call('TTL', KEYS[1])
if ttl > 0 then
    redis.call('SET', KEYS[1], cjson.encode(val), 'EX', ttl)
else
    redis.call('SET', KEYS[1], cjson.encode(val))
end
return val.n
`;

/**
 * Lua 脚本：refresh 完成 —— 原子读当前 n、写新数据、n-1。
 * 返回 [newN, status]：status=1 成功，-1 不存在，-2 非 sa。
 *
 * KEYS[1] = cache key
 * ARGV[1] = 新数据的原始 JSON 字符串（将作为 CacheValue.d）
 * ARGV[2] = TTL 秒数（0 表示保持原 TTL）
 * ARGV[3] = 当前时间戳（毫秒，将作为 CacheValue.t）
 */
const REFRESH_DECR_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {-2, 0} end
local ok, val = pcall(cjson.decode, raw)
if not ok then return {-2, 0} end
if not val.sa then return {-1, 0} end
local n = tonumber(val.n) or 0
local newN = math.max(0, n - 1)
-- 重建统一格式 {t, d, sa, n?}
local newData = {
    t = tonumber(ARGV[3]) or 0,
    d = ARGV[1],
    sa = val.sa
}
if newN > 0 then newData.n = newN end
local ttl = tonumber(ARGV[2]) or 0
if ttl > 0 then
    redis.call('SET', KEYS[1], cjson.encode(newData), 'EX', ttl)
else
    redis.call('SET', KEYS[1], cjson.encode(newData))
end
return {newN, 1}
`;

/**
 * 后台异步刷新：fire-and-forget，不阻塞调用方。
 * 只有抢到首飞标记的实例才会执行 fn() 并写缓存；其它实例直接放弃。
 * 刷新完成后 n - 1；若 n 仍 > 0，说明刷新期间又有人 clear，继续下一轮刷新。
 */
/** setOpts 类型：传递给 setMethodCache 的 */
interface SetMethodCacheOpts {
    clearKey?: string[];
    autoClearTime?: number;
    cacheNullValue?: boolean;
    nullCacheTime?: number;
    staleMode?: CacheStaleMode;
    staleAllowedOverride?: boolean;
}

async function staleBackgroundRefresh<T>(opts: CacheCoreOpts<T>, setOpts: SetMethodCacheOpts): Promise<void> {
    const db = getRedisDB();
    const sfKey = CacheKey.sf(opts.key);
    try {
        const locked = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
        if (locked !== 'OK') return;
    } catch { return; }
    try {
        cacheLog(`${opts.key} refresh start...`);
        const result = await opts.fn();
        // 序列化新数据（不含 n）
        const rawData = (result === null || result === undefined) ? 'null' : JSON.stringify(result);
        const ttlSec = await db.ttl(CacheKey.value(opts.key));
        // 原子地写新数据 + n-1（Lua 脚本内完成）
        let r: unknown;
        try {
            r = await db.eval(REFRESH_DECR_LUA, 1, CacheKey.value(opts.key), rawData, String(Math.max(0, ttlSec)), String(Date.now()));
        } catch {
            return;
        }
        const [newN, status] = (r as [number, number]) ?? [0, 0];
        if (status === -2 || status === -1) {
            cacheLog(`${opts.key} refresh skipped (status=${status})`);
        } else {
            cacheLog(`${opts.key} refresh done (n → ${newN})`);
            void opts.onCacheUpdated?.call(opts.ctx, result, ...(opts.args ?? []));
            // n > 0 → 刷新期间又被 clear，继续下一轮刷新
            if (newN > 0 && !globalStaleInflight.has(opts.key)) {
                globalStaleInflight.set(opts.key, staleBackgroundRefresh(opts, setOpts).finally(() => {
                    globalStaleInflight.delete(opts.key);
                }));
            }
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        (globalThis[_LoggerService]! as LoggerService).warn?.(`cache ${opts.key} background refresh failed: ${msg}`);
    } finally {
        try { await db.del(sfKey); } catch { /* TTL 兜底 */ }
    }
}

/**
 * 执行一个带缓存的方法。先查缓存 → 命中直接返回；未命中则加锁执行 fn 并缓存结果。
 *
 * 支持三种缓存策略（通过 `staleMode` 切换）：
 * - **Purge**（默认）：清理时物理删除缓存，下次请求阻塞执行 fn 重建
 * - **StaleWhileRevalidate**：清理时保留旧值 + 标记过期，后续请求零阻塞读到旧值，后台异步刷新
 *
 * 防击穿机制：
 * - 缓存 miss 时通过 `[cache-sf]key` 原子锁（SETNX）选出"首飞"执行 fn
 * - 其他并发请求轮询缓存，首飞写完后立即命中，避免重复执行 fn
 *
 * @example <caption>基础用法 — Purge 模式</caption>
 * ```ts
 * const result = await excuteWithCache({
 *     key: `user-${userId}`,
 *     autoClearTime: 60,             // 60分钟后自动过期
 *     cacheNullValue: true,          // null 也缓存（防穿透）
 * }, () => loadUserFromDB(userId));
 * ```
 *
 * @example <caption>Stale 模式 — 清理时保留旧值 + 后台刷新</caption>
 * ```ts
 * const result = await excuteWithCache({
 *     key: `match-${matchId}`,
 *     staleMode: CacheStaleMode.StaleWhileRevalidate,
 *     onCacheUpdated(value) {
 *         // 缓存刷新后触发：推送 WebSocket、预热下游等
 *         this.broadcast(value);
 *     },
 * }, () => computeMatchData(matchId));
 * ```
 *
 * @example <caption>cacheOnly — 只读缓存，不调用 fn</caption>
 * ```ts
 * const cached = await excuteWithCache({
 *     key: `config`,
 *     cacheOnly: true,               // 没有缓存返回 null，不执行 fn
 * }, () => loadConfig());
 * ```
 *
 * @example <caption>forceRefresh — 跳过缓存直接执行 fn</caption>
 * ```ts
 * const fresh = await excuteWithCache({
 *     key: `match-${id}`,
 *     forceRefresh: true,            // 忽略已有缓存，执行 fn 后写回（sa=0）
 * }, () => computeFreshData(id));
 * ```
 *
 * @example <caption>关联清除 — clearKey 级联清理</caption>
 * ```ts
 * const result = await excuteWithCache({
 *     key: `match-timer-${id}`,
 *     clearKey: ['match'],           // clearMethodCache('match') 时级联清除
 * }, () => computeTimer(id));
 *
 * // 清理所有关联了 'match' 的缓存
 * await clearMethodCache('match');
 * ```
 */
export async function excuteWithCache<T>(config: {
    key: ((...args: any[]) => string) | string;
    clearKey?: ((...args: any[]) => string[]) | string[];
    autoClearTime?: number;
    cacheNullValue?: boolean;
    nullCacheTime?: number;
    clearWithSession?: boolean;
    staleMode?: CacheStaleMode;
    onCacheUpdated?: (this: any, value: T, ...args: any[]) => void | Promise<void>;
    ctx?: any;
    args?: any[];
    devid?: string | false | undefined;
    /**
     * 只用缓存，绝不调用原始方法。无论缓存是否过期都直接返回；没有缓存则返回 null。
     */
    cacheOnly?: boolean;
    /**
     * 忽略已有缓存，直接调用原始方法并更新缓存（写回时 sa=0）。
     */
    forceRefresh?: boolean;
}, fn: () => Promise<T>): Promise<T> {
    const callArgs = config.args ?? [];
    const key = typeof config.key === 'function' ? config.key(...callArgs) : config.key;
    const clearKey = typeof config.clearKey === 'function' ? config.clearKey(...callArgs) : config.clearKey;
    const { autoClearTime, cacheNullValue, nullCacheTime, staleMode, onCacheUpdated, ctx, devid, cacheOnly, forceRefresh } = config;

    const db = getRedisDB();
    const cacheKey = CacheKey.value(key);

    /**
     * cache命中后：检查是否 stale→触发后台刷新；最终返回缓存值（新鲜或过期均可）。
     * 单一 keep 变量名：`v` 代表当前缓存值（类型 CacheValue）。
     */
    const readAndMaybeRefresh = async (): Promise<T | null> => {
        const raw = await db.get(cacheKey);
        if (raw === null) return null;
        const v = deserializeCacheValue(raw);
        if (!cacheOnly) {
            // 有未消耗的 clear 计数（n>0）且刷新尚未运行 → 触发后台刷新
            if ((v.n ?? 0) > 0 && !globalStaleInflight.has(key)) {
                const refreshOpts: CacheCoreOpts<T> = { key, clearKey, autoClearTime, cacheNullValue, nullCacheTime, staleMode, fn, ctx, args: callArgs, onCacheUpdated };
                const refreshSetOpts: SetMethodCacheOpts = { clearKey, autoClearTime, cacheNullValue, nullCacheTime, staleMode };
                const refreshP = staleBackgroundRefresh(refreshOpts, refreshSetOpts).finally(() => {
                    globalStaleInflight.delete(key);
                });
                globalStaleInflight.set(key, refreshP);
            }
            cacheLog(`${key} hit (${(v.n ?? 0) > 0 ? `stale n=${v.n}` : 'purge'})`);
        } else {
            cacheLog(`${key} hit (cacheOnly)`);
        }
        return JSON.parse(v.d);
    };

    // forceRefresh：跳过缓存读取，直接走执行路径
    if (!forceRefresh) {
        const cached = await readAndMaybeRefresh();
        if (cached !== null) return cached as T;
        if (cacheOnly) return null as T;
        cacheLog(`${key} miss!`);
    } else {
        cacheLog(`${key} force refresh start`);
    }

    // forceRefresh 写回时强制 sa=0；其他情况按 staleMode/旧值自动判断
    const setOpts = { clearKey, autoClearTime, cacheNullValue, nullCacheTime, staleMode, staleAllowedOverride: forceRefresh ? false : undefined };
    const sfKey = CacheKey.sf(key);
    let isLeader = false;
    try {
        const ok = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
        isLeader = ok === 'OK';
    } catch {
        const result = await fn();
        await setMethodCache({ key, ...setOpts, result }, devid);
        void onCacheUpdated?.call(ctx, result, ...callArgs);
        cacheLog(`${key} force refresh end(error-force)`);
        return result;
    }

    if (isLeader) {
        try {
            const result = await fn();
            await setMethodCache({ key, ...setOpts, result }, devid);
            void onCacheUpdated?.call(ctx, result, ...callArgs);
            cacheLog(`${key} force refresh end(leader)`);
            return result;
        } finally {
            try { await db.del(sfKey); } catch { /* TTL 兜底 */ }
        }
    }

    const waitStart = Date.now();
    while (true) {
        await sleep(SINGLEFLIGHT_POLL_INTERVAL_MS);
        const recheck = await db.get(cacheKey);
        if (recheck !== null) {
            const v = deserializeCacheValue(recheck);
            // 拿到数据后二次检查：若仍 stale（刷新期间又被 clear），触发下一轮刷新
            if ((v.n ?? 0) > 0 && !globalStaleInflight.has(key)) {
                const refreshOpts: CacheCoreOpts<T> = { key, clearKey, autoClearTime, cacheNullValue, nullCacheTime, staleMode, fn, ctx, args: callArgs, onCacheUpdated };
                const refreshSetOpts: SetMethodCacheOpts = { clearKey, autoClearTime, cacheNullValue, nullCacheTime, staleMode };
                globalStaleInflight.set(key, staleBackgroundRefresh(refreshOpts, refreshSetOpts).finally(() => {
                    globalStaleInflight.delete(key);
                }));
            }
            cacheLog(`${key} hit after wait!`);
            return JSON.parse(v.d);
        }
        const leaderGone = await db.get(sfKey);
        if (leaderGone === null) {
            const taken = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
            if (taken === 'OK') {
                cacheLog(`${key}: previous leader gone, taking over`);
                try {
                    const result = await fn();
                    await setMethodCache({ key, ...setOpts, result }, devid);
                    cacheLog(`${key} force refresh end(leader gone)`);
                    void onCacheUpdated?.call(ctx, result, ...callArgs);
                    return result;
                } finally {
                    try { await db.del(sfKey); } catch { /* TTL 兜底 */ }
                }
            }
        }
        if (Date.now() - waitStart > SINGLEFLIGHT_MAX_WAIT_MS) {
            // 超时后重新抢锁（新一轮领导选举），而非直接跑 fn 导致雪崩
            const retry = await db.set(sfKey, '1', 'PX', SINGLEFLIGHT_LOCK_TTL_MS, 'NX');
            if (retry === 'OK') {
                cacheLog(`${key}: wait timed out, re-elected as leader`);
                try {
                    const result = await fn();
                    await setMethodCache({ key, ...setOpts, result }, devid);
                    void onCacheUpdated?.call(ctx, result, ...callArgs);
                    return result;
                } finally {
                    try { await db.del(sfKey); } catch { /* TTL 兜底 */ }
                }
            }
            // 没抢到说明又有别人接手了，继续等
        }
    }
}

/**
 * 方法装饰器：为方法添加 Redis 缓存能力。
 *
 * 工作流程：
 * 1. 调用方法时先查 Redis 缓存
 * 2. 命中 → 直接返回缓存值（若 stale 则触发后台异步刷新）
 * 3. 未命中 → 原子锁（SETNX）选出"首飞"执行原方法 → 写缓存 → 返回
 * 4. 其他并发请求轮询缓存，首飞写完后立即命中
 *
 * @example <caption>基础用法 — Purge 模式（默认）</caption>
 * ```ts
 * @MethodCache({
 *     key: (userId: string) => `user-${userId}`,
 *     autoClearTime: 60,                // 60分钟后自动过期
 * })
 * async getUser(userId: string) {
 *     return await this.db.query(...);
 * }
 * ```
 *
 * @example <caption>Stale 模式 — 清理时保留旧值 + 后台刷新</caption>
 * ```ts
 * @MethodCache({
 *     key: (matchId: string) => `match-${matchId}`,
 *     staleMode: CacheStaleMode.StaleWhileRevalidate,
 *     onCacheUpdated(this: MyService, value) {
 *         // 缓存刷新后触发（this = 当前 service 实例）
 *         this.webSocket.broadcast(value);
 *     },
 * })
 * async getMatch(matchId: string) { ... }
 *
 * // 清理缓存 → 旧值保留，后台异步刷新
 * await clearMethodCache(`match-${id}`);
 * ```
 *
 * @example <caption>关联清除 — clearKey 级联清理</caption>
 * ```ts
 * @MethodCache({
 *     key: (matchId: string) => `match-timer-${matchId}`,
 *     clearKey: ['match'],              // 声明依赖关系
 *     staleMode: CacheStaleMode.StaleWhileRevalidate,
 * })
 * async getMatchTimer(matchId: string) { ... }
 *
 * // 清理所有关联了 'match' 的缓存（包括 match-timer-*）
 * await clearMethodCache('match');
 * ```
 *
 * @example <caption>cacheOnly — 只读缓存，绝不调用原方法</caption>
 * ```ts
 * @MethodCache({
 *     key: 'app-config',
 *     cacheOnly: true,                  // 没有缓存返回 null
 * })
 * async loadConfig() { ... }
 * ```
 */
export function MethodCache<T = any>(config: {
    /** 返回缓存key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来清空缓存。 */
    key: ((this: T, ...args: any[]) => string) | string;
    /** 返回缓存清除key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来批量清空缓存 */
    clearKey?: ((this: T, ...args: any[]) => string[]) | string[];
    /**
     * 自动清空缓存的时间，单位分钟。
     * ⚠️ 不能与 `staleMode: StaleWhileRevalidate` 同用：stale 仅标记过期，autoClearTime 会物理删除 key，语义冲突。
     */
    autoClearTime?: number;
    /** 是否缓存 null / undefined（负缓存防穿透），默认 false。 */
    cacheNullValue?: boolean;
    /** 负缓存 TTL（分钟），默认沿用 autoClearTime。 */
    nullCacheTime?: number;
    /** 随着当前用户sesion的清空而一起清空 */
    clearWithSession?: boolean;
    /**
     * 缓存被清理时的行为策略。默认 Purge。
     * StaleWhileRevalidate 时设 sa=1 使 clearMethodCache 走"标记 stale + 保留旧值"路径。
     */
    staleMode?: CacheStaleMode;
    /**
     * 缓存更新回调。异步方法，在 setMethodCache 成功写缓存后调用。
     * 调用时三个参数：this → 执行上下文；args → 方法输入参数；value → 缓存值。
     */
    onCacheUpdated?: (this: any, value: T, ...args: any[]) => void | Promise<void>;
    /**
     * 只用缓存，绝不调用原始方法。无论缓存是否过期都直接返回；没有缓存则返回  null。
     */
    cacheOnly?: boolean;
    /** 忽略已有缓存，直接调用原始方法并更新缓存（写回时 sa=0）。 */
    forceRefresh?: boolean;
}) {
    return function (_target: T, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn = descriptor.value;
        descriptor.value = async function (this: any, ...args: any[]) {
            const devid = config.clearWithSession && this.ctx && this.ctx.me && this.ctx.me.devid;
            return await excuteWithCache({
                key: config.key,
                clearKey: config.clearKey,
                autoClearTime: config.autoClearTime,
                cacheNullValue: config.cacheNullValue,
                nullCacheTime: config.nullCacheTime,
                staleMode: config.staleMode,
                onCacheUpdated: config.onCacheUpdated,
                cacheOnly: config.cacheOnly,
                forceRefresh: config.forceRefresh,
                ctx: this,
                devid,
                args,
            }, async () => await fn.call(this, ...args));
        };
    };
}

/**
 * 外部直接写入缓存（绕过 @MethodCache 装饰器）。
 *
 * 与 @MethodCache 共享同一套存储格式 `{ t, d, sa, n }`，写入的缓存可被
 * @MethodCache 装饰的方法正常读取（包括 stale 判断、计数器等）。
 *
 * 适用场景：
 * - 外部事件驱动的数据变更（如 MQ 消息、定时任务）
 * - 手动刷新缓存（如管理后台"清除并重建"按钮）
 * - 跨服务同步缓存状态
 *
 * @example <caption>基础用法 — 写入缓存</caption>
 * ```ts
 * await setCache('match-timer-123', timer, {
 *     autoClearTime: 120,          // 120分钟后过期
 * });
 * ```
 *
 * @example <caption>关联清除 — 注册 clearKey 级联关系</caption>
 * ```ts
 * await setCache('match-timer-123', timer, {
 *     autoClearTime: 120,
 *     clearKey: ['match'],         // clearMethodCache('match') 时级联清除
 * });
 *
 * // 函数式 clearKey（参数来自 options.args）
 * await setCache('match-timer-123', timer, {
 *     clearKey: (matchId) => [`match-${matchId}`],
 *     args: [matchId],
 * });
 * ```
 *
 * @example <caption>回调 — 缓存写入后触发通知</caption>
 * ```ts
 * await setCache('match-timer-123', timer, {
 *     autoClearTime: 120,
 *     ctx: this,
 *     args: [matchId],
 *     onCacheUpdated(value, matchId) {
 *         this.webSocket.sendRoom(matchId, { action: 'timer', param: value });
 *     },
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
        /** 关联清除 key。clearMethodCache(clearKey) 时级联清除本缓存。 */
        clearKey?: ((...args: any[]) => string[]) | string[];
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
        clearKey,
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
    const db = getRedisDB();
    // 保留旧 sa：沿用已有标志（防止外部直写清掉 sa=1，导致 clearMethodCache 变 purge）
    const existingSa = await db.get(CacheKey.value(cacheKey)).then(r => r ? deserializeCacheValue(r).sa : undefined);
    const payload = serializeCacheValue(dataStr, timestamp, !!existingSa);
    if (autoClearTime) {
        await db.set(CacheKey.value(cacheKey), payload, 'EX', autoClearTime * 60);
    } else {
        await db.set(CacheKey.value(cacheKey), payload);
    }

    // 注册关联清除关系（与 setMethodCache 一致）
    if (clearKey) {
        const clearKeys = typeof clearKey === 'function' ? clearKey(...args) : clearKey;
        if (clearKeys && clearKeys.length > 0) {
            for (const clear of clearKeys) {
                await db.sadd(CacheKey.parent(clear), cacheKey);
                await db.sadd(CacheKey.child(cacheKey), clear);
            }
        }
    }

    // 触发回调
    void onCacheUpdated?.call(ctx, value, ...args);

    cacheLog(`${cacheKey} externally set`);
}
