import { randomUUID } from 'node:crypto';
import { _dao, _EventBus, _LoggerService, _primaryDB } from './const/symbols.js';
import { DBType } from 'baja-lite-field';
import type { LoggerService } from './logger.js';

// ===== 常量 =====

/** Redis 事件频道前缀，完整频道名 = `[event]` + 事件名 */
const CHANNEL_PREFIX = '[event]';
/** PSubscribe 匹配模式 */
const SUBSCRIBE_PATTERN = `${CHANNEL_PREFIX}*`;
/** 当前进程 pid，用于过滤自身发出的 Redis 消息 */
const __pid = process.pid;

/** 是否已执行过 initEventSubscriber（模块级幂等标志） */
let _subscriberReady = false;
/** 订阅连接引用，用于优雅停机 */
let _subConn: any | null = null;

// ===== 类型 =====

interface EventBus {
    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    listenerCount(event: string): number;
    removeAllListeners(event?: string): this;
}

/** Redis Pub/Sub 消息载荷 */
interface RedisEventPayload {
    /** 事件参数（需可 JSON 序列化） */
    a: any[];
    /** 发布进程 pid，用于自过滤 */
    p: number;
    /** 关联 id，用于跨进程追踪 publish → deliver */
    id: string;
}

// ===== 内部工具 =====

function getEventBus(): EventBus {
    const bus = globalThis[_EventBus] as EventBus | undefined;
    if (!bus) {
        const logger = globalThis[_LoggerService] as LoggerService | undefined;
        logger?.warn?.('event-bus not initialized, did you forget to call boot()?');
        throw new Error('EventBus not initialized. Please ensure boot() has been called before using event methods.');
    }
    return bus;
}

function getLogger(): LoggerService | undefined {
    return globalThis[_LoggerService] as LoggerService | undefined;
}

function getRedis(): any | undefined {
    try {
        return globalThis[_dao]?.[DBType.Redis]?.[_primaryDB];
    } catch {
        return undefined;
    }
}

/**
 * 将参数序列化为 Redis 消息。
 *
 * Function / Symbol / 不可 JSON 序列化的值会被替换为 null，并输出 debug 日志以便排查
 * 跨进程数据传输时的静默数据丢失。
 */
function safeArgs(args: any[]): any[] {
    return args.map((v, i) => {
        if (typeof v === 'function' || typeof v === 'symbol') {
            eventLog(`event arg[${i}] dropped: non-serializable (${typeof v})`);
            return null;
        }
        try {
            JSON.stringify(v);
            return v;
        } catch {
            eventLog(`event arg[${i}] dropped: circular/non-serializable`);
            return null;
        }
    });
}

/** 构造 Redis 消息（带关联 id） */
function packPayload(args: any[]): string {
    return JSON.stringify({ a: safeArgs(args), p: __pid, id: randomUUID() } satisfies RedisEventPayload);
}

/**
 * 原始监听器 → 内部 wrapper 的映射。
 * - 普通监听器：wrapper 负责隔离异常，确保单个监听器抛错不影响 emit 循环与其他监听器
 * - once 监听器：wrapper 额外负责首次触发后自动移除
 * 用于让 `off(event, originalListener)` 能按原始引用移除（无论是否 once）。
 */
const _wrappers = new WeakMap<(...args: any[]) => void, (...args: any[]) => void>();

/** 包装监听器，隔离其异常：抛错只记录日志，不中断 emit 循环 */
function safeWrap(event: string, listener: (...args: any[]) => void): (...args: any[]) => void {
    return (...args: any[]) => {
        try {
            return listener(...args);
        } catch (e: any) {
            getLogger()?.error?.(`event ${event} listener threw: ${e?.message ?? e}`);
        }
    };
}

// ===== 类型 =====

/** on() 的选项 */
interface OnOptions {
    /**
     * 设为 true 后，若该事件名下已有注册的监听器，则跳过本次注册。
     * 适用于在热点路径中反复调用 on()、不希望重复注册的场景。
     *
     * 注意：检查与注册之间无 `await`，因此在 Node.js 单线程模型下是原子的；
     * 若未来在两者之间引入异步，需重新评估去重安全性（TOCTOU）。
     */
    unique?: boolean;
    /**
     * 设为 true 后，监听器触发一次后自动移除（标准 EventEmitter.once 语义）。
     */
    once?: boolean;
}

/** trigger() 的选项 */
interface TriggerOptions {
    /**
     * 是否在进程内 emit。默认 true。
     */
    local?: boolean;
    /**
     * 是否通过 Redis 广播到其他进程。默认 true。
     * 无 Redis 连接时静默跳过。
     */
    remote?: boolean;
}

// ===== 公共 API =====

/**
 * 注册事件监听器（进程级 + 跨进程）。
 *
 * 当前进程内通过 `trigger` 触发，或从同一 Redis 集群的其他进程广播而来，
 * 均会调起此 listener。
 *
 * @param event       - 事件名
 * @param listener    - 回调函数
 * @param opts.unique - true 时若该事件已有监听器则跳过注册（防止热点路径中重复注册）
 * @param opts.once   - true 时触发一次后自动移除（标准 once 语义）
 *
 * @remarks 用 `off(event, listener)` 即可按原始引用移除 `once` 监听器。
 *
 * @example
 * ```ts
 * import { on } from 'baja-lite/event';
 *
 * // 普通注册（每次调用都会新增一个 listener）
 * on('user-login', (uid: string, ts: number) => {
 *     console.log(`用户 ${uid} 在 ${ts} 登录`);
 * });
 *
 * // 唯一注册（热点路径中多次调用也只注册一次）
 * on('cache-cleared', handler, { unique: true });
 *
 * // 仅触发一次后自动移除
 * on('ready', () => console.log('只执行一次'), { once: true });
 * ```
 */
export function on(event: string, listener: (...args: any[]) => void, opts?: OnOptions): void {
    const bus = getEventBus();
    if (opts?.unique && bus.listenerCount(event) > 0) {
        eventLog(`event ${event} already has listener, skip register`);
        return;
    }

    const safe = safeWrap(event, listener);
    if (opts?.once) {
        const onceWrapper = (...args: any[]) => {
            _wrappers.delete(listener);
            bus.off(event, onceWrapper);
            safe(...args);
        };
        _wrappers.set(listener, onceWrapper);
        bus.on(event, onceWrapper);
        eventLog(`event ${event} registered as once`);
    } else {
        _wrappers.set(listener, safe);
        bus.on(event, safe);
        eventLog(`event ${event} registered`);
    }
}

/**
 * 移除事件监听器。
 *
 * - 传入 `listener` → 移除指定监听器（必须与注册时引用一致，含 `once` 监听器）
 * - 不传 `listener` → 移除该事件下的全部监听器
 *
 * @example
 * ```ts
 * import { on, off } from 'baja-lite/event';
 *
 * const handler = (uid: string) => console.log(uid);
 * on('user-login', handler);
 *
 * // 移除指定监听器（once 监听器同样可用原引用移除）
 * off('user-login', handler);
 *
 * // 移除该事件下所有监听器
 * off('user-login');
 * ```
 */
export function off(event: string, listener?: (...args: any[]) => void): void {
    const bus = getEventBus();
    if (listener) {
        // 解析为内部 wrapper 再移除（once / 普通都适用）
        const target = _wrappers.get(listener) ?? listener;
        _wrappers.delete(listener);
        bus.off(event, target);
        eventLog(`event ${event} listener removed`);
    } else {
        bus.removeAllListeners(event);
        eventLog(`event ${event} all listeners removed`);
    }
}

/**
 * 触发事件。
 *
 * 通过 `opts` 控制广播范围：
 * - `undefined`（默认）— 进程内 + 跨进程
 * - `{ local: true }` — 仅本进程
 * - `{ remote: true, local: false }` — 仅 Redis 广播到其他进程
 *
 * @remarks
 * **投递语义（重要）：** Redis 发布为 at-most-once / 非持久。进程重启（订阅尚未就绪）、
 * Redis failover 或网络抖动期间，跨进程事件可能**静默丢失**，无重投、无死信。
 * 仅适合"事件通知"类场景；对必须送达的业务事件（如订单支付），请使用持久队列。
 *
 * `args` 必须为数组；传入非数组会抛出 `TypeError`。跨进程广播时参数需可 JSON 序列化
 * （Function / Symbol / 循环引用会被替换为 null，并在 debug 日志中提示）。
 *
 * @param event - 事件名
 * @param args  - 传给监听器的参数数组（可选）
 * @param opts  - 控制广播范围
 * @returns 进程内是否有 listener
 *
 * @example
 * ```ts
 * import { on, trigger } from 'baja-lite/event';
 *
 * // PM2 4 进程全都收到
 * trigger('order-paid', [orderId, amount]);
 *
 * // 仅本进程
 * trigger('timer-tick', [Date.now()], { remote: false });
 *
 * // 仅通知其他进程
 * trigger('cache-invalidated', ['user-list'], { local: false });
 *
 * // 无参数（默认全广播）
 * trigger('reload-config');
 * ```
 */
export function trigger(event: string, args?: any[], opts?: TriggerOptions): boolean {
    if (args !== undefined && !Array.isArray(args)) {
        throw new TypeError('trigger(event, args): args must be an array');
    }
    const a = args ?? [];
    const local = opts?.local ?? true;
    const remote = opts?.remote ?? true;

    if (remote) {
        const redis = getRedis();
        if (redis) {
            redis.publish(`${CHANNEL_PREFIX}${event}`, packPayload(a)).catch((err: any) => {
                getLogger()?.warn?.(`event publish "${event}" failed: ${err?.message ?? err}`);
            });
            eventLog(`event ${event} published to remote`);
        } else {
            eventLog(`event ${event} can't publish because redis is not configured`);
        }
    }

    if (local) {
        eventLog(`event ${event} emitted to local`);
        return getEventBus().emit(event, ...a);
    }
    return false;
}

/**
 * 初始化 Redis 事件订阅桥接器。
 *
 * 在 `boot()` 之后、Redis 连接就绪时由 boot 自动调用一次（也可手动调用，幂等）。
 * 若未连接 Redis，调用无副作用；若初始化失败，会重置幂等标志允许重试。
 *
 * **工作原理：**
 * - 通过 `redis.duplicate()` 创建独立订阅连接（不影响主连接的命令操作），连接被模块持有以便停机时关闭
 * - 使用 `psubscribe` 订阅所有 `[event]*` 频道
 * - 收到消息后校验 `__pid`：跳过自身发布的消息（本进程已通过本地 emit 处理）
 * - 其余消息 deserialize 后 emit 到本地 EventBus（监听器异常被隔离，不会中断订阅）
 *
 * @remarks 重复调用本函数始终是安全的（由 `_subscriberReady` 保护，仅首次真正订阅）。
 * 若需在测试/HMR 中重新初始化，先调用 `closeEventSubscriber()`。
 */
export async function initEventSubscriber(): Promise<void> {
    if (_subscriberReady) return;
    _subscriberReady = true;

    const redis = getRedis();
    if (!redis) {
        getLogger()?.error?.('event subscriber: Redis not configured, skip');
        return;
    }

    try {
        // duplicate() 基于同一套连接参数创建新实例，用于 subscribe 模式
        const sub: any = typeof redis.duplicate === 'function'
            ? redis.duplicate()
            : redis;
        _subConn = sub;

        sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
            eventLog(`event ${channel} received`);
            try {
                const payload = JSON.parse(message) as RedisEventPayload;
                const msgId = payload.id ?? 'unknown';

                // 跳过自己发出去的消息（本进程已通过本地 emit 处理）
                if (typeof payload.p !== 'number') {
                    getLogger()?.warn?.(`event ${channel} malformed payload.p, treat as remote (id=${msgId})`);
                } else if (payload.p === __pid) {
                    return;
                }

                // 校验频道前缀与事件名（防御畸形频道）
                if (!channel.startsWith(CHANNEL_PREFIX)) return;
                const event = channel.slice(CHANNEL_PREFIX.length);
                if (!event) return;

                // 校验 payload.a 为数组（畸形消息不会污染本地 EventBus）
                if (!Array.isArray(payload.a)) {
                    getLogger()?.warn?.(`event ${channel} malformed payload.a, skip deliver (id=${msgId})`);
                    return;
                }

                try {
                    getEventBus().emit(event, ...payload.a);
                    eventLog(`event ${event} delivered local`, { id: msgId, remote: true });
                } catch (e: any) {
                    // 监听器异常已由 on() 的 wrapper 隔离，这里仅捕获 emit 机制自身错误
                    getLogger()?.error?.(`event ${event} emit failed (id=${msgId}): ${e?.message ?? e}`);
                }
            } catch {
                // 反序列化失败，静默丢弃
                getLogger()?.warn?.(`event ${channel} deserialize failed, skip`);
            }
        });

        await sub.psubscribe(SUBSCRIBE_PATTERN);
        getLogger()?.info?.('event subscriber: Redis bridge ready');
    } catch (err: any) {
        getLogger()?.error?.(`event subscriber init failed: ${err?.message ?? err}`);
        _subscriberReady = false; // 允许重试
        _subConn = null;
    }
}

/**
 * 关闭 Redis 事件订阅桥接器（优雅停机用）。
 *
 * 取消订阅并断开由 `initEventSubscriber` 创建的订阅连接。调用后进程不再接收跨进程事件。
 * 可配合 `initEventSubscriber()` 在测试/HMR 场景重新初始化。
 */
export async function closeEventSubscriber(): Promise<void> {
    if (_subConn) {
        try { await _subConn.punsubscribe?.(SUBSCRIBE_PATTERN); } catch { /* noop */ }
        try { await _subConn.disconnect?.(); } catch { /* noop */ }
        _subConn = null;
    }
    _subscriberReady = false;
}

/** @internal 输出 event 分类日志（仅当 setLogLevels 包含 'event' 时生效） */
function eventLog(message: string, ...params: any[]): void {
    getLogger()?.debugCategory?.('event', message, ...params);
}
