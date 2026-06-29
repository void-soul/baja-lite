import { DBType, EnumMap } from 'baja-lite-field';
import { XML } from '../convert-xml.js';
import { LogLevel, LoggerService } from '../logger.js';
import { DEFAULT_MAX_DEAL, _daoConnection, _daoDB, _inTransaction } from '../const/symbols.js';

// ===== 枚举 =====

export enum MapperIfUndefined { Null, Skip, Zero, EmptyString };

export enum SyncMode {
    /** 同步执行 */
    Sync,
    /** 异步执行 */
    Async
}

export enum InsertMode {
    /**
    # 默认使用
    ** 支持单个、批量,语法 `INSERT INTO XX VALUES (第一条数据), (第二条数据);`
    ** 批量执行有性能优势，但无法利用数据库的sql预编译功能
    */
    Insert,
    /**
    # 利用临时表
    ## 执行步骤
    1. 建立临时表(从正式表复制)
    2. 数据全部进入临时表
    3. 临时表数据转移到正式表: `INSERT INTO 正式表 SELECT * FROM 临时表`
    4. 删除临时表
    ## 注意
    1. 适用于：主键不会冲突、非自增
    2. 临时表的结构复制正式表
     */
    InsertWithTempTable,
    /**
     * 如果不存在则插入
     * 来源是数据库，根据ID或者指定字段查询
     */
    InsertIfNotExists,
    /**
    # 插入或者更新
    1. 判断依据是主键,来源是从数据库查询
     */
    Replace
}

export enum DeleteMode {
    /**
     ##常规删除 默认
     ### 例一
     `DELETE FROM WHERE (id = 1) OR (id = 2)`
     ### 例二
     `DELETE FROM WHERE (id = 1 AND idx = 11) OR (id = 2 AND idx = 22)`
    */
    Common,
    /*
    ## 借助临时表
    ### 注意：必须保证where的字段都相同，否则会漏删数据
    DELETE FROM 正式表 INNER JOIN 临时表 WHERE 字段1 = 字段1 AND 字段2 = 字段2
     */
    TempTable
}

export enum SelectMode {
    /**
     ##常规 默认
     ### 例一
     `SELECT * FROM WHERE (id = 1) OR (id = 2)`
     ### 例二
     `SELECT * FROM WHERE (id = 1 AND idx = 11) OR (id = 2 AND idx = 22)`
    */
    Common,
    /*
    ## 借助临时表
    ### 注意：必须保证where的字段都相同，否则会漏删数据
    SELECT * FROM 正式表 INNER JOIN 临时表 WHERE 字段1 = 字段1 AND 字段2 = 字段2
     */
    TempTable
}

export enum TemplateResult {
    /** 确定返回一条记录，如果不是一个，将报错，返回类型是T */
    AssertOne,
    /** 可能返回一条记录，返回类型是T|null */
    NotSureOne,
    /** 返回多条记录 */
    Many,
    /** 仅查询记录数量 */
    Count
}

export enum SelectResult {
    /** 一行一列 确定非空 */
    R_C_Assert,
    /** 一行一列 可能空 */
    R_C_NotSure,
    /** 一行多列 确定非空 */
    R_CS_Assert,
    /** 一行多列 可能空 */
    R_CS_NotSure,
    /** 多行一列 */
    RS_C,
    /** 多行多列 */
    RS_CS
}

export enum ColumnMode {
    NONE, HUMP
}

// ===== 常量 =====

export const SqliteMemory = ':memory:';

export const _defOption = {
    maxDeal: DEFAULT_MAX_DEAL,
    skipUndefined: true,
    skipNull: true,
    skipEmptyString: true
};

// ===== 选项接口 =====

/** @internal SqlService 方法的通用选项（每个方法都有的几个字段） */
export interface MethodOption {
    tableName?: string;
    /** 数据库、连接名称，对于MYSQL、mongo，适用于多数据源，对于sqlite，适用于不同的数据库文件  */
    dbName?: string;
    dbType?: DBType;
    /** 调用时，永远不需要传
     * @deprecated
     * */
    dao?: Dao;
    /** 调用时，仅在开启事务时需要主动传入,传入方式： */
    conn?: Connection | null;
}

/**
 数据服务注解
 @internal 由 @DB 装饰器消费
 */
export interface ServiceOption {
    /** 增改忽略Undefined */
    skipUndefined?: boolean;
    /** 增改忽略NULL */
    skipNull?: boolean;
    /** 增改忽略空字符串 */
    skipEmptyString?: boolean;
    /** 批量增改时，每次执行最多处理的记录数量 */
    maxDeal?: number;
    tableName?: string;
    /** 数据库、连接名称，对于MYSQL、mongo，适用于多数据源，对于sqlite，适用于不同的数据库文件  */
    dbName?: string;
    /** 调用时，永远不需要传
     * @deprecated
     * */
    dao?: Dao;
    /** 调用时，仅在开启事务时需要主动传入,传入方式： */
    conn?: Connection | null;
    /** 对应的实体类,必须是Class */
    clz?: any;
    /** 默认mysql */
    dbType?: DBType;
    /** SQLite版本以及升级为该版本时需要执行的SQL,初始版本为0.0.1,切记每个位置不要变为两位数*/
    sqliteVersion?: string;
    /** 备注 */
    comment?: string;
}

// ===== Mapper / SqlModel =====

export type SqlMapper = {
    columnName: string;
    mapNames: string[];
    def?: any;
    convert?: (data: any) => any;
}[];

export type SqlMappers = Record<string, SqlMapper>;

export type SqlModel = Record<string, string | (
    (options: {
        ctx?: any;
        isCount?: boolean;
        isSum?: boolean;
        limitStart?: number;
        limitEnd?: number;
        sortName?: string;
        sortType?: string;
        params?: any;
    }) => string
)>;

/** @internal 历史遗留：和 SqlModel 几乎相同，但额外允许 XML[]（XML 解析后的中间格式）。新代码请用 SqlModel。 */
export type _SqlModel = Record<string, string | (
    (options: {
        ctx?: any;
        isCount?: boolean;
        isSum?: boolean;
        limitStart?: number;
        limitEnd?: number;
        sortName?: string;
        sortType?: string;
        params?: any;
    }) => string
) | XML[]>;

// ===== 全局配置 =====

/**
 # 全局行为配置文件
 ### `sqlDir?: string;` 数据库查询语句存放目录.存放格式为 export.default 的js、ts， 存放内容满足格式：

    ```
    interface SqlModel {
        [key: string]: string | ((params: { [k: string]: any }, context: any, isCount?: boolean) => string)
    }
    ```
    可以继承该接口来约束格式
 */
export interface GlobalSqlOptionForWeb {
    /** 增改忽略Undefined */
    skipUndefined?: boolean;
    /** 增改忽略NULL */
    skipNull?: boolean;
    /** 增改忽略空字符串 */
    skipEmptyString?: boolean;
    /** 批量增改时，每次执行最多处理的记录数量 */
    maxDeal?: number;
    /** 内存缓存的 LRU 上限（@MethodCache + storage: 'memory'）。默认 10000。 */
    memCacheMaxSize?: number;
    SqliteRemote?: {
        /**
         ## 单一数据源
        ```
        db: 'd:/1.db'
        ```
        ## 多数据源：传入多个连接配置
        ```
        db: {
                db1: 'd:/1.db',
                db2: 'd:/2.db'
        }
        ```
        不支持 `SqliteMemory`
        */
        db?: Record<string, string> | string,
        /** 远程SQLITE接口实现，适用于Electron, 采用Ipc 的handel机制实现 */
        service: SqliteRemoteInterface
    },
    /** 日志等级 */
    log?: LogLevel[] | LogLevel,
    /**
     作用与sqlDir类似，不同在于sqlMap`不需要`目录，而是直接指定一个sqlModel对象，对象的格式和sqlDir的文件内容一样。
     ** 适用于简单使用
     */
    sqlMap?: SqlModel;
    /**
     作用与sqlFnDir类似，不同在于sqlFNMap`不需要`目录，而是直接指定一个 Record<string, string>，对象的格式和sqlFnDir的文件内容一样。
     ** 适用于简单使用
     */
    sqlFNMap?: Record<string, string>;
    /**
    // 第一个元素=列名，第二个元素是属性路径，
    [
        ['dit_id', ['id']], // 列名ditid,对应属性id
        ['event_id', ['eventMainInfo', 'id']] // 列名event_id对应属性eventMainInfo.id
    ]
     */
    sqlMapperMap?: SqlMappers;
    /** 提供的枚举MAP */
    enums?: EnumMap;
    /**
     * `列名与属性映射` 是否自动将下划线转为驼峰，默认NONE，即不转.
     * 当设置为columnMode.HUMP时，切记将代码生成器中属性名称改对
     * # 自定义sql查询时，无法自动转换哦,可使用标签转换：
     *```
        SELECT
     *  {{#hump}} seller_sku2, seller_sku {{/hump}}
     * ```
     * 转换为
     *```
        SELECT
     *  {{#hump}} seller_sku2 sellerSku2, seller_sku sellerSku {{/hump}}
     * ```
     */
    columnMode?: ColumnMode;
    /** 对于WEB模式，默认为SqliteRemote */
    dbType?: DBType;
    /**
     * * 数据转换器，用于service的select、page方法，以及stream查询
     * * 例如
     * ```
     * dataConvert: {
     *      // 使用时，传入qiniu和列名，将根据列名对应的值生成URL
     *      qiniu: data => qiniuConvertUrl(data)
     * }
     * ```
     */
    dataConvert?: Record<string, (data: any) => any>;
    /** 公开上下文 */
    ctx?: any;
    /** 日志服务 */
    logger?: LoggerService;
}

/**
 # 全局行为配置文件
   MYSQL编码： 'utf8mb4', utf8mb4_general_ci'
 ### `sqlDir?: string;` 数据库查询语句存放目录.存放格式为 export.default 的js、ts， 存放内容满足格式：

    ```
    interface SqlModel {
        [key: string]: string | ((params: { [k: string]: any }, context: any, isCount?: boolean) => string)
    }
    ```
    可以继承该接口来约束格式
 */
export interface GlobalSqlOption extends GlobalSqlOptionForWeb {
    /**
       初始化MYSQL链接 支持多数据源
       ## 单一数据源: 直接传入Mysql2的连接配置
       [MYSQL初始化文档](https://github.com/mysqljs/mysql#connection-options)
       ```
       Mysql: {
          host: '127.0.0.1',
          ...
       }
       ```
       ## 多数据源：传入多个Mysql2的连接配置
       ```
       Mysql: {
          db1: {
              host: '127.0.0.1',
              ...
          },
          db2: {
              host: '127.0.0.1',
              ...
          },
          ...
       }
       ```
      */
    Mysql?: Record<string, Record<string, any>> | Record<string, any>;
    /**
     * MYSQL保持心跳的间隔，默认30秒
     */
    MysqlKeepAlive?: number;
    /**
         初始化postgresql链接 支持多数据源
         ## 单一数据源: 直接传入postgresql的连接配置
         [Postgresql初始化文档](https://github.com/brianc/node-postgres/tree/master/packages/pg-pool)
         ```
         Postgresql: {
            database: 'postgres',
            ...
         }
         ```
         ## 多数据源：传入多个Postgresql的连接配置
         ```
         Postgresql: {
            db1: { ... },
            db2: { ... },
            ...
         }
         ```
        */
    Postgresql?: Record<string, Record<string, any>> | Record<string, any>;
    /**
     ## 单一数据源
     ```
     Sqlite: 'd:/1.db'
     ```
     ## 多数据源：传入多个连接配置
     ```
       Sqlite: {
            db1: 'd:/1.db',
            db2: 'd:/2.db'
       }
     ```
       路径 = `SqliteMemory` 将创建内存库
     */
    Sqlite?: Record<string, string> | string,
    /**
     ## 日志文件存放路径,该目录下文件名是模块名，例如有一个文件名为 `user.js`,内容为:
     ```
       export default {
            'sql_1': 'SELECT * FROM user WHERE username = :username',
            'sql_2': (options: {
                ctx?: any;
                isCount?: boolean;
                isSum?: boolean;
                limitStart?: number;
                limitEnd?: number;
                sortName?: string; sortType?: string;
                params?: Record<string, any>;
            }) => {
                return   `
                    SELECT * FROM user u LEFT JOIN organ o ON u.orgid = o.orgid
                    WHERE o.orgid = :orgid;
                `;
            }
        } as SqlModel;
     ```
     ** 可以看到，sql语句支持直接映射一个sql语句，也可以通过函数返回,返回字符串支持[mustache](https://github.com/janl/mustache.js)
     ** 上面的文件中，将注册两个SQL：`user.sql_1` 和 `user.sql_2`.
     ** `[k: string]: any;` 是用查询时传入的参数，可以指定为任意类型，可以用来生成sql，例如进行循环语句
     ** ctx 是框架的上下文，可以自行指定类型
     ** 其他 是保留参数
     ** 函数类型中，可以调用自己定义的通用sql
     ### 注意
     1. 不要直接拼接参数：不安全且效率低
     2. sqlite不支持多语句拼接
    ## 也支持.mu文件,格式略
    */
    sqlDir?: string;
    /**
    ## [mustache](https://mustache.github.io/) 编译时的[模板](https://github.com/janl/mustache.js#:~:text=requires%20only%20this%3A-,%7B%7B%3E%20next_more%7D%7D,-Why%3F%20Because%20the)
      ## 文件名就是模板名
     */
    sqlFNDir?: string;
    /**
     *  #TODO 未完成读取 sqlMapDir
     *  # sqlMapDir 目录定义如下，
     *      `test.ts`
     *      ```
     *         export const dict:SqlMappers = [
     *             {columnName: 'dit_id', mapNames: ['DTID'], def: 0, convert: 转换函数},
     *             {columnName: 'event_id', mapNames: ['eventMainInfo', 'id'], def: 0,  convert: 转换函数},
     *         ]
     *      ```
     *      将得到 test.dict 这个map
     */
    sqlMapDir?: string;
    /**
      ## 映射数据为对象，文件名就是模板名
    ```
    // 第一个元素=列名，第二个元素是属性路径，
    // 该目录下可存放json文件，内容如下
    //
    // 可以在查询时使用，优先级高于hump
    // 例如:
    [
        ['dit_id', ['id'], 可选的默认值],
        ['event_id', ['eventMainInfo', 'id']]
    ]
    ```
     */
    sqlMapperDir?: string;
    /**
     [REDIS初始化文档](https://github.com/redis/ioredis?tab=readme-ov-file#:~:text=connect%20to%20by%3A-,new%20Redis()%3B,-//%20Connect%20to%20127.0.0.1)
    ```
    Redis: {
        host: '127.0.0.1',
        ...
    }
    ```
    ## 多数据源：传入多个Redis的连接配置
    ```
    Redis: {
        db1: { host: '127.0.0.1', ... },
        db2: { host: '127.0.0.1', ... },
    }
    ```
     */
    Redis?: Record<string, Record<string, any>> | Record<string, any>;
    /** sqlite数据库驱动初始化函数 */
    BetterSqlite3?: any;
    /**
     * 读取查询语句时，是否扫描JS文件？
     * JS文件需要默认导出一个 SqlModel对象
     */
    jsMode?: boolean;
}

export interface PageQuery<L> {
    sum?: Record<string, string | number>;
    total?: number;
    size?: number;
    records?: L[];
}

// ===== 数据库抽象接口 =====

/** sqlite electron服务端需要支持的接口 */
export interface SqliteRemoteInterface {
    execute(inData: Uint8Array): Promise<Uint8Array>;
    pluck(inData: Uint8Array): Promise<Uint8Array>;
    get(inData: Uint8Array): Promise<Uint8Array>;
    raw(inData: Uint8Array): Promise<Uint8Array>;
    query(inData: Uint8Array): Promise<Uint8Array>;
    initDB(dbName: string): void;
    export(dbName: string, exportPath: string): Promise<void>;
    restore(dbName: string, importPath: string): void;
    close(dbName?: string): void;
}

export interface Connection {
    [_daoConnection]: any;
    [_inTransaction]: boolean;
    execute(sync: SyncMode.Sync, sql?: string, params?: any): { affectedRows: number; insertId: bigint; };
    execute(sync: SyncMode.Async, sql?: string, params?: any): | Promise<{ affectedRows: number; insertId: bigint; }>;
    /** 一行一列 */
    pluck<One_Row_One_Column = any>(sync: SyncMode.Sync, sql?: string, params?: any): One_Row_One_Column | null;
    pluck<One_Row_One_Column = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<One_Row_One_Column | null>;
    /** 一行多列 */
    get<One_Row_Many_Column = any>(sync: SyncMode.Sync, sql?: string, params?: any): One_Row_Many_Column | null;
    get<One_Row_Many_Column = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<One_Row_Many_Column | null>;
    /** 多行一列 */
    raw<Many_Row_One_Column = any>(sync: SyncMode.Sync, sql?: string, params?: any): Many_Row_One_Column[];
    raw<Many_Row_One_Column = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<Many_Row_One_Column[]>;
    /** 多行多列 */
    query<Many_Row_Many_Column = any>(sync: SyncMode.Sync, sql?: string, params?: any): Many_Row_Many_Column[];
    query<Many_Row_Many_Column = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<Many_Row_Many_Column[]>;
    release(sync: SyncMode.Sync): void;
    release(sync: SyncMode.Async): Promise<void>;
}

export interface Dao {
    [_daoDB]: any;
    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    createConnection(sync: SyncMode.Sync): Connection | null;
    createConnection(sync: SyncMode.Async): Promise<Connection | null>;
    close(sync: SyncMode.Sync): void;
    close(sync: SyncMode.Async): Promise<void>;
    backup(sync: SyncMode.Sync, name: string): void;
    backup(sync: SyncMode.Async, name: string): Promise<void>;
    remove(sync: SyncMode.Sync): void;
    remove(sync: SyncMode.Async): Promise<void>;
    restore(sync: SyncMode.Sync, name: string): void;
    restore(sync: SyncMode.Async, name: string): Promise<void>;
}


/** 缓存存储后端。`redis` 走 ioredis 全局共享；`memory` 走进程内 LRU + Promise-based single-flight。 */
export enum StorageType { Redis, Memory }