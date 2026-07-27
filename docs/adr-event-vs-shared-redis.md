# ADR-0001: 缓存失效靠共享 Redis，事件仅作跨进程通知

**状态：** 已采纳
**日期：** 2026-07-27
**相关代码：** `src/cache.ts`、`src/event.ts`、`src/boot.ts`

## 背景

baja-lite 的缓存（`setMethodCache` / `excuteWithCache` / `setCache`）在 PM2 多进程下运行。
系统同时存在两套机制：

1. **共享 Redis 存储**：缓存数据落在 Redis 上，所有进程读同一份。
2. **EventBus（`src/event.ts`）**：进程内 `EventEmitter` + 可选的 Redis pub/sub 跨进程桥接。

此外 `cache.ts` 中有一处 `on('user-${devid}', ...)` 的**事件监听器注册**，但从未被任何内部代码触发。

## 决策

**缓存失效（cache invalidation）的权威来源是共享 Redis，而非 EventBus 事件。**

- 内部清理入口 `clearMethodCache(key)` → `clearCacheKey(key)` 直接操作 Redis：
  - 通过 Redis SET（`[cache-p]<key>`）维护 parent→child 关系，级联清除所有受影响的缓存键；
  - 因为 Redis 是共享存储，一次清除对所有进程即时生效（每个进程读到的都是已失效的数据）。
- EventBus 的跨进程事件（Redis pub/sub）被定位为**事件通知（notification）**：
  - at-most-once / 非持久，进程重启或 Redis failover 期间事件可能静默丢失；
  - 适合"某进程主动广播让其他进程做点事"的辅助场景，**不适合**作为缓存失效的可靠传输。
- `cache.ts` 中的 `on('user-${devid}', ...)` 是**外部触发钩子**：由业务系统调用
  `trigger('user-${devid}', [key], { local: false })` 主动清理某进程缓存，属于补充手段，
  而非系统内部调用路径。若无外部触发，该监听闲置但无害。

## 理由

- 依赖共享 Redis 做失效，正确性由存储层保证，不受 pub/sub 投递语义影响；
- 若把缓存失效完全押在 pub/sub 上，会引入"事件丢失即脏缓存"的可靠性风险；
- 业务系统确实可能需要"按 devid 主动广播清理"的能力，事件钩子正好满足，且不干扰存储层。

## 后果

- 新增业务事件时，若要求必须送达（如订单支付），**必须**使用持久队列，不能依赖 `trigger` 的 Redis pub/sub；
- 维护者应清楚：`trigger(event, args, { local: false })` 发布的跨进程事件可能丢失，仅用于通知；
- 不要在 `cache.ts` 内新增依赖 EventBus 才能完成的缓存失效逻辑；跨进程失效默认走 Redis。
