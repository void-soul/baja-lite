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
export declare const _tableName: unique symbol;
/** @internal 实体绑定的 dbName（多数据源时用） */
export declare const _daoDBName: unique symbol;
/** @internal 实体类名（小驼峰） */
export declare const _className: unique symbol;
/** @internal 实体类名（大驼峰） */
export declare const _ClassName: unique symbol;
/** @internal 实体类名（短横线） */
export declare const _vueName: unique symbol;
/** @internal 实体->数据转换器，由 @DB 注入 */
export declare const _transformer: unique symbol;
/** @internal 表注释 */
export declare const _comment: unique symbol;
/** @internal SqlCache 实例，挂在 globalThis */
export declare const _sqlCache: unique symbol;
/** @internal DAO 注册表 {dbType: {dbName: Dao}}，挂在 globalThis */
export declare const _dao: unique symbol;
/** 主数据源（无名）的占位 key —— 注意：这是字符串，不是 Symbol。 */
export declare const _primaryDB = "______primaryDB_______";
/** @internal 实体绑定的 dbType */
export declare const _dbType: unique symbol;
/** @internal sqlite 表版本号（用于自动迁移） */
export declare const _sqlite_version: unique symbol;
/** @internal Connection 内部持有的真实驱动连接对象 */
export declare const _daoConnection: unique symbol;
/** @internal Connection 是否在事务中 */
export declare const _inTransaction: unique symbol;
/** @internal Dao 内部持有的真实驱动 pool/db 对象 */
export declare const _daoDB: unique symbol;
/** @internal SqliteRemote 的远端 db 名 */
export declare const _sqliteRemoteName: unique symbol;
/** @internal @DB 注解写入的 ServiceOption */
export declare const _SqlOption: unique symbol;
/** 数据转换函数注册表（boot 时传入），挂在 globalThis */
export declare const _DataConvert: unique symbol;
/** 模板渲染上下文（boot 时传入），挂在 globalThis */
export declare const _Context: unique symbol;
/** MySQL keepalive 间隔（毫秒），挂在 globalThis */
export declare const _MysqlKeepAliveTime: unique symbol;
/** @internal XML resultMap 注册表 */
export declare const _resultMap: unique symbol;
/** @internal sqlId -> resultMap 映射 */
export declare const _resultMap_SQLID: unique symbol;
/** 枚举映射（boot 时传入），挂在 globalThis */
export declare const _enum: unique symbol;
/** 全局配置（boot 时聚合），挂在 globalThis */
export declare const _GlobalSqlOption: unique symbol;
/** EventBus，挂在 globalThis */
export declare const _EventBus: unique symbol;
/** LoggerService 实例，挂在 globalThis */
export declare const _LoggerService: unique symbol;
/** 内存缓存 single-flight 表（key → in-flight Promise），挂在 globalThis */
export declare const _memInflight: unique symbol;
/** 延迟加载的 node:path 模块，挂在 globalThis */
export declare const _path: unique symbol;
/** 延迟加载的 node:fs 模块，挂在 globalThis */
export declare const _fs: unique symbol;
/** MySQL/Postgres keepalive 默认间隔（30 秒） */
export declare const DEFAULT_KEEPALIVE_INTERVAL = 30000;
/** 默认批量处理数量 */
export declare const DEFAULT_MAX_DEAL = 500;
