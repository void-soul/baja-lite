# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`baja-lite` is a published npm library (not an application): a TypeScript SQL abstraction layer with multi-DB support (MySQL, PostgreSQL, SQLite local, SQLite Remote), an ORM built on `baja-lite-field` decorators, a stream/fluent query builder, a SQL template system (Mustache + MyBatis-style XML), and Redis-backed method cache / distributed lock. Output is ESM-only (`dist/`). The repo also ships a CLI (`baja`) that scaffolds code from a live MySQL schema.

## Build / run commands

Everything is in `package.json` scripts; there is no test runner and no linter configured (eslint deps are present but unused).

```bash
yarn dist            # build — runs node ./ci.js (ESM build into dist/)

# Smoke-test entry points against real databases (require a configured local DB):
yarn mysql           # bun --inspect src/test-mysql.ts
yarn postgres        # bun --inspect src/test-postgresql.ts
yarn sqlite          # bun --inspect src/test-sqlite.ts
yarn xml             # bun --inspect src/test-xml.ts          (XML/MyBatis template smoke test)
yarn test            # bun --inspect src/test.ts              (currently just snowflake demo)
```

There is **no unit test framework** — the `test-*.ts` files are hand-driven smoke scripts that connect to a live DB. When changing `sql.ts`, run the relevant `test-*` script against your local DB rather than expecting `npm test` to verify behavior.

### How `ci.js` builds

`ci.js` is the only build entry; do not call `tsc` directly. It wipes `dist/` and `tsconfig.tsbuildinfo`, runs `tsc --module esnext` (uses `tsconfig.json`), then copies `package.json` / `README.md` / `LICENSE` into `dist/`. The package only publishes the ESM build — CJS support was removed; do not re-add `tsconfig.cjs.json` / `package-cjs.json` / a `dist-cjs/` build step without revisiting consumer needs.

Public entries (must stay in sync in `package.json` `exports`): `.` (index), `./boot.js`, `./boot-remote.js`, `./wx.js`, plus the `baja` bin (`code.js`).

## Architecture

### Module map (`src/`)

- `index.ts` — barrel re-export. Everything except `boot*`, `wx*`, and the CLI is re-exported from here. `import 'reflect-metadata'` is loaded here.
- `sql.ts` — **the monolith (~5700 lines).** Holds essentially the entire library surface: Dao implementations, `SqlService`, `StreamQuery`, `SqlCache`, decorators, and the cache/lock helpers. Most edits will land here.
- `boot.ts` / `boot-remote.ts` — runtime initialization. `Boot(options)` connects MySQL/Postgres/SQLite/Redis pools and stores them on `globalThis` under symbol keys. `BootRomote` is the same idea for the `SqliteRemote` web-only flavor.
- `convert-xml.ts` — MyBatis-style XML SQL template renderer (used by `SqlCache` when loading `.xml` files from `sqlDir`).
- `code.ts` (`baja` bin) — codegen CLI. Reads `baja.code.json` / `baja.code.js` from the consuming project, introspects MySQL `INFORMATION_SCHEMA`, renders Mustache templates from a `code-template/` directory. Mustache delimiters are remapped to `<% %>`. The discovery walks two `..`s, then five `..`s from the installed location to find the config (it's intended to live in a project that has installed this package).
- `sqlite.ts` — abstract base class `SqliteRemoteClass` implementing the `SqliteRemoteInterface` from `sql.ts` (used by consumers that proxy SQLite over a transport).
- `snowflake.ts` — distributed ID generator with a singleton `snowflake` export.
- `event.ts` — typed `EventBus<T>` wrapper over Node EventEmitter.
- `fn.ts` / `math.ts` / `object.ts` / `string.ts` — utility grab-bags (`sleep`, `excuteSplit`, `dieTrying`, decimal-safe `add`/`sub`/`mul`/`div`, bean copy helpers, `C2P`/`P2C` case converters, etc.).
- `error.ts` — `Throw()` helper used throughout for assertion-style errors.
- `wx/` + `wx.ts` — WeChat (mini-program / organ) helpers, exposed as the separate `./wx.js` entry point so they don't drag into the main bundle.

### Global state pattern (important)

`sql.ts` defines a set of **exported `Symbol(...)` keys** (`_dao`, `_sqlCache`, `_GlobalSqlOption`, `_LoggerService`, `_DataConvert`, `_Context`, `_enum`, `_EventBus`, `_path`, `_fs`, `_MysqlKeepAliveTime`, `_primaryDB`). `boot.ts` writes connection pools and config onto `globalThis[symbol]` using these keys, and every other file reads from there. There is no DI container — `SqlService` methods reach for `globalThis[_dao][dbType][dbName ?? _primaryDB]` on each call. When debugging "no connection" errors, the first thing to check is whether `Boot()` ran and wrote the symbol you expect. When adding a new DB type, you must update the `_dao` map shape in **both** `boot.ts` and `boot-remote.ts`.

### Sync vs async (`SyncMode`)

`SqlService` methods are written so that the same call shape works for both async drivers (MySQL/Postgres/SQLiteRemote — returns `Promise`) and sync drivers (`better-sqlite3` — returns the value directly). The `sync: SyncMode.Sync | SyncMode.Async` option on every call selects which. Internally this is implemented by writing each `Connection` implementation (`MysqlConnection`, `PostgresqlConnection`, `SqliteConnection`, `SqliteRemoteConnection` in `sql.ts`) to honor the same interface but return either the value or a Promise. Be careful when editing: returning a Promise from a code path that the caller invoked with `SyncMode.Sync` will silently break callers that don't `await` it.

### Entity / decorator model

Entity classes are defined in user code using `@Field` from the sibling package `baja-lite-field` (a peer dep, not bundled). `SqlService<T>` reads field metadata via `Reflect.getMetadata` to drive schema mapping, id detection, logical-delete fields, etc. The DB-binding decorator is `@DB({tableName, clz, dbType})` from `sql.ts`. This means **changes to entity behavior often require coordinated edits in `baja-lite-field`** — that package owns `_columns`, `_ids`, `_logicIds`, `_fields`, `_Hump`, `_deleteState`, `_stateFileName`, `DBType`, `FieldOption`, `EnumMap`.

### SQL template system (`SqlCache`)

`SqlCache.init(options)` (called by `Boot` when `sqlDir` or `sqlMap` is provided) walks `sqlDir` and loads three kinds of templates:

- `*.ts` / `*.js` exporting maps of `(options) => string` Mustache templates — most idiomatic form.
- `*.xml` MyBatis-style mappers — parsed via `html-parse-stringify` and rendered by `convert-xml.ts`. Result-map definitions live alongside selects in the same file.
- `*.mu` plain Mustache files.

The cache keys SQL by `<file>.<id>` (e.g. `user.list`); `SqlService.template`, `SqlService.page`, and the `sqlId` option of `select` resolve through this cache.

### StreamQuery

`SqlService.stream()` returns a `StreamQuery<T>` (defined inline in `sql.ts` around line 4180). The chain accumulates state into private fields and emits SQL at `excuteSelect()` / `excutePage()` / `excuteUpdate()` / `excuteDelete()`. All comparison methods (`eq`, `like`, `between`, `in`, …) accept entity property names — type-checked against `T`. The condition list also accepts nested closures via `and(q => …)` / `or(q => …)`. The same `StreamQuery` is reused for updates (`update('field', value)` / `incr('field', n)`) before terminating in `excuteUpdate()`.

### Cache & lock decorators

`@MethodCache({key, autoClearTime?, clearKey?})` and `@MethodLock({key, lockMaxActive, lockMaxTime, lockWait, lockRetryInterval})` wrap class methods. Both go through Redis — `MethodLock` uses the `redlock` package via `globalThis[_dao][DBType.RedisLock]` set up in `Boot`. The functional forms `excuteWithLock` / `excuteWithCache` / `clearMethodCache` / `GetRedisLock` / `getRedisDB` are the underlying primitives and are also exported.

## Conventions that aren't obvious from the code

- **No `npm` — use `yarn` or `pnpm`.** Both `yarn.lock` and `pnpm-lock.yaml` are committed, and the build scripts in `ci.js` call `yarn tsc` directly. There is also a `pnpm-workspace.yaml`.
- **Source uses `.js` extensions in imports.** Because `tsconfig` has `module: esnext` and `moduleResolution: node`, source files import with `./foo.js` even though the file on disk is `foo.ts`. Don't "fix" these to `.ts`.
- **Chinese comments and identifiers** are intentional — the project is bilingual; keep the style of surrounding code when editing.
- **`strict: true`, `noUnusedLocals: true`, `noPropertyAccessFromIndexSignature: true`** — TypeScript is strict but `noImplicitAny: false` and `useUnknownInCatchVariables: false` are off. `globalThis[someSymbol]` access works because of `noPropertyAccessFromIndexSignature` allowing bracket access on the typed `globalThis`.
- **`reflect-metadata`** is imported once in `index.ts`. Don't re-import it in individual files; it would re-register.
- **The CLI is published as `baja`** (`bin` in package.json). When iterating on `code.ts`, run a `yarn dist` and test the resulting `dist/code.js` from a consumer project; `code.ts` walks `..` from its install location to find `baja.code.json`, so running it from this repo's source tree won't find a config.
