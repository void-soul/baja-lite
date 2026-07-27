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
export declare function on(event: string, listener: (...args: any[]) => void, opts?: OnOptions): void;
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
export declare function off(event: string, listener?: (...args: any[]) => void): void;
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
export declare function trigger(event: string, args?: any[], opts?: TriggerOptions): boolean;
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
export declare function initEventSubscriber(): Promise<void>;
/**
 * 关闭 Redis 事件订阅桥接器（优雅停机用）。
 *
 * 取消订阅并断开由 `initEventSubscriber` 创建的订阅连接。调用后进程不再接收跨进程事件。
 * 可配合 `initEventSubscriber()` 在测试/HMR 场景重新初始化。
 */
export declare function closeEventSubscriber(): Promise<void>;
export {};
