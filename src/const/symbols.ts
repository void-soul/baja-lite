/**
 * 全局 Symbol 注册表，跨文件共享。
 *
 * 这些 Symbol 大多用作 `globalThis[symbol]` 的键（保存 dao 实例、配置、缓存等运行时状态），
 * 或者用作类的私有字段键（如 `_inTransaction` / `_daoConnection`）。
 *
 * 标 `@internal` 的项是包内部约定，外部不应当读写——但因为跨文件共享必须 export，
 * 在 TS 里没法严格强制访问范围；保留 `_` 前缀作为风格提示。
 */

/** @internal 实体的表名 */
export const _tableName = Symbol('tableName');
/** @internal 实体绑定的 dbName（多数据源时用） */
export const _daoDBName = Symbol('dbName');
/** @internal 实体类名（小驼峰） */
export const _className = Symbol('className');
/** @internal 实体类名（大驼峰） */
export const _ClassName = Symbol('ClassName');
/** @internal 实体类名（短横线） */
export const _vueName = Symbol('vueName');
/** @internal 实体->数据转换器，由 @DB 注入 */
export const _transformer = Symbol('transformer');
/** @internal 表注释 */
export const _comment = Symbol('comment');
/** @internal SqlCache 实例，挂在 globalThis */
export const _sqlCache = Symbol('sqlMap');
/** @internal DAO 注册表 {dbType: {dbName: Dao}}，挂在 globalThis */
export const _dao = Symbol('dao');
/** 主数据源（无名）的占位 key —— 注意：这是字符串，不是 Symbol。 */
export const _primaryDB = '______primaryDB_______';
/** @internal 实体绑定的 dbType */
export const _dbType = Symbol('dbType');
/** @internal sqlite 表版本号（用于自动迁移） */
export const _sqlite_version = Symbol('sqlite_version');
/** @internal Connection 内部持有的真实驱动连接对象 */
export const _daoConnection = Symbol('daoConnection');
/** @internal Connection 是否在事务中 */
export const _inTransaction = Symbol('inTransaction');
/** @internal Dao 内部持有的真实驱动 pool/db 对象 */
export const _daoDB = Symbol('daoDB');
/** @internal SqliteRemote 的远端 db 名 */
export const _sqliteRemoteName = Symbol('sqliteRemoteName');
/** @internal @DB 注解写入的 ServiceOption */
export const _SqlOption = Symbol('SqlOption');
/** 数据转换函数注册表（boot 时传入），挂在 globalThis */
export const _DataConvert = Symbol('DataConvert');
/** 模板渲染上下文（boot 时传入），挂在 globalThis */
export const _Context = Symbol('Context');
/** MySQL keepalive 间隔（毫秒），挂在 globalThis */
export const _MysqlKeepAliveTime = Symbol('MysqlKeepAliveTime');
/** @internal XML resultMap 注册表 */
export const _resultMap = Symbol('resultMap');
/** @internal sqlId -> resultMap 映射 */
export const _resultMap_SQLID = Symbol('resultMap_SQLID');
/** 枚举映射（boot 时传入），挂在 globalThis */
export const _enum = Symbol('_enum');
/** 全局配置（boot 时聚合），挂在 globalThis */
export const _GlobalSqlOption = Symbol('GlobalSqlOption');
/** EventBus，挂在 globalThis */
export const _EventBus = Symbol('EventBus');
/** LoggerService 实例，挂在 globalThis */
export const _LoggerService = Symbol('LoggerService');
/** 内存缓存 LRU 存储（key → entry），挂在 globalThis */
export const _memCache = Symbol('memCache');
/** 内存缓存 single-flight 表（key → in-flight Promise），挂在 globalThis */
export const _memInflight = Symbol('memInflight');
/** 延迟加载的 node:path 模块，挂在 globalThis */
export const _path = Symbol('path');
/** 延迟加载的 node:fs 模块，挂在 globalThis */
export const _fs = Symbol('fs');

// ===== 常量 =====

/** MySQL/Postgres keepalive 默认间隔（30 秒） */
export const DEFAULT_KEEPALIVE_INTERVAL = 30000;
/** 默认批量处理数量 */
export const DEFAULT_MAX_DEAL = 500;

// 初始化 globalThis 上的 _resultMap_SQLID（原 sql.ts 文件顶层的副作用语句）
if (globalThis[_resultMap_SQLID] === undefined) {
    globalThis[_resultMap_SQLID] = {};
}
