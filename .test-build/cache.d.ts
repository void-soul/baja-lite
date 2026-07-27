/**
 * 缓存被清理时的行为策略。
 * 由 @MethodCache 的 `staleMode` 配置决定，clearMethodCache 依此自动选择清理方式。
 */
export declare enum CacheStaleMode {
    /**
     * 默认。清理时直接删除缓存值，下次请求触发 single-flight 重建。
     * 优点：数据强一致，不会读到旧值。
     * 缺点：重建期间所有请求被阻塞，直到 fn() 执行完毕。
     */
    Purge = 0,
    /**
     * 清理时保留旧值并标记为过期（stale），同时设一个 stale 窗口（默认 30s）。
     * 窗口内：请求仍读到旧值（零阻塞），同时后台 single-flight 异步刷新。
     * 窗口过后：stale 标记自动消失，退化回 Purge 行为。
     *
     * 适用场景：读多写少、能容忍秒级旧数据、fn() 执行代价高。
     * 注意：开启后业务层可能收到乱序数据，需自行处理（如按时间戳丢弃过期包）。
     */
    StaleWhileRevalidate = 1
}
export declare function getRedisDB<T = any>(db?: string): T;
export declare function GetRedisLock(key: string, lockMaxActive?: number): Promise<boolean>;
/** 对FN加锁、缓存执行 */
export declare function excuteWithLock<T>(config: {
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
}, fn__: () => Promise<T>): Promise<T>;
/**
 * 方法加锁装饰器。
 * 与 `MethodCache` 组合时，**不要**手工叠装饰器——`MethodCache` 内部已经实现了
 * "先查缓存 → miss 才加锁 → 锁内二次检查 → 仍 miss 才执行" 的 single-flight 语义，
 * 直接给方法加 `@MethodCache` 即可。`@MethodLock` 单独使用时仅做并发互斥，不感知缓存。
 */
export declare function MethodLock<T = any>(config: {
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
}): (target: T, _propertyKey: string, descriptor: PropertyDescriptor) => void;
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
export declare function clearMethodCache(key: string): Promise<void>;
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
export declare function excuteWithCache<T>(config: {
    /** 返回缓存key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来清空缓存。 */
    key: ((...args: any[]) => string) | string;
    /** 返回缓存清除key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来批量清空缓存 */
    clearKey?: ((...args: any[]) => string[]) | string[];
    /**
     * 自动清空缓存的时间，单位分钟。
     * ⚠️ 不能与 `staleMode: StaleWhileRevalidate` 同用：stale 仅标记过期，autoClearTime 会物理删除 key，语义冲突。
     */
    autoClearTime?: number;
    /** 是否缓存 null / undefined（负缓存防穿透），默认 false。 */
    cacheNullValue?: boolean;
    /** 负缓存 TTL（分钟），默认沿用 autoClearTime。 */
    nullCacheTime?: number;
    /**
     * 随着当前用户sesion的清空而一起清空,需要业务系统配合,用户退出时通过
     * event 里的 trigger（devid）触发
     */
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
}, fn: () => Promise<T>): Promise<T>;
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
export declare function MethodCache<T = any>(config: {
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
    /**
     * 随着当前用户sesion的清空而一起清空,需要业务系统配合,用户退出时通过
     * event 里的 trigger（devid）触发
     */
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
}): (_target: T, _propertyKey: string, descriptor: PropertyDescriptor) => void;
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
export declare function setCache<T = any>(cacheKey: string, value: T, options?: {
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
}): Promise<void>;
