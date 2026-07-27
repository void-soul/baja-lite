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

/** 是否已执行过 initEventSubscriber */
let _subscriberReady = false;

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
    a: any[];
    p: number;
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

/** 将参数序列化为 Redis 消息（Function/Symbol 替换为 null，JSON 无法序列化的值跳过） */
function safeArgs(args: any[]): any[] {
    return args.map(v => {
        if (typeof v === 'function' || typeof v === 'symbol') return null;
        try { JSON.stringify(v); return v; } catch { return null; }
    });
}

/** 构造 Redis 消息 */
function packPayload(args: any[]): string {
    return JSON.stringify({ a: safeArgs(args), p: __pid } satisfies RedisEventPayload);
}

// ===== 类型 =====

/** on() 的选项 */
interface OnOptions {
    /**
     * 设为 true 后，若该事件名下已有注册的监听器，则跳过本次注册。
     * 适用于在热点路径中反复调用 on()、不希望重复注册的场景。
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

    if (opts?.once) {
        const wrapper = (...args: any[]) => {
            bus.off(event, wrapper);
            listener(...args);
        };
        bus.on(event, wrapper);
        eventLog(`event ${event} registered as once`);
    } else {
        bus.on(event, listener);
        eventLog(`event ${event} registered`);
    }
}

/**
 * 移除事件监听器。
 *
 * - 传入 `listener` → 移除指定监听器（必须与注册时引用一致）
 * - 不传 `listener` → 移除该事件下的全部监听器
 *
 * @example
 * ```ts
 * import { on, off } from 'baja-lite/event';
 *
 * const handler = (uid: string) => console.log(uid);
 * on('user-login', handler);
 *
 * // 移除指定监听器
 * off('user-login', handler);
 *
 * // 移除该事件下所有监听器
 * off('user-login');
 * ```
 */
export function off(event: string, listener?: (...args: any[]) => void): void {
    const bus = getEventBus();
    if (listener) {
        bus.off(event, listener);
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
 * Redis 发布是 fire-and-forget，返回值仅反映**本进程**是否有监听器。
 * 跨进程广播时参数需可 JSON 序列化（Function / Symbol 会被替换为 null）。
 *
 * @param event - 事件名
 * @param args  - 传给监听器的参数数组
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
 * 应在 `boot()` 完成后调用一次（多次调用安全，仅首次生效）。
 * 若未连接 Redis，调用无副作用。
 *
 * **工作原理：**
 * - 通过 `redis.duplicate()` 创建独立订阅连接（不影响主连接的命令操作）
 * - 使用 `psubscribe` 订阅所有 `[event]*` 频道
 * - 收到消息后校验 `__pid`：跳过自身发布的消息（本进程已通过本地 emit 处理）
 * - 其余消息 deserialize 后 emit 到本地 EventBus
 *
 * @example
 * ```ts
 * import { boot } from 'baja-lite';
 * import { initEventSubscriber } from 'baja-lite/event';
 *
 * await boot({ ... });
 * await initEventSubscriber();
 * ```
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

        sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
            eventLog(`event ${channel} received`);
            try {
                const payload = JSON.parse(message) as RedisEventPayload;
                // 跳过自己发出去的消息（本进程已通过本地 emit 处理）
                if (payload.p === __pid) return;

                // 从频道名提取原始事件名：`[event]user-login` → `user-login`
                const event = channel.slice(CHANNEL_PREFIX.length);
                getEventBus().emit(event, ...(payload.a ?? []));
                eventLog(`event ${event} emitted to local by redis remote`);
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
    }
}

/** @internal 输出缓存分类日志（仅当 setLogLevels 包含 'cache' 时生效） */
function eventLog(message: string, ...params: any[]) {
    const logger = globalThis[_LoggerService]! as LoggerService;
    // pino-pretty 的 messageFormat 会根据 level=24 自动添加 [CACHE] 前缀
    (logger as any).debugCategory?.('event', message, ...params);
}
