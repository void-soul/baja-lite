# Audit Report — baja-lite Event System

**Scope:** `src/event.ts` and its integration points in `src/cache.ts` (`on` registrations) and `src/boot.ts` (`initEventSubscriber` auto-call).
**Method:** 7-dimension sequential audit (Security, Concurrency, Observability, Data, API Contracts, Engineering, Defensive).
**Date:** 2026-07-27

## Summary

The event module is a clean façade over a process-local `EventEmitter` plus an optional Redis pub/sub bridge for cross-process broadcast. The design is sound, but it has one **HIGH-severity API contract bug** (`off` cannot remove `once` listeners), several **MEDIUM** resilience/observability gaps, and is **untested**. The cache-invalidation events registered in `cache.ts` are dead code — invalidation actually relies on shared Redis storage, not the EventBus.

### Severity tally
| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 2 | D5-F2, D6-F1 |
| MEDIUM | 11 | D1-F1, D2-F2, D2-F5, D3-F1, D3-F2, D3-F4, D4-F2, D5-F1, D6-F2, D6-F4, D6-F6, D7-F1 |
| LOW | 6 | D1-F2, D2-F1, D4-F1, D4-F3, D5-F5, D7-F2, D7-F4 |

---

## D1 — Security
- **D1-F1 (MEDIUM)** `event.ts:281` — `getEventBus().emit(event, ...(payload.a ?? []))`. `payload.a` is `as`-cast to `any[]` but never runtime-validated. A forged/malformed Redis message with `a` as a non-array (object/string/number) makes `...payload.a` throw (non-iterable spread). The error surfaces inside the redis client's `pmessage` callback, is swallowed by the client, the event is silently lost, and the subscriber may spam errors. **Fix:** guard `Array.isArray(payload.a)` before spread.
- **D1-F2 (LOW)** `event.ts:58-63` — `safeArgs` silently replaces non-serializable values (functions, symbols, circular refs) with `null`. Caller has no signal that data was dropped before cross-process publish. **Fix:** emit a `debug` log naming the dropped argument index/type.

## D2 — Concurrency
- **D2-F1 (LOW)** `event.ts:129` — `unique` dedup is check-then-act on `listenerCount`. Safe in Node's single-threaded model (no `await` between the check and `bus.on`), but the assumption should be documented so a future async refactor doesn't introduce a TOCTOU double-registration.
- **D2-F2 (MEDIUM)** `event.ts:268-270` — `redis.duplicate()` creates a subscriber connection that is never stored or closed. On repeated `boot()` (HMR / tests / PM2 reload) a new connection leaks each time, and there is no shutdown path. **Fix:** keep the `sub` reference at module scope; add `closeEventSubscriber()` invoked on shutdown; reuse a single connection.
- **D2-F5 (MEDIUM)** `event.ts:281` — `emit` inside `pmessage` is not wrapped. A listener that throws synchronously propagates into the redis client's callback and can break the subscriber loop. (See D3-F1.)

## D3 — Observability
- **D3-F1 (MEDIUM)** `event.ts:281` — same as D2-F5: listener exceptions in the subscribe path are not isolated; one bad listener can take down all remote-event delivery. **Fix:** wrap `emit` in `try/catch`, log with event name + pid.
- **D3-F2 (MEDIUM)** — No correlation/trace id linking a `trigger` publish to its remote delivery. For a cross-process system this is the primary debugging need; current logs are plain strings (`event X published to remote` / `event X emitted to local by redis remote`) with no shared id. **Fix:** add a `msgId` (and optional caller-supplied `traceId`) into `RedisEventPayload`; log publish and delivery with the same id.
- **D3-F4 (MEDIUM)** — `safeArgs` silent null substitution (see D1-F2) is invisible data loss on remote events specifically, which is the hardest class of bug to diagnose.

## D4 — Data & Storage
- **D4-F1 (LOW)** `cache.ts` — the `on(event, ...)` cache-clear listeners are registered but never triggered; invalidation actually relies on shared Redis (the parent→child SET cascade in `clearCacheKey`). Maintainers may wrongly assume the EventBus drives cross-process invalidation. **Fix:** document this, or remove the dead listeners.
- **D4-F2 (MEDIUM)** — Redis pub/sub is best-effort with no durability, redelivery, or DLQ. `trigger` silently drops events when a process hasn't subscribed yet (restart) or during a Redis failover. Unsafe for must-deliver business events (e.g. `order-paid`). **Fix:** state "not durable / at-most-once" explicitly in `trigger` JSDoc; recommend a durable queue for business-critical events.
- **D4-F3 (LOW)** — `safeArgs` + JSON round-trip mutates payload shape (`Map`/`Set`/class → `null`/`{}`), so subscribers receive different data than publishers.

## D5 — API Contracts
- **D5-F1 (MEDIUM)** `event.ts:211` — `trigger(event, args?, opts?)` types `args` as `any[]` but never validates it. Passing a non-array (e.g. a string) silently corrupts the payload (`safeArgs` maps over the string's characters) or throws at `emit(event, ...a)`. **Fix:** assert `Array.isArray(args)`, coerce-with-warning or throw a typed error.
- **D5-F2 (HIGH — contract break)** `event.ts:167` / `:134-139` — `off(event, listener)` matches by reference, but `once` listeners are registered via an internal `wrapper`. Passing the original function to `off` silently fails to remove a `once` listener (the wrapper stays). **Fix:** maintain a `Map<originalListener, wrapper>`; `off` should resolve the wrapper before calling `bus.off`; `removeAllListeners` path unaffected.
- **D5-F5 (LOW)** `event.ts:256-258` — `initEventSubscriber` idempotency is module-level (`_subscriberReady`); re-`boot()` in tests won't reinit even if Redis config changed. **Fix:** document the behavior, or reset the guard on `closeEventSubscriber`.

## D6 — Engineering
- **D6-F1 (HIGH)** — No tests for the event module. The `unique`/`once`/remote-bridge/`__pid` self-filter paths (cross-service boundary) are unverified. **Fix:** add unit tests covering each path + a malformed-message case.
- **D6-F2 (MEDIUM)** — subscriber connection lacks graceful shutdown (see D2-F2).
- **D6-F4 (MEDIUM)** — No ADR documenting the non-obvious decision: "cache invalidation relies on shared Redis; EventBus events are best-effort cross-process notifications." **Fix:** add a short ADR.
- **D6-F6 (MEDIUM)** `event.ts:298-302` — `eventLog` depends on an external pino config (`level=24`, `[CACHE]` prefix, `'cache'` category) that is not owned by this module. If that config differs, event logs silently vanish. **Fix:** decouple (use a dedicated logger/category) or document the hard dependency.

## D7 — Defensive
- **D7-F1 (MEDIUM)** — magic constant `level=24` (for the `[CACHE]` prefix) is unnamed and coupled to external pino config (see D6-F6). **Fix:** name it; or remove the coupling.
- **D7-F2 (LOW)** `event.ts:277` — a malformed message missing the `p` field compares `undefined === __pid` → false → treated as remote and re-emitted locally. Minor double-processing risk. **Fix:** default `payload.p` to a sentinel and log.
- **D7-F4 (LOW)** `event.ts:280` — `channel.slice(CHANNEL_PREFIX.length)` assumes the channel always starts with the prefix. True today via `psubscribe` but not defended. **Fix:** assert `channel.startsWith(CHANNEL_PREFIX)`.

---

## Fix Task List (ordered by priority)

| # | Severity | Task | Location |
|---|----------|------|----------|
| T1 | HIGH | `off` cannot remove `once` listeners — keep `Map<originalListener, wrapper>`, resolve in `off` | event.ts:134-139, 167 |
| T2 | HIGH | Add unit tests for `unique` / `once` / `off`+`once` / remote bridge / `__pid` filter / malformed message | test suite |
| T3 | MEDIUM | Wrap `emit` in subscribe handler with try/catch + log (isolate bad listeners) | event.ts:281 |
| T4 | MEDIUM | Validate `Array.isArray(payload.a)` before spread in subscribe handler | event.ts:281 |
| T5 | MEDIUM | Validate `Array.isArray(args)` in `trigger` | event.ts:211-212 |
| T6 | MEDIUM | Track subscriber connection at module scope; add `closeEventSubscriber()` for graceful shutdown | event.ts:268, 256 |
| T7 | MEDIUM | Document `trigger` best-effort / not-durable contract in JSDoc | event.ts:211 |
| T8 | MEDIUM | Add correlation id (`msgId`/`traceId`) into payload + publish/delivery logs | event.ts:67, 219, 281, 285 |
| T9 | MEDIUM | `safeArgs` should log dropped arguments instead of silent null | event.ts:58-63 |
| T10 | MEDIUM | Decouple `eventLog` from magic `level=24`/`[CACHE]`/pino config or document the hard dependency | event.ts:298-302 |
| T11 | MEDIUM | Add ADR: cache invalidation via shared Redis vs EventBus best-effort notifications | docs |
| T12 | LOW | Handle missing `p` field defensively in subscribe handler | event.ts:277 |
| T13 | LOW | Assert `channel.startsWith(CHANNEL_PREFIX)` before slice | event.ts:280 |
| T14 | LOW | Document `initEventSubscriber` idempotency / reinit-on-close behavior | event.ts:256 |
| T15 | LOW | Document (or remove) dead cache-invalidation listeners in cache.ts | cache.ts:305-318 |
| T16 | LOW | Document `unique` single-thread atomicity assumption | event.ts:129 |
