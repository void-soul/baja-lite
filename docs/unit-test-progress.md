# baja-lite 单元测试进度文档（handoff）

> 最后更新：2026-07-27
> 状态：**已完成且全绿** —— 114 个测试，25 个文件，0 失败（Bun 1.3.14）。

## 1. 如何运行

```bash
# 完整（编译 + 跑测试），推荐
npm test

# 仅编译产物（生成 .test-build）
npm run test:build

# 仅跑测试（需先 test:build）
bun test src/__tests__/

# 监听模式
npm run test:watch

# 强制无缓存重跑（排查环境问题时用）
bun test --no-cache src/__tests__/
```

`package.json` 的 `test` 脚本等价于：

```
node_modules/.bin/tsc -p tsconfig.test.json --module esnext && bun test src/__tests__/
```

## 2. 架构决策（关键，新会话必读）

### 2.1 为什么用 bun:test + .test-build
- 测试框架：**bun:test**（`describe/it/expect/beforeAll/beforeEach`，自带 `toThrow/toEqual/toBe/toContain` 等）。
- 源码是 TypeScript 且测试文件通过 `import 'baja-lite-field'` 等外部依赖引用兄弟模块；Bun 的测试解析基于项目根而非 `src/`，且部分模块（DAO/服务）依赖 `globalThis` 上由 `Boot` 注入的运行时符号。
- **方案**：用 `tsc -p tsconfig.test.json` 把 `src/**/*.ts` 整体编译到 `.test-build/`（ESM、`module: esnext`、`noEmit:false`）。测试文件放在 `src/__tests__/*.test.ts`，统一从 `../../.test-build/<module>.js` 导入编译产物。

### 2.2 不使用真实数据库/Redis 的原因
- `better-sqlite3` 在 Bun（Node 24 / ABI 137）下没有预编译原生绑定 → 无法起真实 SQLite。
- `ioredis` / `mysql2` / `pg` 需要真实服务。
- **方案**：`helpers.ts` 提供：
  - `setupGlobals()`：把伪造的 DAO（`_dao`）、伪造内存 Redis（`_Redis`）、以及 `_GlobalSqlOption / _LoggerService / _sqlCache / _Hump / _primaryDB` 等全局符号安装到 `globalThis`。
  - `FakeDao`：`exe(sql)` 记录 `lastSql` 与 `allSqls`；`createConnection(SyncMode.Sync)` 返回 `makeFakeConn`（其 `execute` 回写 `dao` 的 `lastSql/allSqls`）；`transaction` 同步执行回调。足以驱动 SqlService 的 SQL 生成与 cache 的单飞逻辑。
  - `makeFakeRedis()`：基于 `Map` 的内存实现（`get/set/setex/del/sadd/smembers/srem/type/ttl/incr/decr/psubscribe/publish/eval→[0,0]`）。
  - `declareModel(clz, defs)`：用 `baja-lite-field` 的 `@Field` 装饰器在类原型上声明字段，使其被 `Reflect.getMetadata` 记录（**这是 `DB` 装饰器生成 SQL 的前提**）。`reflect-metadata` 由 `baja-lite-field` 在导入时装载。

### 2.3 测试文件清单（覆盖矩阵）

| 模块 | 测试文件 | 覆盖点 |
|---|---|---|
| 公共 API 导出 | `index.test.ts` | `SqlCache/DeclareClass/DeclareService/SqlService/StreamQuery/DB/SqliteRemoteClass/excuteWithCache/trigger/PrinterLogger/Snowflake/ColumnMode/SyncMode/DatabaseError/Throw/on/off/promise/excuteSplit/num/add/copyBean/snowflake` 等导出存在性 |
| 常量/枚举 | `const.test.ts` `const-symbols.test.ts` | `SyncMode/InsertMode/DeleteMode/SelectMode/ColumnMode/DBType` 数值枚举；`const/index` 与 `const/symbols` 的内部 Symbol/字符串键 |
| 错误 | `error.test.ts` | `DatabaseError` 属性、`getSafeMessage`、静态工厂、`Throw.if/ifNot/now` |
| 事件 | `event.test.ts` | `on/off/trigger/once/unique`、异常隔离、无 Redis 静默跳过 remote |
| 函数工具 | `fn.test.ts` | `promise/sleep/dieTrying/excuteSplit`（Sync/Async × Trust/NoTrust、分组、缺参抛错） |
| 数学 | `math.test.ts` | `num/add/sub/mul/div/min/max/divDef/round/merge/money/Bus 链式/calc/getGeo/ten2Any` |
| 对象工具 | `object.test.ts` | `copyBean/convertBean/emptyBean/convertBeans/createBeanFromArray/coverComplexBean/fixEmptyPrototy/mixArray/mixList/assignArray/array2map/arraySplit/assginObject/distinctArray/P2C/C2P/fillArrayToMinLength` |
| 雪花 | `snowflake.test.ts` | `generate` 唯一性、`mid` 取模、时钟回拨 >5s 返回 null |
| 字符串/XML | `string.test.ts`（见下）、`convert-xml.test.ts` | `<if>/<foreach>/<where>` 模板渲染 |
| SQL 模板 | `sql-template.test.ts` | `SqlCache.load` mustache 渲染、未知 sqlId 抛错、`flatData` 按映射展平 |
| 缓存 | `cache.test.ts` | `excuteWithCache` 首次 miss/再次 hit/`clearMethodCache`/`cacheOnly` |
| 数据库服务 | `service.test.ts` | `insert/update/delete/template/excute` 的 SQL 生成（需 `@Field` 声明模型，id 须放入 update 的 data） |
| 流式查询 | `stream-query.test.ts` | `where+select/limit/groupBy` → `excuteSelect({sync, skipConn:true})` 后检查 `dao.lastSql` |
| DAO：Sqlite | `sqlite.test.ts` | 构造、注册内置函数、`createConnection`、`transaction`（fake `transaction` 必须 `return cb`）、`close/backup/remove/restore` |
| DAO：Mysql | `mysql.test.ts` | `createConnection(Sync)`→null、`transaction(Sync)`→null、异步连接/查询/事务（fake pool `getConnection`→Promise、conn `query/execute`→`[rows]`） |
| DAO：Postgresql | `postgresql.test.ts` | 同上（fake pool `connect`→Promise、conn `query`→`{rows}`） |
| DAO：SqliteRemote（客户端） | `sqlite-remote.test.ts` | `createConnection` 须 `await`；`execute/query/pluck/get/raw` 经 msgpack 往返 |
| DAO：SqliteRemoteClass（服务端，root `sqlite.ts`） | `sqlite-root.test.ts` | 抽象类须用具体子类实例化（`getStoreName/BetterSqlite3/cpSync/setMod/trace`）；`execute/query/get/pluck/raw` 编码 |
| 方言格式化 | `format-dialects.test.ts` | `formatDialects[DBType.X]` 是 **方言配置对象**（传给 `sql-formatter` 的 `format(sql,{dialect})`），不是函数 |
| 启动配置 | `boot.test.ts` `boot-remote.test.ts` | `Boot/BootRomote` 是函数；`Boot` 按 `columnMode` 设置全局 `_Hump` |
| 探针（保留） | `probe3.test.ts` | 加载 `const/types` 暴露 `SyncMode/InsertMode` |

## 3. 踩坑记录（新会话改测试时对照）

1. **`sql-formatter` 包名**：依赖里是 `sql-formatter`（v15），**不是** `@sql-formatter`。导入 `import { format } from 'sql-formatter'`。
2. **`@msgpack/msgpack` v3 没有 `extensionCodec` 单例**：用 `import { ExtensionCodec } from '@msgpack/msgpack'` 再 `new ExtensionCodec()`；或**直接复用源码导出的真实 `extensionCodec`**（`../../.test-build/db/dao/sqlite-remote.js` 或 `../../.test-build/db/index.js`），它已注册 BigInt（extType 0）编解码。`insertId` 是 `bigint`，会走扩展类型，普通 `new ExtensionCodec()` 解码会得到 `ExtData` 而非数字。
3. **模型声明**：`SqlService` 生成 SQL 依赖 `Reflect.getMetadata(_ids/_fields/_columns)`（由 `@Field` 装饰器写入）。纯 `DeclareClass([...])` 只挂直接属性、不会写 reflect 元数据，SQL 会缺失列。务必用 `declareModel(clz, defs)`（`helpers.ts`）。
4. **格式化后的 SQL 含换行**：`excute`/insert 经 `sql-formatter` 后变成多行（如 `"INSERT INTO\n  user ..."`），正则断言用 `/insert\s+into\s+user/i` 或在断言前 `.replace(/\s+/g,' ')`。
5. **`update` 要求 id 在 data 内**：`svc.update({ data: { id: 1, name: 'bob' }, sync })`，不能写 `svc.update({ id: 1, data: {...} })`。
6. **`Sqlite.transaction` 的 fake**：`makeFakeDb.transaction` 必须是 `(cb) => cb`（返回函数本身），**不是** `(cb) => cb()`（那会返回回调的执行结果，导致 `this[_daoDB].transaction(cb)()` 报 “not a function”）。
7. **`SqliteRemoteConnection`**：`createConnection(SyncMode.Async)` 返回 `Promise<Connection>`，调用方必须 `await`。
8. **`SqliteRemoteClass` 是抽象类**：不能直接 `new`，需具体子类实现 `getStoreName/getBackName/BetterSqlite3/cpSync/setMod/trace`。
9. **`better-sqlite3` 原生绑定不在 Bun 下可用**：一律用 fake（见 2.2）。
10. **跨文件全局状态**：bun 在单进程内运行所有测试文件、共享 `globalThis`。每个文件在 `beforeAll(setupGlobals)` 中**重置**全局符号（DAO/Redis/Logger/SqlCache/GlobalSqlOption），因此各文件互不污染。不要依赖其它文件遗留的全局状态。

## 4. 未覆盖 / 受限模块

- **`code.ts`（CLI 入口）**：导入即尝试读取 `baja.code.json` 并连真实 MySQL，无法在隔离环境单测。**未纳入**测试，建议保持现状。
- **`wx.ts`**：按需求**明确排除**（用户要求“除 wx 以外”）。
- **DAO 的“真实数据库往返”**：用 fake 验证了 SQL 生成与连接 API 形态，但未验证真实 DB 方言差异/事务隔离等行为（需要真实服务，超单元测试范围）。
- **`sqlite-remote.test.ts` / `sqlite-root.test.ts`** 的 `pluck/raw`：fake 的 `Statement.pluck()/raw()` 返回整行/整结果集，仅验证了“服务端正确编码-解码往返”，未验证 better-sqlite3 原生 `pluck` 返回标量、`raw` 返回裸数组的语义（需真实 better-sqlite3）。

## 5. 目录与关键文件

- 测试：`src/__tests__/*.test.ts`，公共工具 `src/__tests__/helpers.ts`。
- 编译产物：`tsconfig.test.json` → `.test-build/`（已被 `.gitignore` 忽略，生成物不入库）。
- 脚本：`package.json` 的 `test` / `test:build` / `test:unit` / `test:watch`。
- 旧的手写断言脚本 `src/test-unit.ts`（`test:unit`）保留作为补充，与本测试套件并存。

## 6. 给新会话的提示

- 新增源码模块后，若要在单测覆盖：在 `src/__tests__/` 加 `<module>.test.ts`，从 `../../.test-build/<module>.js` 导入；需要全局符号就 `import { setupGlobals } from './helpers.js'` 并在 `beforeAll` 调用。
- 编译必须先于跑测：`npm run test:build` 或 `npm test`（已串联）。
- 若遇到 “Export named 'X' not found”：先确认包名/导出名（尤其 `sql-formatter` 与 `@msgpack/msgpack` v3 的 `ExtensionCodec`）。
- 若某测试偶发失败，检查是否误依赖了其它文件写入的全局状态——改为在 `beforeAll/beforeEach` 中 `setupGlobals()` 重置。
