import { decode, DecodeError, encode, ExtensionCodec } from "@msgpack/msgpack";
import { _columns, _columnsNoId, _def, _deleteState, _fields, _Hump, _ids, _index, _logicIds, _stateFileName, AField, DBType, EnumMap, Field, FieldOption, LGet } from 'baja-lite-field';
import HTML from 'html-parse-stringify';
import * as ite from 'iterare';
import mustache, { PartialsOrLookupFn } from 'mustache';
import pino from 'pino';
import { formatDialect, mysql, postgresql, sqlite } from 'sql-formatter';
import tslib from 'tslib';
import { convert, XML } from './convert-xml.js';
import { Throw } from './error.js';
import { excuteSplit, ExcuteSplitMode, sleep } from './fn.js';
import { add, calc, ten2Any } from './math.js';
import { C2P, C2P2, P2C } from './object.js';
import { snowflake } from './snowflake.js';
import { emptyString } from './string.js';

const iterate = ite.iterate;
(BigInt.prototype as any).toJSON = function () { return this.toString() }
const BIGINT_EXT_TYPE = 0;
export const extensionCodec = new ExtensionCodec();
extensionCodec.register({
    type: BIGINT_EXT_TYPE,
    encode(input: unknown): Uint8Array | null {
        if (typeof input === "bigint") {
            if (input <= Number.MAX_SAFE_INTEGER && input >= Number.MIN_SAFE_INTEGER) {
                return encode(Number(input));
            } else {
                return encode(String(input));
            }
        } else {
            return null;
        }
    },
    decode(data: Uint8Array): bigint {
        const val = decode(data);
        if (!(typeof val === "string" || typeof val === "number")) {
            throw new DecodeError(`unexpected BigInt source: ${val} (${typeof val})`);
        }
        return BigInt(val);
    },
});


// #region 常量
const _daoDBName = Symbol('dbName');
const _tableName = Symbol('tableName');
const _className = Symbol('className');
const _ClassName = Symbol('ClassName');
const _vueName = Symbol('vueName');
const _transformer = Symbol('transformer');
const _comment = Symbol('comment');
export const _sqlCache = Symbol('sqlMap');
export const _dao = Symbol('dao');
export const _primaryDB = '______primaryDB_______';
const _dbType = Symbol('dbType');
const _sqlite_version = Symbol('sqlite_version');
const _daoConnection = Symbol('daoConnection');
const _inTransaction = Symbol('inTransaction');
const _daoDB = Symbol('daoDB');
const _sqliteRemoteName = Symbol('sqliteRemoteName');
const _SqlOption = Symbol('SqlOption');
export const _DataConvert = Symbol('DataConvert');
const _resultMap = Symbol('resultMap');
const _resultMap_SQLID = Symbol('resultMap_SQLID');
export const _enum = Symbol('_enum');
export const _GlobalSqlOption = Symbol('GlobalSqlOption');
export const _EventBus = Symbol('EventBus');
export const _path = Symbol('path');
export const _fs = Symbol('fs');
export const logger = pino({
    name: 'sql',
    transport: {
        target: 'pino-pretty'
    }
});
// export const logger =
//     process.env['NODE_ENV'] !== 'production' ?
//     pino({
//         name: 'sql',
//         transport: {
//             target: 'pino-pretty'
//         }
//     }) : pino({ name: 'sql' });
globalThis[_resultMap_SQLID] = {};
// #endregion

// #region 可选配置
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
export const SqliteMemory = ':memory:';
// #endregion

// #region 选项
interface MethodOption {
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
export const _defOption = {
    maxDeal: 500,
    skipUndefined: true,
    skipNull: true,
    skipEmptyString: true
};
/**
 数据服务注解
 */
interface ServiceOption {
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
    log?: 'trace' | 'debug' | 'info' | 'warn',
    /**
     作用与sqlDir类似，不同在于sqlMap`不需要`目录，而是直接指定一个sqlModel对象，对象的格式和sqlDir的文件内容一样。
     ** 适用于简单使用
     */
    sqlMap?: _SqlModel;
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
         初始化postgresql链接 支持多数据源
         ## 单一数据源: 直接传入postgresql的连接配置
         [Postgresql初始化文档](https://github.com/brianc/node-postgres/tree/master/packages/pg-pool)
         ```
         Postgresql: {
            database: 'postgres',
            user: 'brianc',
            password: 'secret!',
            port: 5432,
            ssl: true,
            max: 20, // set pool max size to 20
            idleTimeoutMillis: 1000, // close idle clients after 1 second
            connectionTimeoutMillis: 1000, // return an error after 1 second if connection could not be established
            maxUses: 7500, // close (and replace) a connection after it has been used 7500 times (see below for discussion)
            host?: string | undefined;
            connectionString?: string | undefined;
            keepAlive?: boolean | undefined;
            stream?: () => stream.Duplex | stream.Duplex | undefined;
            statement_timeout?: false | number | undefined;
            query_timeout?: number | undefined;
            keepAliveInitialDelayMillis?: number | undefined;
            idle_in_transaction_session_timeout?: number | undefined;
            application_name?: string | undefined;
            types?: CustomTypesConfig | undefined;
            options?: string | undefined;
         }
         ```
         ## 多数据源：传入多个Postgresql的连接配置
         ```
         Postgresql: {
            db1: {
              database: 'postgres',
              user: 'brianc',
              password: 'secret!',
              port: 5432,
              ssl: true,
              max: 20, // set pool max size to 20
              idleTimeoutMillis: 1000, // close idle clients after 1 second
              connectionTimeoutMillis: 1000, // return an error after 1 second if connection could not be established
              maxUses: 7500, // close (and replace) a connection after it has been used 7500 times (see below for discussion)
            },
            db2: {
              database: 'postgres',
              user: 'brianc',
              password: 'secret!',
              port: 5432,
              ssl: true,
              max: 20, // set pool max size to 20
              idleTimeoutMillis: 1000, // close idle clients after 1 second
              connectionTimeoutMillis: 1000, // return an error after 1 second if connection could not be established
              maxUses: 7500, // close (and replace) a connection after it has been used 7500 times (see below for discussion)
            },
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
     *             {columnName: 'dit_id', mapNames: ['DTID'], def: 0, convert: 转换函数},  // 列名ditid,对应属性DTID,如果没有值，将返回默认值0,其中默认值0是可选的
     *             {columnName: 'event_id', mapNames: ['eventMainInfo', 'id'], def: 0,  convert: 转换函数},// 列名event_id对应属性eventMainInfo.id,这种方式将返回嵌套的json对象,其中默认值null是可选的
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
        ['dit_id', ['id'], 可选的默认值], // 列名ditid,对应属性id,当未查询返回时，使用默认值
        ['event_id', ['eventMainInfo', 'id']] // 列名event_id对应属性eventMainInfo.id,当未查询返回时，该属性不存在
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
// #endregion

// #region 数据方言
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
};
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
    realse(sync: SyncMode.Sync): void;
    realse(sync: SyncMode.Async): Promise<void>;
}
interface Dao {
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
class MysqlConnection implements Connection {
    [_daoConnection]: any;
    [_inTransaction] = false;
    constructor(conn: any) {
        this[_daoConnection] = conn;
    }

    execute(sync: SyncMode.Sync, sql?: string, params?: any): { affectedRows: number; insertId: bigint; };
    execute(sync: SyncMode.Async, sql?: string, params?: any): Promise<{ affectedRows: number; insertId: bigint; }>;
    execute(sync: SyncMode, sql?: string, params?: any): { affectedRows: number; insertId: bigint; } | Promise<{ affectedRows: number; insertId: bigint; }> {
        logger.debug(sql, params ?? '');
        if (!sql) { return { affectedRows: 0, insertId: 0n }; };
        if (sync === SyncMode.Sync) {
            logger.warn('MYSQL not suppouted sync mode');
            return { affectedRows: 0, insertId: 0n };
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<{ affectedRows: number; insertId: bigint; }>(async (resolve, reject) => {
            try {
                const [_result] = await this[_daoConnection].execute(sql, params);
                const result = _result as any;
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    logger.trace(result);
                }
                resolve({ affectedRows: result.affectedRows, insertId: result.insertId });
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    pluck<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    pluck<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    pluck<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        logger.debug(sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            logger.warn('MYSQL not suppouted sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T | null>(async (resolve, reject) => {
            try {
                const [result] = await this[_daoConnection].query(sql, params);
                if (result && result[0]) {
                    const r = Object.values(result[0])[0];
                    if (r === null) resolve(r);
                    else resolve(r as T);
                }
                resolve(null);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    get<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    get<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    get<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        logger.debug(sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            logger.warn('MYSQL not suppouted sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T | null>(async (resolve, reject) => {
            try {
                const [result] = await this[_daoConnection].query(sql, params);
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    logger.trace(result);
                }
                if (result && result[0]) resolve(result[0] as T);
                resolve(null);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    raw<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    raw<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    raw<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        logger.debug(sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            logger.warn('MYSQL not suppouted sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T[]>(async (resolve, reject) => {
            try {
                const [result] = await this[_daoConnection].query(sql, params);
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    logger.trace(result);
                }
                if (result) resolve(result.map((i: any) => Object.values(i)[0]));
                resolve([]);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    query<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    query<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    query<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        logger.debug(sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            logger.warn('MYSQL not suppouted sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T[]>(async (resolve, reject) => {
            try {
                const [result] = await this[_daoConnection].query(sql, params);
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    logger.trace(result);
                }
                resolve(result);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    realse(sync: SyncMode.Sync): void;
    realse(sync: SyncMode.Async): Promise<void>;
    realse(sync: SyncMode): Promise<void> | void {
        if (sync === SyncMode.Sync) {
            try {
                this[_daoConnection]?.release();
            } catch (error) {

            }
        };
    }
}
export class Mysql implements Dao {
    [_daoDB]: any;
    constructor(pool: any) {
        this[_daoDB] = pool;
    }

    async keepAlive() {
        const connection = await this[_daoDB].getConnection();
        connection.query('SELECT 1 FROM DUAL');
        setTimeout(async () => await this.keepAlive(), 60000);
    }

    createConnection(sync: SyncMode.Sync): Connection | null;
    createConnection(sync: SyncMode.Async): Promise<Connection | null>;
    createConnection(sync: SyncMode): Connection | null | Promise<Connection | null> {
        if (sync === SyncMode.Sync) {
            logger.error('MYSQL not suppouted sync mode');
            return null;
        };
        return new Promise<Connection>(async (resolve, reject) => {
            try {
                const connection = await this[_daoDB].getConnection();
                logger.debug('create new connection!');
                resolve(new MysqlConnection(connection));
            } catch (error) {
                reject(error);
            }
        });
    }

    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    transaction<T = any>(sync: SyncMode, fn: (conn: Connection) => T | Promise<T>, conn?: Connection | null): T | null | Promise<T | null> {
        if (sync === SyncMode.Sync) {
            logger.warn('MYSQL not suppouted sync mode');
            return null;
        };
        return new Promise<T>(async (resolve, reject) => {
            let needCommit = false;
            let newConn = false;
            if (!conn) {
                conn = await this.createConnection(SyncMode.Async) ?? undefined;
                newConn = true;
            }
            if (conn?.[_inTransaction] !== true) {
                needCommit = true;
                logger.debug('beginTransaction begin!');
                await conn![_daoConnection].beginTransaction();
                logger.debug('beginTransaction end!');
            }
            conn![_inTransaction] = true;
            try {
                const result = await fn(conn!);
                if (needCommit) {
                    logger.debug('commit begin!');
                    await conn![_daoConnection].commit();
                    conn![_inTransaction] = false;
                    logger.debug('commit end!');
                }
                resolve(result);
            } catch (error) {
                logger.debug('rollback begin!');
                await conn![_daoConnection].rollback();
                logger.debug('rollback end!');
                conn![_inTransaction] = false;
                logger.error(error);
                reject(error);
            } finally {
                try {
                    if (needCommit) {
                        conn![_inTransaction] = false;
                    }
                    if (newConn) {
                        logger.debug('release begin!');
                        conn![_daoConnection].release();
                        logger.debug('release end!');
                    }
                } catch (error) {
                }
            }
        });
    }

    close(sync: SyncMode.Sync): void;
    close(sync: SyncMode.Async): Promise<void>;
    close(sync: SyncMode): Promise<void> | void {
        if (sync === SyncMode.Sync) {
            this[_daoDB]?.destroy();
        };
    }

    backup(sync: SyncMode.Sync, name: string): void;
    backup(sync: SyncMode.Async, name: string): Promise<void>;
    backup(sync: SyncMode, name: string): Promise<void> | void {
    }

    remove(sync: SyncMode.Sync): void;
    remove(sync: SyncMode.Async): Promise<void>;
    remove(sync: SyncMode): Promise<void> | void {
    }

    restore(sync: SyncMode.Sync, name: string): void;
    restore(sync: SyncMode.Async, name: string): Promise<void>;
    restore(sync: SyncMode, name: string): Promise<void> | void {
    }
}

class PostgresqlConnection implements Connection {
    [_daoConnection]: any;
    [_inTransaction] = false;
    constructor(conn: any) {
        this[_daoConnection] = conn;
    }

    execute(sync: SyncMode.Sync, sql?: string, params?: any): { affectedRows: number; insertId: bigint; };
    execute(sync: SyncMode.Async, sql?: string, params?: any): Promise<{ affectedRows: number; insertId: bigint; }>;
    execute(sync: SyncMode, sql?: string, params?: any): { affectedRows: number; insertId: bigint; } | Promise<{ affectedRows: number; insertId: bigint; }> {
        logger.debug(sql, params ?? '');
        if (!sql) { return { affectedRows: 0, insertId: 0n }; };
        if (sync === SyncMode.Sync) {
            logger.warn('Postgresql not suppouted sync mode');
            return { affectedRows: 0, insertId: 0n };
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<{ affectedRows: number; insertId: bigint; }>(async (resolve, reject) => {
            try {
                let index = 1;
                const { rowCount } = await this[_daoConnection].query({
                    text: sql.replace(/\?/g, () => `$${index++}`),
                    values: params
                });
                const result = rowCount as any;
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    logger.trace(result);
                }
                resolve({ affectedRows: result.affectedRows, insertId: result.insertId });
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    pluck<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    pluck<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    pluck<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        logger.debug(sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            logger.warn('Postgresql not suppouted sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T | null>(async (resolve, reject) => {
            try {
                let index = 1;
                const { rows } = await this[_daoConnection].query({
                    text: sql.replace(/\?/g, () => `$${index++}`),
                    values: params
                });
                if (rows && rows[0]) {
                    const r = Object.values(rows[0])[0];
                    if (r === null) resolve(r);
                    else resolve(r as T);
                }
                resolve(null);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    get<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    get<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    get<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        logger.debug(sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            logger.warn('Postgresql not suppouted sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T | null>(async (resolve, reject) => {
            try {
                let index = 1;
                const { rows } = await this[_daoConnection].query({
                    text: sql.replace(/\?/g, () => `$${index++}`),
                    values: params
                });
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    logger.trace(rows);
                }
                if (rows && rows[0]) resolve(rows[0] as T);
                resolve(null);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    raw<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    raw<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    raw<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        logger.debug(sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            logger.warn('Postgresql not suppouted sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T[]>(async (resolve, reject) => {
            try {
                let index = 1;
                const { rows } = await this[_daoConnection].query({
                    text: sql.replace(/\?/g, () => `$${index++}`),
                    values: params
                });
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    logger.trace(rows);
                }
                if (rows) resolve(rows.map((i: any) => Object.values(i)[0]));
                resolve([]);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    query<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    query<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    query<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        logger.debug(sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            logger.warn('Postgresql not suppouted sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T[]>(async (resolve, reject) => {
            try {
                let index = 1;
                const { rows } = await this[_daoConnection].query({
                    text: sql.replace(/\?/g, () => `$${index++}`),
                    values: params
                });
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    logger.trace(rows);
                }
                resolve(rows);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    realse(sync: SyncMode.Sync): void;
    realse(sync: SyncMode.Async): Promise<void>;
    realse(sync: SyncMode): Promise<void> | void {
        if (sync === SyncMode.Sync) {
            try {
                this[_daoConnection]?.release();
            } catch (error) {

            }
        };
    }
}
export class Postgresql implements Dao {
    [_daoDB]: any;
    constructor(pool: any) {
        this[_daoDB] = pool;
    }

    async keepAlive() {
        const connection = await this[_daoDB].connect();
        connection.query('SELECT 1');
        setTimeout(async () => await this.keepAlive(), 60000);
    }

    createConnection(sync: SyncMode.Sync): Connection | null;
    createConnection(sync: SyncMode.Async): Promise<Connection | null>;
    createConnection(sync: SyncMode): Connection | null | Promise<Connection | null> {
        if (sync === SyncMode.Sync) {
            logger.error('Postgresql not suppouted sync mode');
            return null;
        };
        return new Promise<Connection>(async (resolve, reject) => {
            try {
                const connection = await this[_daoDB].connect();
                logger.debug('create new connection!');
                resolve(new PostgresqlConnection(connection));
            } catch (error) {
                reject(error);
            }
        });
    }

    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    transaction<T = any>(sync: SyncMode, fn: (conn: Connection) => T | Promise<T>, conn?: Connection | null): T | null | Promise<T | null> {
        if (sync === SyncMode.Sync) {
            logger.warn('Postgresql not suppouted sync mode');
            return null;
        };
        return new Promise<T>(async (resolve, reject) => {
            let needCommit = false;
            let newConn = false;
            if (!conn) {
                conn = await this.createConnection(SyncMode.Async) ?? undefined;
                newConn = true;
            }
            if (conn?.[_inTransaction] !== true) {
                needCommit = true;
                logger.debug('beginTransaction begin!');
                await conn![_daoConnection].query('BEGIN');
                logger.debug('beginTransaction end!');
            }
            conn![_inTransaction] = true;
            try {
                const result = await fn(conn!);
                if (needCommit) {
                    logger.debug('commit begin!');
                    await conn![_daoConnection].query('COMMIT');
                    conn![_inTransaction] = false;
                    logger.debug('commit end!');
                }
                resolve(result);
            } catch (error) {
                logger.debug('rollback begin!');
                await conn![_daoConnection].query('ROLLBACK');
                logger.debug('rollback end!');
                conn![_inTransaction] = false;
                logger.error(error);
                reject(error);
            } finally {
                try {
                    if (needCommit) {
                        conn![_inTransaction] = false;
                    }
                    if (newConn) {
                        logger.debug('release begin!');
                        conn![_daoConnection].release();
                        logger.debug('release end!');
                    }
                } catch (error) {
                }
            }
        });
    }

    close(sync: SyncMode.Sync): void;
    close(sync: SyncMode.Async): Promise<void>;
    close(sync: SyncMode): Promise<void> | void {
        if (sync === SyncMode.Sync) {
            this[_daoDB]?.end();
        };
    }

    backup(sync: SyncMode.Sync, name: string): void;
    backup(sync: SyncMode.Async, name: string): Promise<void>;
    backup(sync: SyncMode, name: string): Promise<void> | void {
    }

    remove(sync: SyncMode.Sync): void;
    remove(sync: SyncMode.Async): Promise<void>;
    remove(sync: SyncMode): Promise<void> | void {
    }

    restore(sync: SyncMode.Sync, name: string): void;
    restore(sync: SyncMode.Async, name: string): Promise<void>;
    restore(sync: SyncMode, name: string): Promise<void> | void {
    }
}
class SqliteConnection implements Connection {
    [_daoConnection]: any;
    [_inTransaction] = false;
    constructor(conn: any) {
        this[_daoConnection] = conn;
    }

    execute(sync: SyncMode.Sync, sql?: string, params?: any): { affectedRows: number; insertId: bigint; };
    execute(sync: SyncMode.Async, sql?: string, params?: any): Promise<{ affectedRows: number; insertId: bigint; }>;
    execute(sync: SyncMode, sql?: string, params?: any): { affectedRows: number; insertId: bigint; } | Promise<{ affectedRows: number; insertId: bigint; }> {
        try {
            logger.debug(sql, params ?? '');
            if (!sql) { return { affectedRows: 0, insertId: 0n }; };
            if (sync === SyncMode.Async) {
                logger.warn(`SQLITE not suppoted async mode`);
                return { affectedRows: 0, insertId: 0n };
            };
            if (globalThis[_GlobalSqlOption].log === 'trace') {
                logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
            }
            const result = this[_daoConnection].prepare(sql).run(params ?? {});
            if (globalThis[_GlobalSqlOption].log === 'trace') {
                logger.trace(result);
            }
            const { changes, lastInsertRowid } = result;
            return { affectedRows: changes, insertId: lastInsertRowid ? BigInt(lastInsertRowid) : 0n };
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }

    pluck<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    pluck<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    pluck<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        try {
            logger.debug(sql, params ?? '');
            if (!sql) { return null };
            if (sync === SyncMode.Async) {
                logger.warn(`SQLITE not suppoted async mode`);
                return null;
            };
            if (globalThis[_GlobalSqlOption].log === 'trace') {
                logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
            }
            return this[_daoConnection].prepare(sql).pluck().get(params ?? {});
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }

    get<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    get<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    get<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        try {
            logger.debug(sql, params ?? '');
            if (!sql) { return null };
            if (sync === SyncMode.Async) { return null };
            if (globalThis[_GlobalSqlOption].log === 'trace') {
                logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
            }
            return this[_daoConnection].prepare(sql).get(params ?? {});
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }

    raw<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    raw<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    raw<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        try {
            logger.debug(sql, params ?? '');
            if (!sql) { return []; };
            if (sync === SyncMode.Async) {
                logger.warn(`SQLITE not suppoted async mode`);
                return [];
            };
            if (globalThis[_GlobalSqlOption].log === 'trace') {
                logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
            }
            return this[_daoConnection].prepare(sql).raw().all(params ?? {});
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }

    query<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    query<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    query<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        try {
            logger.debug(sql, params ?? '');
            if (!sql) { return []; };
            if (sync === SyncMode.Async) {
                logger.warn(`SQLITE not suppoted async mode`);
                return [];
            };
            if (globalThis[_GlobalSqlOption].log === 'trace') {
                logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
            }
            return this[_daoConnection].prepare(sql).all(params ?? {});
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }

    realse(sync: SyncMode.Sync): void;
    realse(sync: SyncMode.Async): Promise<void>;
    realse(sync: SyncMode): Promise<void> | void {
    }
}
export class Sqlite implements Dao {
    [_daoDB]: any;
    constructor(db: any) {
        this[_daoDB] = db;
        this[_daoDB].pragma('journal_mode = WAL');
        this[_daoDB].exec(`
            CREATE TABLE IF NOT EXISTS DUAL ( ______id INTEGER NOT NULL, PRIMARY KEY ( ______id ));
            DELETE FROM DUAL;
            INSERT INTO DUAL (______id ) VALUES ( 1 );
            CREATE TABLE IF NOT EXISTS TABLE_VERSION (
            ______tableName text NOT NULL,
            ______version text NOT NULL,
            PRIMARY KEY ( ______tableName )
            );
        `);
        this[_daoDB].function('UUID_SHORT', { deterministic: false }, () => snowflake.generate());
        this[_daoDB].function('UUID', { deterministic: false }, () => snowflake.generate());
        this[_daoDB].function('TIME_TO_SEC', { deterministic: true }, (time: string) => time.split(':').map((v, i) => parseInt(v) * (i === 0 ? 360 : i === 1 ? 60 : 0)).reduce((a, b) => a + b, 0));
        this[_daoDB].function('IF', { deterministic: true }, (condition: any, v1: any, v2: any) => condition ? v1 : v2);
        this[_daoDB].function('RIGHT', { deterministic: true }, (src: string, p: number) => src.slice(p * -1));
        this[_daoDB].function('LEFT', { deterministic: true }, (str: string, len: number) => str?.substring(0, len) || null);
        this[_daoDB].function('NOW', { deterministic: false }, () => new Date().toISOString().slice(0, 19).replace('T', ' '));
        this[_daoDB].function('CURDATE', { deterministic: false }, () => new Date().toISOString().split('T')[0]);
        this[_daoDB].function('DATE_FORMAT', { deterministic: true }, (dateStr: string, format: string) => {
            const date = new Date(dateStr);
            return format
                .replace('%Y', date.getFullYear().toString())
                .replace('%m', (date.getMonth() + 1).toString().padStart(2, '0'))
                .replace('%d', date.getDate().toString().padStart(2, '0'))
                .replace('%H', date.getHours().toString().padStart(2, '0'))
                .replace('%i', date.getMinutes().toString().padStart(2, '0'))
                .replace('%s', date.getSeconds().toString().padStart(2, '0'));
        });
        this[_daoDB].function('RAND', { deterministic: false }, () => Math.random());
        this[_daoDB].function('UNIX_TIMESTAMP', { deterministic: false },
            (dateStr?: string) => dateStr
                ? Math.floor(new Date(dateStr).getTime() / 1000)
                : Math.floor(Date.now() / 1000)
        );
    }

    createConnection(sync: SyncMode.Sync): Connection | null;
    createConnection(sync: SyncMode.Async): Promise<Connection | null>;
    createConnection(sync: SyncMode): Connection | null | Promise<Connection | null> {
        if (sync === SyncMode.Async) {
            logger.error(`SQLITE not suppoted async mode`);
            return null;
        };
        return new SqliteConnection(this[_daoDB]);
    }

    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    transaction<T = any>(sync: SyncMode, fn: (conn: Connection) => T | Promise<T>, conn?: Connection | null): T | null | Promise<T | null> {
        if (sync === SyncMode.Async) {
            logger.warn(`SQLITE not suppoted async mode`);
            return null;
        };
        if (!conn) {
            conn = this.createConnection(SyncMode.Sync) ?? undefined;
        }
        if (conn![_inTransaction] !== true) {
            return this[_daoDB].transaction(() => {
                conn![_inTransaction] = true;
                const rt = fn(conn!);
                conn![_inTransaction] = false;
                return rt;
            })();
        } else {
            const rt = fn(conn!);
            return rt;
        }
    }



    close(sync: SyncMode.Sync): void;
    close(sync: SyncMode.Async): Promise<void>;
    close(sync: SyncMode): Promise<void> | void {
        if (sync === SyncMode.Sync) {
            this[_daoDB].close();
        };
    }

    backup(sync: SyncMode.Sync, name: string): void;
    backup(sync: SyncMode.Async, name: string): Promise<void>;
    backup(sync: SyncMode, name: string): Promise<void> | void {
        if (sync === SyncMode.Sync) {
            this[_daoDB].backup(name);
        };
    }

    remove(sync: SyncMode.Sync): void;
    remove(sync: SyncMode.Async): Promise<void>;
    remove(sync: SyncMode): Promise<void> | void {
    }

    restore(sync: SyncMode.Sync, name: string): void;
    restore(sync: SyncMode.Async, name: string): Promise<void>;
    restore(sync: SyncMode, name: string): Promise<void> | void {
    }
}
export class SqliteRemoteConnection implements Connection {
    [_daoConnection]: SqliteRemoteInterface;
    [_sqliteRemoteName]: string;
    [_inTransaction] = false;
    constructor(conn: SqliteRemoteInterface, name: string) {
        this[_daoConnection] = conn;
        this[_sqliteRemoteName] = name;
    }

    execute(sync: SyncMode.Sync, sql?: string, params?: any): { affectedRows: number; insertId: bigint; };
    execute(sync: SyncMode.Async, sql?: string, params?: any): Promise<{ affectedRows: number; insertId: bigint; }>;
    execute(sync: SyncMode, sql?: string, params?: any): { affectedRows: number; insertId: bigint; } | Promise<{ affectedRows: number; insertId: bigint; }> {
        logger.debug(sql, params ?? '');
        if (!sql) { return { affectedRows: 0, insertId: 0n }; };
        if (sync === SyncMode.Sync) {
            logger.warn('SqliteRemote not suppouted sync mode');
            return { affectedRows: 0, insertId: 0n };
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<{ affectedRows: number; insertId: bigint; }>(async (resolve, reject) => {
            try {
                const data = await this[_daoConnection].execute(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                const { affectedRows, insertId } = decode(data, { extensionCodec }) as { affectedRows: number; insertId: bigint; };
                resolve({ affectedRows, insertId: insertId ? BigInt(insertId) : 0n });
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    pluck<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    pluck<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    pluck<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        logger.debug(sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            logger.warn('SqliteRemote not suppouted sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T | null>(async (resolve, reject) => {
            try {
                const data = await this[_daoConnection].pluck(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                const r = decode(data, { extensionCodec }) as T;
                resolve(r);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    get<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    get<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    get<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        logger.debug(sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            logger.warn('SqliteRemote not suppouted sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T | null>(async (resolve, reject) => {
            try {
                const data = await this[_daoConnection].get(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                const r = decode(data, { extensionCodec }) as T;
                resolve(r);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    raw<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    raw<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    raw<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        logger.debug(sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            logger.warn('SqliteRemote not suppouted sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T[]>(async (resolve, reject) => {
            try {
                const data = await this[_daoConnection].raw(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                const r = decode(data, { extensionCodec }) as T[];
                resolve(r);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    query<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    query<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    query<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        logger.debug(sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            logger.warn('SqliteRemote not suppouted sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            logger.trace(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return new Promise<T[]>(async (resolve, reject) => {
            try {
                const data = await this[_daoConnection].query(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                const r = decode(data, { extensionCodec }) as T[];
                resolve(r);
            } catch (error) {
                logger.error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                reject(error);
            }
        });
    }

    realse(sync: SyncMode.Sync): void;
    realse(sync: SyncMode.Async): Promise<void>;
    realse(sync: SyncMode): Promise<void> | void {
    }
}
export class SqliteRemote implements Dao {
    [_sqliteRemoteName]: string;
    [_daoDB]: SqliteRemoteInterface;
    private connection?: SqliteRemoteConnection;

    constructor(db: SqliteRemoteInterface, name: string) {
        this[_daoDB] = db;
        this[_sqliteRemoteName] = name;
    }


    createConnection(sync: SyncMode.Sync): Connection | null;
    createConnection(sync: SyncMode.Async): Promise<Connection | null>;
    createConnection(sync: SyncMode): Connection | null | Promise<Connection | null> {
        if (sync === SyncMode.Sync) {
            logger.error('SQLITEREMOTE not suppouted sync mode');
            return null;
        };
        return new Promise<Connection>(async (resolve, reject) => {
            if (!this.connection) {
                this.connection = new SqliteRemoteConnection(this[_daoDB], this[_sqliteRemoteName]);
            }
            try {
                resolve(this.connection);
            } catch (error) {
                reject(error);
            }
        });
    }

    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    transaction<T = any>(sync: SyncMode, fn: (conn: Connection) => T | Promise<T>, conn?: Connection | null): T | null | Promise<T | null> {
        logger.warn(`SQLITEREMOTE not suppoted transaction`);
        return null;
    }


    close(sync: SyncMode.Sync): void;
    close(sync: SyncMode.Async): Promise<void>;
    close(sync: SyncMode): Promise<void> | void {
        if (sync === SyncMode.Async) {
            return this[_daoDB]?.close(this[_sqliteRemoteName]);
        };
    }

    backup(sync: SyncMode.Sync, exportPath: string): void;
    backup(sync: SyncMode.Async, exportPath: string): Promise<void>;
    backup(sync: SyncMode, exportPath: string): Promise<void> | void {
        if (sync === SyncMode.Async) {
            return this[_daoDB]?.export(this[_sqliteRemoteName], exportPath);
        };
    }

    remove(sync: SyncMode.Sync): void;
    remove(sync: SyncMode.Async): Promise<void>;
    remove(sync: SyncMode): Promise<void> | void {

    }

    restore(sync: SyncMode.Sync, importPath: string): void;
    restore(sync: SyncMode.Async, importPath: string): Promise<void>;
    restore(sync: SyncMode, importPath: string): Promise<void> | void {
        if (sync === SyncMode.Async) {
            return this[_daoDB]?.restore(this[_sqliteRemoteName], importPath,);
        };
    }
}
// #endregion

// #region 查询sql
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
type _SqlModel = Record<string, string | (
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
class Build {
    private static page = 'COUNT(1) zccw1986 ';
    private isCount: boolean;
    private isSum: boolean;
    private orderBy: string;
    private orderSeted: boolean = false;
    /**
     *
     * @param count 是否是count查询
     * @param isSum  是否是sum查询
     * @param param 
     */
    constructor(
        isCount: boolean,
        isSum: boolean,
        param: {
            ctx?: any;
            isCount?: boolean;
            isSum?: boolean;
            limitStart?: number;
            limitEnd?: number;
            sortName?: string;
            sortType?: string;
            [k: string]: any;
        } = {}
    ) {
        this.isCount = isCount;
        this.isSum = isSum;
        this.orderBy = param.sortName ? `${param.sortName} ${param.sortType ?? 'ASC'}` : '';
        Object.assign(this, param);
    }
    /**
     *
     * 当分页时将函数内包含的内容替换为COUNT(1)
     * @returns
     * @memberof Build
     */
    page() {
        return (text: string, render: (text: string) => string) => {
            if (this.isCount) {
                return Build.page;
            } else if (this.isSum !== true) {
                return render(text);
            }
        };
    }
    /**
   *
   * 包含的内容只在汇总查询时有效，否则是空白
   * @returns
   * @memberof Build
   */
    sum() {
        return (text: string, render: (text: string) => string) => {
            if (this.isSum !== true) {
                return '';
            } else {
                return render(text);
            }
        };
    }

    /**
     *
     * 当分页时、汇总时忽略函数内包含的内容
     * @returns
     * @memberof Build
     */
    notPage() {
        return (text: string, render: (text: string) => string) => {
            if (this.isCount || this.isSum) {
                return '';
            } else {
                return render(text);
            }
        };
    }
    /**
     *
     * 将查询条件包起来，如果条件内容不为空，则自动添加WHERE,同时将第一个条件的and、or替换为空
     * 例如:
     * {{#whereTag}}
     * and name = 1
     * and page = 2
     * {{/whereTag}}
     * 输出
     * where name = 1 and page = 2
     * @returns
     * @memberof Build
     */
    where() {
        return (text: string, render: (text: string) => string) => {
            let data = render(text).trim();
            if (data) {
                data = data.replace(/and|or/i, '');
                return ` WHERE ${data} `;
            } else {
                return '';
            }
        };
    }
    /**
     * ```
     * SELECT
     * {{#hump}}
     * a.event_id, a.event_name eventName
     * {{/hump}}
     * FROM...
     * ```
     * 编译后:
     * ```
     * SELECT
     * a.event_id eventId, a.event_name eventName
     * FROM...
     * ```
     */
    hump() {
        return (text: string, render: (text: string) => string) => {
            let data = render(text).trim();
            const datas = data.split(',');
            for (let i = 0; i < datas.length; i++) {
                if (datas[i]?.match(/\s|\t/) === null) {
                    datas[i] = `${datas[i]} ${datas[i]!.replace(/[a-zA-Z0-9]+\./, '').replace(/_([a-z])/g, (a, b, c) => b.toUpperCase())}`;
                }
            }
            return ` ${datas.join(',')} `;
        };
    }
    /**
     * 删除第一个and、or
     * 删除最后一个,
     * 删除最后一个;
     * @memberof Build
     */
    trim() {
        return (text: string, render: (text: string) => string) => {
            let data = render(text);
            data = data.trim();
            if (data) {
                data = data.replace(/(^and\s)|(^or\s)|(,$)|(;$)/i, '');
                return data;
            } else {
                return '';
            }
        };
    }
    /**
     * 分页时将排序部分代码用此函数包起来，可以自动拼接order by
     * 查询条数时，自动忽略此部分
     * etc
     * {{#order}} name desc, age asc {{/order}}
     * ===
     * ORDER BY name desc, age asc
     * @returns
     * @memberof Build
     */
    order() {
        return (text: string, render: (text: string) => string) => {
            if (this.isCount || this.isSum) {
                return '';
            } else {
                this.orderSeted = true;
                const orderBy = new Array<string>();
                if (this.orderBy) {
                    orderBy.push(this.orderBy);
                }
                const renderOrder = render(text);
                if (/\S/.test(renderOrder)) {
                    orderBy.push(renderOrder);
                }
                return orderBy.length > 0 ? ` ORDER BY ${orderBy.join(',')} ` : '';
            }
        };
    }

    /**
     *
     * 分页时将分组部分代码用此函数包起来，可以自动拼接GROUP BY
     * 当分页时、汇总时，自动忽略此部分
     * etc
     * {{#between}} name, age {{/between}}
     * ===
     * group by name.age
     * @returns
     * @memberof Build
     */
    group() {
        return (text: string, render: (text: string) => string) => {
            if (this.isCount || this.isSum) {
                return '';
            } else {
                const groupBy = render(text) || '';
                return /\S/.test(groupBy) ? ` GROUP BY ${groupBy} ` : '';
            }
        };
    }

    /**
     *
     * # beetween and
     * ## etc.
     * ```
     * {{#between}} AND t.createtime ({{createtime}}) {{/between}}
     * // 其中：
     * createtime = '1,2'
     * // 或者
     * createtime = ['1', '2']
     * // 将生成：
     * AND t.createtime BETWEEN '1' AND '2'
     * ```
     * @returns
     * @memberof Build
     */
    between() {
        return (text: string, render: (text: string) => string) => {
            const result = render(text);
            if (/\(([\w\W]+)\)/.exec(result)) {
                return render(text).replace(/\(([\w\W]+)\)/, (a, b) => {
                    if (a && b) {
                        if (typeof b === 'string') {
                            const xx = b.split(',');
                            return ` BETWEEN '${xx[0]}' AND '${xx[1]}'`;
                        } else {
                            return ` BETWEEN '${b[0]}' AND '${b[1]}'`;
                        }
                    } else {
                        return '';
                    }
                }).replace(/\|/, ' BETWEEN ');
            } else {
                return '';
            }
        };
    }

    /**
     *
     * 距离计算,单位米
     * etc
     * {{#distance}} (t.longitude, t.latitude), ({{longitude}}, {{latitude}}) {{/distance}}
     * ===
     * ROUND(ST_DISTANCE(POINT(longitude1, latitude1), POINT({{longitude}}, {{latitude}}))*111195, 2)
     * 可根据需求自行将数据转换为千米，例如
     * {{#distance}} (t.longitude, t.latitude), ({{longitude}}, {{latitude}}) {{/distance}} / 1000
     * @returns
     * @memberof Build
     */
    distance() {
        return (text: string, render: (text: string) => string) => {
            const result = render(text);
            if (/\(([^()]+)\)/.exec(result)) {
                let index = 0;
                return render(text).replace(/\(([^()]+)\)/g, (a, b) => {
                    if (a && b) {
                        const xx = b.split(',');
                        if (index === 0) {
                            index++;
                            return ` ROUND(ST_DISTANCE(POINT(${xx[0]}, ${xx[1]}) `;
                        } else {
                            return ` POINT(${xx[0]}, ${xx[1]}))*111195, 2)`;
                        }
                    } else {
                        return '';
                    }
                });
            } else {
                return '';
            }
        };
    }
    /**
     * * PROBLEM_TYPE = 枚举名
     * * t.problemtype = 列名
     *
     * ```
     * {{#enumTag}} PROBLEM_TYPE(t.problemtype) {{/enumTag}}
     * ```
     */
    enum() {
        return (text: string) => {
            const matchs = text.match(/([a-zA-Z_]+)\(([^()]+)\)/);
            if (matchs) {
                const [_a, MapName, Column] = matchs;
                if (MapName && Column) {
                    const map = globalThis[_enum].EnumMap(MapName.trim());
                    if (map) {
                        return ` CASE
    ${Object.entries(map).map(([k, v]) => `WHEN ${Column} = '${k}' THEN '${v}'`).join(' ')}
    END `;
                    }
                }
            }
            return "''";
        };
    }

    get OrderSeted() {
        return this.orderSeted;
    }
    get OrderBy() {
        return this.orderBy;
    }
}

function replaceCdata(rawText: string) {
    var cdataRegex = new RegExp('(<!\\[CDATA\\[)([\\s\\S]*?)(\\]\\]>)', 'g');
    var matches = rawText.match(cdataRegex);

    if (matches != null && matches.length > 0) {
        for (var z = 0; z < matches.length; z++) {
            var regex = new RegExp('(<!\\[CDATA\\[)([\\s\\S]*?)(\\]\\]>)', 'g');
            var m = regex.exec(matches[z]!);

            var cdataText = m![2];
            cdataText = cdataText!.replace(/\&/g, '&amp;');
            cdataText = cdataText!.replace(/\</g, '&lt;');
            cdataText = cdataText!.replace(/\>/g, '&gt;');
            cdataText = cdataText!.replace(/\"/g, '&quot;');

            rawText = rawText.replace(m![0], cdataText);
        }
    }
    return rawText;
}
function _flatData(result: any, i: number, length: number, keys: string[], V: any, convert?: (data: any) => any) {
    const key = keys[i];
    if (i < length) {
        result[key!] ??= {};
        i++;
        _flatData(result[key!], i, length, keys, V);
    } else {
        if (convert) {
            result[key!] = convert(V);
        }
        else {
            result[key!] = V;
        }
    }
}
/**
 * ifUndefined默认是MapperIfUndefined.Skip
 */
export function flatData<M>(options: { data: any; mapper: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; }): M {
    if (typeof options.mapper === 'string') {
        const name = options.mapper;
        options.mapper = globalThis[_resultMap][name];
        Throw.if(!options.mapper, `not found mapper!${name}`);
    }
    options.mapperIfUndefined ??= MapperIfUndefined.Skip;
    options.mapper = options.mapper as SqlMapper;
    const result: any = {};
    for (const { columnName, mapNames, def, convert } of options.mapper) {
        let V = options.data[columnName];
        if (V === undefined) {
            if (options.mapperIfUndefined === MapperIfUndefined.Null) {
                V = null;
            } else if (options.mapperIfUndefined === MapperIfUndefined.Zero) {
                V = 0;
            } else if (options.mapperIfUndefined === MapperIfUndefined.EmptyString) {
                V = '';
            } else if (def !== undefined) {
                V = def;
            } else {
                continue;
            }
        }
        _flatData(result, 0, mapNames.length - 1, mapNames, V, convert);
    }
    return result;
}

export class SqlCache {
    private sqlMap: _SqlModel = {};
    private sqlFNMap: PartialsOrLookupFn = {};
    private async _read(jsMode: boolean, sqlDir: string, queryTypes: string[], rootName: string) {
        const sqlFis = globalThis[_fs].readdirSync(sqlDir);
        for (const modeName of sqlFis) {
            const file = globalThis[_path].join(sqlDir, modeName);
            const stat = globalThis[_fs].statSync(file);
            if (stat.isDirectory()) {
                await this._read(jsMode, file, queryTypes, modeName);
            } else {
                const extname = globalThis[_path].extname(modeName);
                const name = globalThis[_path].basename(modeName, extname);
                let ct = 0;
                if (extname === '.mu') {
                    logger.debug(`sql: ${file} start explain!`);
                    const parser = new MUParser(rootName || name, globalThis[_fs].readFileSync(file, { encoding: 'utf-8' }).toString());
                    let source = parser.next();
                    while (source != null) {
                        ct++;
                        this.sqlMap[source[0]] = source[1];
                        logger.debug(`sql: ${source[0]} found!`);
                        source = parser.next();
                    }
                    logger.debug(`sql: ${file} explain over[${ct}]!`);
                } else if (jsMode && extname === '.js') {
                    logger.debug(`sql: ${file} start explain!`);
                    const obj = (await import(globalThis[_path].join(sqlDir, modeName))).default as _SqlModel;
                    for (const [key, fn] of Object.entries(obj)) {
                        ct++;

                        this.sqlMap[`${rootName || name}.${String(key)}`] = fn;
                    }
                    logger.debug(`sql: ${file} explain over[${ct}]!`);
                } else if (extname === '.xml') {
                    logger.debug(`sql: ${file} start explain!`);
                    const root = (HTML.parse(replaceCdata(globalThis[_fs].readFileSync(file, { encoding: 'utf-8' }).toString())) as XML[])[0];
                    if (root) {
                        const mappers = root.children;
                        for (const mapper of mappers) {
                            if (mapper.type === 'tag' && mapper.name === 'mapper') {
                                for (const am of mapper.children) {
                                    if (am.type === 'tag') {
                                        Throw.if(!queryTypes.includes(am.name), `${rootName} ${name}错误,${am.name}不支持!`);
                                        am.id = am.attrs['id'];
                                        Throw.if(!am.id, `${rootName} ${name}错误,没有为此块设置id:${am}`);
                                        if (am.name === 'resultMap') {
                                            ct++;
                                            globalThis[_resultMap] ??= {};
                                            const keys: SqlMapper = [];
                                            this.readResultMap(am.children, keys, []);
                                            globalThis[_resultMap][`${rootName || name}.${am.id}`] = keys;
                                            logger.debug(`sql_resultMap: ${`${rootName || name}.${am.id}`} found!`);
                                        } else {
                                            this.sqlMap[`${rootName || name}.${am.id!}`] = am.children;
                                            if (am.attrs['resultMap']) {
                                                globalThis[_resultMap_SQLID][`${rootName || name}.${am.id!}`] = am.attrs['resultMap'];
                                                logger.debug(`sql: autoMapper: ${rootName || name}.${am.id!}-${am.attrs['resultMap']}`);
                                            }
                                            logger.debug(`sql: ${rootName || name}.${am.id!} found!`);
                                            ct++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    logger.debug(`sql: ${file} explain over[${ct}]!`);
                }

            }
        }
    }
    /**
     *
     * ```
    // 第一个元素=列名，第二个元素是属性路径，
    [
        ['dit_id', ['id']], // 列名ditid,对应属性id
        ['event_id', ['eventMainInfo', 'id']] // 列名event_id对应属性eventMainInfo.id
    ]
     * ```
     * @param am
     * @param keys 
     */
    private readResultMap(ams: XML[], keys: SqlMapper, key: string[]) {
        for (const am of ams) {
            if (am.type === 'tag') {
                if (am.name === 'result' || am.name === 'id') {
                    keys.push({
                        columnName: am.attrs['column']!,
                        mapNames: [...key!, am.attrs['property']!]
                    });
                } else {
                    this.readResultMap(am.children, keys, [...key, am.attrs['property']!])
                }
            }
        }
    }
    async init(options: {
        sqlMap?: _SqlModel; sqlDir?: string;
        sqlFNMap?: Record<string, string>; sqlFNDir?: string;
        sqlMapperMap?: SqlMappers; sqlMapperDir?: string;
        jsMode?: boolean;
    }) {
        if (options.sqlMap) {
            this.sqlMap = options.sqlMap;
        }
        const queryTypes = ['sql', 'select', 'insert', 'update', 'delete', 'resultMap'];
        if (options.sqlDir) {
            await this._read(options.jsMode === true, options.sqlDir, queryTypes, '');
        }
        if (options.sqlFNMap) {
            this.sqlFNMap = options.sqlFNMap;
        }
        if (options.sqlFNDir) {
            const sqlFis = globalThis[_fs].readdirSync(options.sqlDir);
            for (const modeName of sqlFis) {
                const extname = globalThis[_path].extname(modeName);
                const name = globalThis[_path].basename(modeName, extname);
                const file = globalThis[_path].join(options.sqlDir, modeName);
                if (extname === 'mu') {
                    this.sqlFNMap[name] = globalThis[_fs].readFileSync(file, { encoding: 'utf-8' }).toString();
                }
            }
        }
        if (options.sqlMapperMap) {
            globalThis[_resultMap] = options.sqlFNMap;
        }
        if (options.sqlMapperDir) {
            const sqlFis = globalThis[_fs].readdirSync(options.sqlDir);
            globalThis[_resultMap] ??= {};
            for (const modeName of sqlFis) {
                const extname = globalThis[_path].extname(modeName);
                const name = globalThis[_path].basename(modeName, extname);
                const file = globalThis[_path].join(options.sqlDir, modeName);
                if (extname === 'json') {
                    globalThis[_resultMap][name] = JSON.parse(globalThis[_fs].readFileSync(file, { encoding: 'utf-8' }).toString());
                }
            }
        }
    }
    load(sqlids: string[], options: {
        ctx?: any;
        isCount?: boolean;
        isSum?: boolean;
        limitStart?: number;
        limitEnd?: number;
        sortName?: string;
        sortType?: string;
        [k: string]: any;
    }): string {
        let sqlSource: any;
        for (const sqlid of sqlids) {
            sqlSource = this.sqlMap[sqlid];
            if (sqlSource) {
                break;
            }
        }
        const matchSqlid = sqlids.map(i => i.split('.')[0]!);
        Throw.if(!sqlSource, `指定的语句${sqlids.join('|')}不存在!`);
        const buildParam = new Build(options.isCount === true, options.isSum === true, options);
        if (typeof sqlSource === 'function') {
            const _sql = sqlSource(options);
            let sql = mustache.render(_sql, buildParam, this.sqlFNMap);
            if (buildParam.OrderSeted === false && buildParam.OrderBy && options.isCount !== true && options.isSum !== true) {
                sql += ` ORDER BY ${buildParam.OrderBy}`;
            }
            return sql;
        } else if (typeof sqlSource === 'string') {
            let sql = mustache.render(sqlSource, buildParam, this.sqlFNMap);
            if (buildParam.OrderSeted === false && buildParam.OrderBy && options.isCount !== true && options.isSum !== true) {
                sql += ` ORDER BY ${buildParam.OrderBy}`;
            }
            return sql;
        } else if (typeof sqlSource === 'object') {
            const _sql = convert(sqlSource, options, matchSqlid, this.sqlMap as Record<string, XML[]>);
            let sql = mustache.render(_sql, buildParam, this.sqlFNMap);
            if (buildParam.OrderSeted === false && buildParam.OrderBy && options.isCount !== true && options.isSum !== true) {
                sql += ` ORDER BY ${buildParam.OrderBy}`;
            }
            return sql;
        }
        return '';
    }
}
// #endregion

/**

## 所有service中内置方法定义规则
 ** 方法第一个参数必须是 sync: SyncMode
 ** 方法最后一个参数必须是 option

## sync 表示是否是同步方法

因为mysql是异步、sqlite是同步，导致必须通过一个标识来区分，否则将必须为两种数据库设置不同的service，失去了意义

## option 额外控制参数

## length
方法的参数数量
 */
function P<T extends object>(skipConn = false) {
    return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const fn = descriptor.value;
        descriptor.value = function (this: SqlService<T>, ...args: any[]) {
            let needRealseConn = true;
            const startTime = +new Date();
            // option
            const option = args[0] = Object.assign({}, globalThis[_GlobalSqlOption], this[_SqlOption], args[0]) as (MethodOption & { sync?: SyncMode; });
            option.sync ??= SyncMode.Async;
            option!.tableName = option?.tableName ?? this[_tableName];
            option!.dbName = option?.dbName ?? this[_daoDBName] ?? _primaryDB;
            option!.dbType = this[_dbType] ?? globalThis[_GlobalSqlOption].dbType ?? DBType.Mysql;
            option!.dao = globalThis[_dao][option!.dbType!][option!.dbName] as Dao;

            if (option!.dbType === DBType.Sqlite) {
                if (!option!.dao) {
                    const db = new Sqlite(new globalThis[_GlobalSqlOption].BetterSqlite3(option!.dbName as any, { fileMustExist: false }));
                    if (globalThis[_dao][option!.dbType!][_primaryDB] === undefined) {
                        globalThis[_dao][option!.dbType!][_primaryDB] = db;
                    }
                    globalThis[_dao][option!.dbType!][option!.dbName] = db;
                    option!.dao = db;
                }

                Throw.if(option.sync === SyncMode.Async, 'sqlite can not Async!')
                // 连接共享
                if (skipConn === false && !option!.conn) {
                    option!.conn = option!.dao.createConnection(SyncMode.Sync)!;
                } else {
                    needRealseConn = false;
                }
                try {
                    const result = fn.call(this, ...args);
                    logger.info(`${propertyKey}:${(option as any).sqlId ?? option!.tableName}:use ${+new Date() - startTime}ms`);
                    return result;
                } catch (error) {
                    console.error(`${(option as any).sqlId ?? option.tableName} service ${propertyKey} have an error:${error}, it's argumens: ${JSON.stringify(args.filter(i => typeof i !== 'object' || (typeof i === 'object' && !i.insert)))}`);
                    throw error;
                } finally {
                    if (needRealseConn && option && option!.conn) {
                        try {
                            option!.conn!.realse(SyncMode.Sync);
                        } catch (error) {
                        }
                    }
                }
            } else if (option!.dbType === DBType.SqliteRemote) {
                if (!option!.dao) {
                    globalThis[_GlobalSqlOption].SqliteRemote.service.initDB(option!.dbName);
                    const db = new SqliteRemote(globalThis[_GlobalSqlOption].SqliteRemote.service, option!.dbName as any);
                    if (globalThis[_dao][option!.dbType!][_primaryDB] === undefined) {
                        globalThis[_dao][option!.dbType!][_primaryDB] = db;
                    }
                    globalThis[_dao][option!.dbType!][option!.dbName] = db;
                    option!.dao = db;
                }

                Throw.if(option.sync === SyncMode.Sync, 'SqliteRemote remote can not sync!')
                return new Promise(async (resolve, reject) => {
                    // 连接共享
                    if (skipConn === false && !option!.conn) {
                        (option!).conn = await option!.dao!.createConnection(SyncMode.Async);
                    } else {
                        needRealseConn = false;
                    }
                    try {
                        const result = await fn.call(this, ...args);
                        logger.info(`${propertyKey}:${(option as any).sqlId ?? option!.tableName}:use ${+new Date() - startTime}ms`);
                        resolve(result);
                    } catch (error) {
                        console.error(`${(option as any).sqlId ?? option!.tableName} service ${propertyKey} have an error:${error}, it's argumens: ${JSON.stringify(args.filter(i => typeof i !== 'object' || (typeof i === 'object' && !i.insert)))}`)
                        reject(error);
                    } finally {
                        if (needRealseConn && option && option!.conn) {
                            try {
                                option!.conn!.realse(SyncMode.Sync);
                            } catch (error) {

                            }
                        }
                    }
                });

            } else if (option!.dbType === DBType.Mysql) {
                Throw.if(!option!.dao, `not found db:${String(option!.dbName)}(${option!.dbType})`);
                return new Promise(async (resolve, reject) => {
                    try {
                        // 连接共享
                        if (skipConn === false && !option!.conn) {
                            (option!).conn = await option!.dao!.createConnection(SyncMode.Async);
                        } else {
                            needRealseConn = false;
                        }
                        const result = await fn.call(this, ...args);
                        logger.info(`${propertyKey}:${(option as any).sqlId ?? option!.tableName}:use ${+new Date() - startTime}ms`);
                        resolve(result);
                    } catch (error) {
                        console.error(`${(option as any).sqlId ?? option!.tableName} service ${propertyKey} have an error:${error}, it's argumens: ${JSON.stringify(args.filter(i => typeof i !== 'object' || (typeof i === 'object' && !i.insert)))}`)
                        reject(error);
                    } finally {
                        if (needRealseConn && option && option!.conn) {
                            try {
                                option!.conn!.realse(SyncMode.Sync);
                            } catch (error) {

                            }
                        }
                    }
                });
            } else if (option!.dbType === DBType.Postgresql) {
                Throw.if(!option!.dao, `not found db:${String(option!.dbName)}(${option!.dbType})`);
                return new Promise(async (resolve, reject) => {
                    try {
                        // 连接共享
                        if (skipConn === false && !option!.conn) {
                            (option!).conn = await option!.dao!.createConnection(SyncMode.Async);
                        } else {
                            needRealseConn = false;
                        }
                        const result = await fn.call(this, ...args);
                        logger.info(`${propertyKey}:${(option as any).sqlId ?? option!.tableName}:use ${+new Date() - startTime}ms`);
                        resolve(result);
                    } catch (error) {
                        console.error(`${(option as any).sqlId ?? option!.tableName} service ${propertyKey} have an error:${error}, it's argumens: ${JSON.stringify(args.filter(i => typeof i !== 'object' || (typeof i === 'object' && !i.insert)))}`)
                        reject(error);
                    } finally {
                        if (needRealseConn && option && option!.conn) {
                            try {
                                option!.conn!.realse(SyncMode.Sync);
                            } catch (error) {

                            }
                        }
                    }
                });
            }
        };
    };
}
const FieldFilter = (
    K: string, V: any, def: any, uuidColumn: boolean,
    option?: MethodOption & { finalColumns?: Set<string>; tempColumns?: Array<string>; insert?: boolean; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; }
) => {
    let ret = 0;
    // 如果是插入操作且字段是UUID，则不进行空值检查
    // 只有在非插入或者非UUID时，进行空置检查
    if (option?.insert && uuidColumn) {
        ret = 1;
        if (V === undefined || emptyString(`${V ?? ''}`)) {
            V = null;
        }
    } else {
        if (V === null) {
            if (option?.skipNull !== true) {
                ret = 1;
                V = option?.insert && def && def.hasOwnProperty(K) ? def[K] : null;
            }
        } else if (V === undefined) {
            if (option?.skipUndefined !== true) {
                ret = 1;
                V = option?.insert && def && def.hasOwnProperty(K) ? def[K] : null;
            }
        } else if (emptyString(`${V ?? ''}`)) {
            if (option?.skipEmptyString !== true) {
                ret = 1;
                V = option?.insert && def && def.hasOwnProperty(K) ? def[K] : '';
            }
        } else {
            ret = 1;
        }
    }
    if (ret === 1) {
        option?.finalColumns?.add(K);
        option?.tempColumns?.push(K);
    }
    return [ret, V];
}
const formatDialects = {
    [DBType.Mysql]: mysql,
    [DBType.Sqlite]: sqlite,
    [DBType.SqliteRemote]: sqlite,
    [DBType.Postgresql]: postgresql,
};
export const DB = (config: ServiceOption) => {
    return function <C extends { new(...args: any[]): {} }>(constructor: C) {
        const __ids = Reflect.getMetadata(_ids, config.clz.prototype) || new Array<string>;
        const __logicIds = Reflect.getMetadata(_logicIds, config.clz.prototype) || new Array<string>;
        const __fields = Reflect.getMetadata(_fields, config.clz.prototype);
        const __columns = Reflect.getMetadata(_columns, config.clz.prototype);
        const __columnsNoId = Reflect.getMetadata(_columnsNoId, config.clz.prototype);
        const __stateFileName = Reflect.getMetadata(_stateFileName, config.clz.prototype);
        const __deleteState = Reflect.getMetadata(_deleteState, config.clz.prototype);
        const __index = Reflect.getMetadata(_index, config.clz.prototype);
        const __def = Reflect.getMetadata(_def, config.clz.prototype);
        const __dbType = config.dbType;
        const className = config.tableName?.replace(/_(\w)/g, (a: string, b: string) => b.toUpperCase());
        const ClassName = className?.replace(/\w/, (v: string) => v.toUpperCase());
        const vueName = config.tableName?.replace(/_/g, '-');
        return class extends constructor {
            [_tableName] = config.tableName;
            [_className] = className;
            [_ClassName] = ClassName;
            [_vueName] = vueName;

            [_daoDBName] = config.dbName;
            [_dbType] = __dbType;
            [_sqlite_version] = config.sqliteVersion;
            [_SqlOption] = Object.assign({}, _defOption, config);

            [_ids] = __ids;
            [_logicIds] = __logicIds;
            [_fields] = __fields;
            [_columns] = __columns;
            [_columnsNoId] = __columnsNoId;
            [_index] = __index;
            [_def] = __def;
            [_comment] = config.comment;
            [_stateFileName] = __stateFileName;
            [_deleteState] = __deleteState;

            [_transformer] = <L extends Object>(
                data: L,
                option?: MethodOption & {
                    finalColumns?: Set<string>;
                    tempColumns?: Array<string>;
                    insert?: boolean;
                    skipId?: boolean;
                    skipNull?: boolean;
                    skipUndefined?: boolean;
                    skipEmptyString?: boolean;
                    onFieldExists?: (K: string, V: any) => void;
                }
            ) => {
                return Object.fromEntries(
                    iterate(option?.skipId ? __columnsNoId : __columns)
                        .map(K => [K, FieldFilter(K as string, data[K as string], __def, __fields[K as string].uuid || __fields[K as string].uuidShort, option)])
                        .filter(data => {
                            if ((data[1] as any)[0] === 1) {
                                if (__fields[data[0] as string].Data2SQL) {
                                    (data[1] as any)[1] = __fields[data[0] as string].Data2SQL((data[1] as any)[1]);
                                }
                                if (option?.onFieldExists) {
                                    option.onFieldExists(data[0] as string, (data[1] as any)[1]);
                                }
                                return true;
                            } else {
                                return false;
                            }
                        })
                        .map(data => [data[0], (data[1] as any)[1]])
                        .toArray()
                );
            };
        };
    }
};
/**
  js项目中实体类注解替代品，只要确保函数被执行即可,举例：
  ```
  // 声明一个class
    export class AmaFuck {}
    DeclareClass(AmaFuck, [
        { type: "String", name: "SellerSKU" },
        { type: "String", name: "SellerSKU2" },
        { type: "String", name: "site" }
    ]);
  ```
 */
export function DeclareClass(clz: any, FieldOptions: FieldOption[]) {
    for (const item of FieldOptions) {
        tslib.__decorate([Field(item)], clz.prototype, item.P, void 0);
    }
}
/**
 JS项目中，service注解代替,举例：
 ```
 // 声明一个service,注意这里的let
    export let AmaService = class AmaService extends SqlService {};
    AmaService = DeclareService(AmaService, {
        tableName: "ama_fuck2",
        clz: AmaFuck,
        dbType: DBType.Sqlite,
        sqliteVersion: "0.0.3"
    });
 ```
 */
export function DeclareService(clz: any, config: ServiceOption) {
    return tslib.__decorate([DB(config)], clz)
}
/**
 ## 数据库服务
 ### 注解DB
 
 ### 泛型 T，同DB注解中的clz
 ** 服务中所有方法默认以该类型为准
 **
 
 */
export class SqlService<T extends object> {
    [_tableName]?: string;
    private [_className]?: string;
    private [_ClassName]?: string;
    private [_vueName]?: string;
    private [_daoDBName]?: string;
    private [_comment]?: string;
    private [_ids]?: string[];
    // private [_logicIds]?: string[];
    private [_fields]?: Record<string, AField>;
    private [_columns]?: string[];
    private [_columnsNoId]?: string[];
    private [_stateFileName]?: string;
    private [_deleteState]?: string;
    private [_SqlOption]?: ServiceOption;
    private [_dbType]?: DBType;
    private [_sqlite_version]?: string;
    private [_index]?: string[];
    private [_def]?: Partial<T>;
    public [_transformer]?: <L = T>(data: Partial<L>, option?: MethodOption & {
        finalColumns?: Set<string>;
        insert?: boolean;
        skipId?: boolean;
        skipNull?: boolean;
        skipUndefined?: boolean;
        skipEmptyString?: boolean;
        onFieldExists?: (K: string, V: any) => void;
    }) => Partial<T>;
    private _insert(
        datas: Partial<T>[],
        option: MethodOption & {
            mode?: InsertMode;
            existConditionOtherThanIds?: (keyof T)[];
            replaceWithDef?: boolean;
        }): { sql: string; params?: any[] }[] {

        const sqls: { sql: string; params?: any[] }[] = [];
        const tableName = option!.tableName;
        switch (option?.mode) {
            case InsertMode.InsertIfNotExists: {
                const conditions = option!.existConditionOtherThanIds || this[_ids];
                Throw.if(!conditions, 'not found where condition for insertIfNotExists!');
                Throw.if(conditions!.length === 0, 'insertIfNotExists must have not null where!');
                const where = iterate<string>(conditions! as string[]).map(c => `${this[_fields]![c]?.C2()} = ?`).join(' AND ');
                const finalColumns = new Set<string>();
                const whereColumns = conditions! as string[];
                const params: any[] = [];
                const questMarks = datas
                    .map(data => this[_transformer]!(data, { ...option, finalColumns, insert: true }))
                    .map(data => {
                        const questMark = new Array<string>();
                        for (const column of finalColumns) {
                            const V = data.hasOwnProperty(column)
                                ? data[column]
                                : this[_def] && this[_def].hasOwnProperty(column)
                                    ? this[_def][column]
                                    : null;
                            if (V === null) {
                                const field = this[_fields]![column];
                                if (field?.uuid) {
                                    switch (option.dbType) {
                                        case DBType.Postgresql:
                                            questMark.push('gen_random_uuid()');
                                            break;
                                        default:
                                            questMark.push('UUID()');
                                            break;
                                    }
                                } else if (field?.uuidShort) {
                                    switch (option.dbType) {
                                        case DBType.Postgresql:
                                            questMark.push(`encode(uuid_send(gen_random_uuid()::uuid),'base64')`);
                                            break;
                                        case DBType.Mysql:
                                            questMark.push('UUID_SHORT()');
                                            break;
                                        default:
                                            questMark.push('?');
                                            params.push(V);
                                            break;

                                    }
                                } else {
                                    questMark.push('?');
                                    params.push(V);
                                }
                            } else {
                                questMark.push('?');
                                params.push(V);
                            }
                        }
                        for (const column of whereColumns) {
                            params.push(
                                data.hasOwnProperty(column)
                                    ? data[column]
                                    : this[_def] && this[_def].hasOwnProperty(column)
                                        ? this[_def][column]
                                        : null
                            );
                        }
                        return `SELECT ${questMark.join(',')} FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ${tableName} WHERE ${where})`;
                    });
                const columnNames = iterate<string>(finalColumns).map(i => this[_fields]![i]?.C2()).join(',');
                const sql = formatDialect(`INSERT INTO
                ${tableName}
                (${columnNames})
                ${questMarks.join(' UNION ALL ')};`, { dialect: formatDialects[option!.dbType!] });
                sqls.push({ sql, params });
                break;
            }
            case InsertMode.Replace: {
                const finalColumns = new Set<string>();
                const params: any[] = [];
                const questMarks = datas
                    .map(data => this[_transformer]!(data, { ...option, finalColumns, insert: true }))
                    .map(data => {
                        const questMark = new Array<string>();
                        for (const column of finalColumns) {
                            const V = data.hasOwnProperty(column)
                                ? data[column]
                                : this[_def] && this[_def].hasOwnProperty(column)
                                    ? this[_def][column]
                                    : null;
                            if (V === null) {
                                const field = this[_fields]![column];
                                if (field?.uuid) {
                                    switch (option.dbType) {
                                        case DBType.Postgresql:
                                            questMark.push('gen_random_uuid()');
                                            break;
                                        default:
                                            questMark.push('UUID()');
                                            break;
                                    }
                                } else if (field?.uuidShort) {
                                    switch (option.dbType) {
                                        case DBType.Postgresql:
                                            questMark.push(`encode(uuid_send(gen_random_uuid()::uuid),'base64')`);
                                            break;
                                        case DBType.Mysql:
                                            questMark.push('UUID_SHORT()');
                                            break;
                                        default:
                                            questMark.push('?');
                                            params.push(V);
                                            break;

                                    }
                                } else {
                                    questMark.push('?');
                                    params.push(V);
                                }
                            } else {
                                questMark.push('?');
                                params.push(V);
                            }
                        }
                        return `(${questMark.join(',')})`;
                    });
                const columnNames = iterate(finalColumns).map(i => this[_fields]![i]?.C2()).join(',');
                const sql = formatDialect(`
                    ${option!.dbType === DBType.Mysql ? '' : 'INSERT OR'} REPLACE INTO
                    ${tableName}
                    (${columnNames})
                    VALUES ${questMarks};
                `, { dialect: formatDialects[option!.dbType!] });
                sqls.push({ sql, params });
                break;
            }
            case InsertMode.Insert: {
                const finalColumns = new Set<string>();
                const params: any[] = [];
                const questMarks = datas
                    .map(data => this[_transformer]!(data, { ...option, finalColumns, insert: true }))
                    .map(data => {
                        const questMark = new Array<string>();
                        for (const column of finalColumns) {
                            const V = data.hasOwnProperty(column)
                                ? data[column]
                                : this[_def] && this[_def].hasOwnProperty(column)
                                    ? this[_def][column]
                                    : null;
                            if (V === null) {
                                const field = this[_fields]![column];
                                if (field?.uuid) {
                                    switch (option.dbType) {
                                        case DBType.Postgresql:
                                            questMark.push('gen_random_uuid()');
                                            break;
                                        default:
                                            questMark.push('UUID()');
                                            break;
                                    }
                                } else if (field?.uuidShort) {
                                    switch (option.dbType) {
                                        case DBType.Postgresql:
                                            questMark.push(`encode(uuid_send(gen_random_uuid()::uuid),'base64')`);
                                            break;
                                        case DBType.Mysql:
                                            questMark.push('UUID_SHORT()');
                                            break;
                                        default:
                                            questMark.push('?');
                                            params.push(V);
                                            break;

                                    }
                                } else {
                                    questMark.push('?');
                                    params.push(V);
                                }
                            } else {
                                questMark.push('?');
                                params.push(V);
                            }
                        }
                        return `(${questMark.join(',')})`;
                    });
                const columnNames = iterate(finalColumns).map(i => this[_fields]![i]?.C2()).join(',');
                const sql = formatDialect(`
                    INSERT INTO
                    ${tableName}
                    (${columnNames})
                    VALUES ${questMarks};
                `, { dialect: formatDialects[option!.dbType!] });
                sqls.push({ sql, params });
                break;
            }
            case InsertMode.InsertWithTempTable: {
                const tableTemp = `${option?.tableName}_${Math.random()}`.replace(/\./, '');
                const tableTempESC = tableTemp;
                sqls.push({ sql: `DROP TABLE IF EXISTS ${tableTempESC};` });
                const finalColumns = new Set<string>();
                const params: any[] = [];
                const questMarks = datas
                    .map(data => this[_transformer]!(data, { ...option, finalColumns, insert: true }))
                    .map(data => {
                        const questMark = new Array<string>();
                        for (const column of finalColumns) {
                            const V = data.hasOwnProperty(column)
                                ? data[column]
                                : this[_def] && this[_def].hasOwnProperty(column)
                                    ? this[_def][column]
                                    : null;
                            if (V === null) {
                                const field = this[_fields]![column];
                                if (field?.uuid) {
                                    switch (option.dbType) {
                                        case DBType.Postgresql:
                                            questMark.push('gen_random_uuid()');
                                            break;
                                        default:
                                            questMark.push('UUID()');
                                            break;
                                    }
                                } else if (field?.uuidShort) {
                                    switch (option.dbType) {
                                        case DBType.Postgresql:
                                            questMark.push(`encode(uuid_send(gen_random_uuid()::uuid),'base64')`);
                                            break;
                                        case DBType.Mysql:
                                            questMark.push('UUID_SHORT()');
                                            break;
                                        default:
                                            questMark.push('?');
                                            params.push(V);
                                            break;

                                    }
                                } else {
                                    questMark.push('?');
                                    params.push(V);
                                }
                            } else {
                                questMark.push('?');
                                params.push(V);
                            }
                        }
                        return `(${questMark.join(',')})`
                    });
                const _sqls = this._createTable({ tableName: tableTemp, temp: true, columns: Array.from(finalColumns) })!;
                sqls.push(..._sqls);
                const columnNames = iterate(finalColumns).map(i => this[_fields]![i]?.C2()).join(',');
                sqls.push({
                    sql: formatDialect(`
                        INSERT INTO
                        ${tableTemp}
                        (${columnNames})
                        VALUES ${questMarks};
                    `, { dialect: formatDialects[option!.dbType!] }), params
                });
                sqls.push({
                    sql: formatDialect(`INSERT INTO ${option.tableName} (${columnNames})
                        SELECT ${columnNames} FROM ${tableTemp};`, { dialect: formatDialects[option!.dbType!] })
                });
                sqls.push({ sql: `DROP TABLE IF EXISTS ${tableTempESC};` });
                break;
            }
        }

        return sqls;
    }
    /**
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认 `异步`
    1. `data`：可是数组或者单对象
    2. `skipUndefined`: boolean; 是否不处理值为undefined的字段,默认 true
    3. `skipNull`: boolean; 是否不处理值为null的字段,默认 true
    4. `skipEmptyString`: boolean; 是否不处理值为空字符串(`注意：多个空格也算空字符串`)的字段,默认 true
    5. `maxDeal`: number; 批量处理时，每次处理多少个？默认500
    6. `tableName`: 默认使用service注解的`tableName`,可以在某个方法中覆盖
    7. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    8. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    9.  `dao`: 永远不需要传入该值
    10. `mode` :默认`insert`，可选如下
        1. `insert`: 默认
        2. `insertIfNotExists`: 通过主键或者existConditionOtherThanIds字段判断数据是否存在，不存在才插入,存在则不执行
        3. `replace`: 只支持用主键判断, 存在更新, 不存在插入
    11. `existConditionOtherThanIds`: insertIfNotExists时判断同一记录的字段名称，默认情况下按照ID判断，设置existConditionOtherThanIds后，不用id
    12. `replaceWithDef` replace时，是否带入默认值? 默认true
    ### 返回值是最后一次插入的主键ID，对于自增ID表适用
    1. 如果主键是自增批量操作，且期望返回所有记录的ID，那么需要设置 `option 中的 every = true`,此时效率降低
     * @param {{[P in keyof T]?: T[P]}} data
     * @param {MethodOption} [option]
     * @memberof SqlServer
     */
    insert(option: MethodOption & { data: Partial<T>; sync?: SyncMode.Async; mode?: InsertMode; existConditionOtherThanIds?: (keyof T)[]; every?: boolean; temp?: boolean; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; maxDeal?: number; replaceWithDef?: boolean; }): Promise<bigint>;
    insert(option: MethodOption & { data: Partial<T>[]; sync?: SyncMode.Async; mode?: InsertMode; existConditionOtherThanIds?: (keyof T)[]; every?: boolean; temp?: boolean; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; maxDeal?: number; replaceWithDef?: boolean; }): Promise<bigint[]>;
    insert(option: MethodOption & { data: Partial<T>; sync: SyncMode.Sync; mode?: InsertMode; existConditionOtherThanIds?: (keyof T)[]; every?: boolean; temp?: boolean; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; maxDeal?: number; replaceWithDef?: boolean; }): bigint;
    insert(option: MethodOption & { data: Partial<T>[]; sync: SyncMode.Sync; mode?: InsertMode; existConditionOtherThanIds?: (keyof T)[]; every?: boolean; temp?: boolean; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; maxDeal?: number; replaceWithDef?: boolean; }): bigint[];
    @P<T>()
    insert(option: MethodOption & { data: Partial<T> | Array<Partial<T>>; sync?: SyncMode; mode?: InsertMode; existConditionOtherThanIds?: (keyof T)[]; every?: boolean; temp?: boolean; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; maxDeal?: number; replaceWithDef?: boolean; }): bigint | bigint[] | Promise<bigint> | Promise<bigint[]> {
        option.mode ??= InsertMode.Insert;
        const isArray = option.data instanceof Array;
        const datas = option.data instanceof Array ? option.data : [option.data];
        if (datas.length === 0) return 0n;
        if (option.sync === SyncMode.Sync) {
            const fn = () => {
                const result = excuteSplit<Partial<T>, bigint>(
                    ExcuteSplitMode.SyncTrust,
                    datas,
                    _data => {
                        const sqls = this._insert(_data, option);
                        let result = 0n;
                        for (const { sql, params } of sqls) {
                            const dd = option!.conn!.execute(SyncMode.Sync, sql, params);
                            if (dd.insertId) { result += BigInt(dd.insertId); }
                        }
                        return result;
                    },
                    { everyLength: option?.every ? 1 : option?.maxDeal }
                );
                if (isArray) return result;
                else return result[0]!;
            };
            if (option!.dbType === DBType.SqliteRemote || option?.conn?.[_inTransaction]) {
                return fn();
            } else {
                return option?.dao?.transaction(SyncMode.Sync, fn, option?.conn)!;
            }
        } else if (isArray) {
            const fn = async () => {
                const result = await excuteSplit<Partial<T>, bigint>(
                    ExcuteSplitMode.AsyncTrust,
                    datas,
                    async _data => {
                        const sqls = this._insert(_data, option);
                        let result = 0n;
                        for (const { sql, params } of sqls) {
                            const dd = await option!.conn!.execute(SyncMode.Async, sql, params);
                            if (dd.insertId) { result += BigInt(dd.insertId); }
                        }
                        return result;
                    },
                    { everyLength: option?.every ? 1 : option?.maxDeal }
                );
                return result;
            };

            if (option!.dbType === DBType.SqliteRemote || option?.conn?.[_inTransaction]) {
                return fn();
            } else {
                return option?.dao?.transaction(SyncMode.Async, fn, option?.conn) as Promise<bigint[]>;
            }
        } else {
            const fn = async () => {
                const result = await excuteSplit<Partial<T>, bigint>(
                    ExcuteSplitMode.AsyncTrust,
                    datas,
                    async _data => {
                        const sqls = this._insert(_data, option);
                        let result = 0n;
                        for (const { sql, params } of sqls) {
                            const dd = await option!.conn!.execute(SyncMode.Async, sql, params);
                            if (dd.insertId) { result += BigInt(dd.insertId); }
                        }
                        return result;
                    },
                    { everyLength: 1 }
                );
                return result[0]!;
            };
            if (option!.dbType === DBType.SqliteRemote || option?.conn?.[_inTransaction]) {
                return fn();
            } else {
                return option?.dao?.transaction(SyncMode.Async, fn, option?.conn) as Promise<bigint>;
            }
        }
    }

    private _update(datas: Array<Partial<T>>, option: MethodOption): { sql: string; params?: any[] }[] {
        const sqls: { sql: string; params?: any[] }[] = [];
        const tableName = option?.tableName;
        const where = `WHEN ${iterate(this[_ids]!).map(c => `${this[_fields]![c]?.C2()} = ?`).join(' AND ')} THEN ?`;
        const columnMaps: Record<string, {
            where: string[];
            params: any[];
        }> = Object.fromEntries(this[_columnsNoId]!.map(c => [c, {
            where: new Array<string>(),
            params: []
        }]));
        const params: any[] = [];
        for (const data of datas) {
            const ids = this[_ids]!.map(i => {
                Throw.if(!data[i], `UPDATE ID NOT EXISTS!${JSON.stringify(data)}`);
                return data[i];
            });
            this[_transformer]!(data,
                {
                    ...option,
                    skipId: true,
                    onFieldExists: (K, V) => {
                        columnMaps[K]?.where.push(where);
                        columnMaps[K]?.params.push(...ids, V);
                    }
                }
            );
        }
        const sql = formatDialect(`UPDATE ${tableName} SET ${iterate(this[_columnsNoId]!)
            .filter(K => columnMaps[K]!.where.length > 0)
            .map(K => {
                params.push(...columnMaps[K]!.params);
                return `${this[_fields]![K]?.C2()} = CASE ${columnMaps[K]!.where.join(' ')} ELSE ${this[_fields]![K]?.C2()} END`
            })
            .join(',')};`, { dialect: formatDialects[option!.dbType!] });
        sqls.push({ sql, params });
        return sqls;
    }
    /**
    ## 根据主键修改
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. `data`：可是数组或者单对象
    2. `skipUndefined`: boolean; 是否不处理值为undefined的字段,默认 true
    3. `skipNull`: boolean; 是否不处理值为null的字段,默认 true
    4. `skipEmptyString`: boolean; 是否不处理值为空字符串(`注意：多个空格也算空字符串`)的字段,默认 true
    5. `maxDeal`: number; 批量处理时，每次处理多少个？默认500
    6. `tableName`: 默认使用service注解的`tableName`,可以在某个方法中覆盖
    7. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    8. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    9.  `dao`: 永远不需要传入该值
     */
    update(option: MethodOption & { data: Partial<T> | Array<Partial<T>>; sync?: SyncMode.Async; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; maxDeal?: number; }): Promise<number>;
    update(option: MethodOption & { data: Partial<T> | Array<Partial<T>>; sync: SyncMode.Sync; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; maxDeal?: number; }): number;
    @P<T>()
    update(option: MethodOption & { data: Partial<T> | Array<Partial<T>>; sync?: SyncMode; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; maxDeal?: number; }): Promise<number> | number {
        Throw.if(!this[_ids] || this[_ids].length === 0, 'not found id')
        const datas = option.data instanceof Array ? option.data : [option.data];
        if (datas.length === 0) return 0;
        if (option.sync === SyncMode.Sync) {
            const fn = () => {
                const result = excuteSplit<Partial<T>, number>(
                    ExcuteSplitMode.SyncTrust,
                    datas,
                    _data => {
                        const sqls = this._update(_data, option);
                        let result = 0;
                        for (const { sql, params } of sqls) {
                            const dd = option!.conn!.execute(SyncMode.Sync, sql, params);
                            if (dd.affectedRows) { result += dd.affectedRows; }
                        }
                        return result;
                    },
                    { everyLength: option?.maxDeal }
                );
                return result.length > 0 ? result.reduce((a, b) => a + b) : 0;
            };
            if (option!.dbType === DBType.SqliteRemote || option?.conn?.[_inTransaction]) {
                return fn();
            } else {
                return option?.dao?.transaction(SyncMode.Sync, fn, option?.conn)!;
            }
        } else {
            const fn = async () => {
                const result = await excuteSplit<Partial<T>, number>(
                    ExcuteSplitMode.AsyncTrust,
                    datas,
                    async _data => {
                        const sqls = this._update(_data, option);
                        let result = 0;
                        for (const { sql, params } of sqls) {
                            const dd = await option!.conn!.execute(SyncMode.Async, sql, params);
                            if (dd.affectedRows) { result += dd.affectedRows; }
                        }
                        return result;
                    },
                    { everyLength: option?.maxDeal }
                );
                return result.length > 0 ? result.reduce((a, b) => a + b) : 0
            };
            if (option!.dbType === DBType.SqliteRemote || option?.conn?.[_inTransaction]) {
                return fn();
            } else {
                return option?.dao?.transaction(SyncMode.Async, fn, option?.conn) as Promise<number>;
            }
        }
    }

    /**
    ## 删除
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. 支持按ID删除：可以单个ID或者ID数组 `需要实体类只有一个ID`
    2. 支持实体类删除: 用于多个ID或者按实体类某些字段删除
    3. 两种模式：`mode`=`Common` 或者 `TempTable`
    3. 如果数据多，使用 `TempTable`模式
    4. 当设置实体类的字段有 `logicDelete` ，将进行逻辑删除，除非设置 `forceDelete` = true
    5. 支持`whereSql`直接拼接，此时必须传递`whereParams`,不建议直接使用这种方式！为了简化逻辑，它不会和ID、WHERE共存，且优先级更高。且不支持 `TempTable` Mode
    6. `tableName`: 默认使用service注解的`tableName`,可以在某个方法中覆盖
    7. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    8. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    9.  `dao`: 永远不需要传入该值
    */
    delete(option: MethodOption & { sync?: SyncMode.Async; id?: string | number | Array<string | number>; where?: Partial<T> | Array<Partial<T>>; mode?: DeleteMode; forceDelete?: boolean; whereSql?: string; whereParams?: Record<string, any>; }): Promise<number>;
    delete(option: MethodOption & { sync: SyncMode.Sync; id?: string | number | Array<string | number>; where?: Partial<T> | Array<Partial<T>>; mode?: DeleteMode; forceDelete?: boolean; whereSql?: string; whereParams?: Record<string, any>; }): number;
    @P<T>()
    delete(option: MethodOption & { sync?: SyncMode, id?: string | number | Array<string | number>; where?: Partial<T> | Array<Partial<T>>; mode?: DeleteMode; forceDelete?: boolean; whereSql?: string; whereParams?: Record<string, any>; }): Promise<number> | number {
        Throw.if(!!this[_ids] && this[_ids].length > 1 && !option.where && !option.whereSql, 'muit id must set where!');
        Throw.if((!this[_ids] || this[_ids].length === 0) && !option.where && !option.whereSql, 'if not set id on class, must set where!');
        Throw.if(!option.id && !option.where && !option.whereSql, 'not found id or where!');
        Throw.if(!!option.id && !!this[_ids] && this[_ids].length > 1, 'muit id must set where!');
        Throw.if(!!option.id && !!option.where && !option.whereSql, 'id and where only one can set!');

        option.mode ??= DeleteMode.Common;
        const tableTemp = `${option?.tableName}_${Math.random()}`.replace(/\./, '');
        const tableTempESC = tableTemp;
        const tableNameESC = option?.tableName;

        if (option.id) {
            const idName = this[_ids]![0]!;
            const ids = option.id instanceof Array ? option.id : [option.id];
            option.where = ids.map(i => ({ [idName]: i })) as Array<Partial<T>>;
        }

        const wheres = option.where instanceof Array ? option.where : [option.where!];
        if (wheres.length === 0 && (!option.whereSql || !option.whereParams)) { return 0; }
        if (option.whereSql && option.whereParams) {
            option.mode = DeleteMode.Common;
        }

        const sqls: { sql: string; params?: any[] }[] = [];
        if (option.mode === DeleteMode.Common) {
            let params: any[] | undefined;
            let whereSql: string | undefined;
            if (option.whereSql && option.whereParams) {
                const gen = this._generSql(option.dbType!, option.whereSql, option.whereParams);
                whereSql = gen.sql;
                params = gen.params;
            } else {
                params = new Array<any>();
                whereSql = iterate(wheres).map(where => {
                    return `(
                        ${Object.entries(where).map(([K, V]) => {
                        params!.push(V);
                        return `${this[_fields]![K]?.C2()} = ?`;
                    }).join(' AND ')}
                    )`;
                }).join(' OR ');
            }

            if (this[_stateFileName] !== undefined && option.forceDelete !== true) {
                params.unshift(this[_deleteState]);
                sqls.push({
                    sql: formatDialect(`
                    UPDATE ${tableNameESC} SET ${this[_fields]![this[_stateFileName]]?.C2()} = ?
                    WHERE ${whereSql};
                `, { dialect: formatDialects[option!.dbType!] }), params
                });
            } else {
                sqls.push({ sql: formatDialect(`DELETE FROM ${tableNameESC} WHERE ${whereSql};`, { dialect: formatDialects[option!.dbType!] }), params });
            }
        } else {
            sqls.push({ sql: `DROP TABLE IF EXISTS ${tableTempESC};` });
            const delWhere = Object.keys(wheres[0] as unknown as any);
            const _sqls = this._createTable({ tableName: tableTemp, temp: true, columns: delWhere, data: wheres, index: 'all', id: 'none' })!;
            sqls.push(..._sqls);
            switch (option!.dbType) {
                case DBType.Mysql: {
                    if (this[_stateFileName] !== undefined && option.forceDelete !== true) {
                        sqls.push({
                            sql: formatDialect(`UPDATE ${tableNameESC} a INNER JOIN ${tableTempESC} b ON ${delWhere.map(K => `a.${this[_fields]![K]?.C2()} = b.${this[_fields]![K]?.C2()}`).join(' AND ')}
                            SET a.${this[_fields]![this[_stateFileName]]?.C2()} = ?;`, { dialect: formatDialects[option!.dbType!] }),
                            params: [this[_deleteState]]
                        });
                    } else {
                        sqls.push({
                            sql: formatDialect(`DELETE a.* FROM ${tableNameESC} a INNER JOIN ${tableTempESC} b ON ${delWhere.map(K => `a.${this[_fields]![K]?.C2()} = b.${this[_fields]![K]?.C2()}`).join(' AND ')};`, { dialect: formatDialects[option!.dbType!] })
                        });
                    }
                    break;
                }
                case DBType.Sqlite:
                case DBType.SqliteRemote: {
                    const columnNames = iterate(delWhere).map(K => this[_fields]![K]?.C2()).join(',');
                    if (this[_stateFileName] !== undefined && option.forceDelete !== true) {
                        sqls.push({
                            sql: formatDialect(`UPDATE ${tableNameESC} SET ${this[_fields]![this[_stateFileName]]?.C2()} = ?
                            WHERE (${columnNames}) IN (SELECT ${columnNames} FROM ${tableTempESC});`, { dialect: formatDialects[option!.dbType!] }),
                            params: [this[_deleteState]]
                        });
                    } else {
                        sqls.push({ sql: formatDialect(`DELETE FROM ${tableNameESC} WHERE (${columnNames}) IN (SELECT ${columnNames} FROM ${tableTempESC});`, { dialect: formatDialects[option!.dbType!] }) });
                    }
                    break;
                }
            }
            sqls.push({ sql: `DROP TABLE IF EXISTS ${tableTempESC};` });
        }

        if (option.sync === SyncMode.Sync) {
            const fn = () => {
                let result = 0;
                for (const { sql, params } of sqls) {
                    const dd = option!.conn!.execute(SyncMode.Sync, sql, params);
                    result += dd.affectedRows;
                }
                return result;
            };
            if (option!.dbType === DBType.SqliteRemote || option?.conn?.[_inTransaction]) {
                return fn();
            } else {
                return option?.dao?.transaction(SyncMode.Sync, fn, option?.conn)!;
            }
        } else {
            const fn = async () => {
                let result = 0;
                for (const { sql, params } of sqls) {
                    const dd = await option!.conn!.execute(SyncMode.Async, sql, params);
                    result += dd.affectedRows;
                }
                return result;
            };
            if (option!.dbType === DBType.SqliteRemote || option?.conn?.[_inTransaction]) {
                return fn();
            } else {
                return option?.dao?.transaction<number>(SyncMode.Async, fn, option?.conn) as Promise<number>;
            }
        }
    }

    private _template(templateResult: TemplateResult, result: any, error?: string) {
        switch (templateResult) {
            case TemplateResult.AssertOne: {
                Throw.if(!result || result.length !== 1, error);
                return result[0] as T;
            }
            case TemplateResult.NotSureOne: {
                return result && result.length > 0 ? (result[0] as T) ?? null : null;
            }
            case TemplateResult.Many: {
                return result;
            }
            case TemplateResult.Count: {
                return result[0].ct;
            }
        }
    }
    /**
    #根据条件查询对象
    ## 特点：快速、简单，可快速根据某些字段是否等于来查询返回，可以查询记录和记录数
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. `templateResult`: 返回值类型断言，4种
        1. `AssertOne` 确定返回一个，如果不是一个，将报错，返回类型是T `默认`
        2. `NotSureOne` 可能返回一个，返回类型是T|null
        3. `Many` 返回多个
        4. `Count` 返回记录数
    2. 支持按ID查询：可以单个ID或者ID数组 `需要实体类只有一个ID`
    3. 支持实体类查询: 用于多个ID或者按实体类某些字段查询
    4. 两种查询方式：`mode`=`Common`(默认) 或者 `TempTable`
    5. `tableName`: 默认使用service注解的`tableName`,可以在某个方法中覆盖
    6. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    7. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    8.  `dao`: 永远不需要传入该值

     */
    template<L = T>(option: MethodOption & { sync: SyncMode.Sync; templateResult?: TemplateResult.AssertOne; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): L;
    template<L = T>(option: MethodOption & { sync?: SyncMode.Async; templateResult?: TemplateResult.AssertOne; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): Promise<L>;
    template<L = T>(option: MethodOption & { sync: SyncMode.Sync; templateResult: TemplateResult.Count; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): number;
    template<L = T>(option: MethodOption & { sync?: SyncMode.Async; templateResult: TemplateResult.Count; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): Promise<number>;
    template<L = T>(option: MethodOption & { sync: SyncMode.Sync; templateResult: TemplateResult.NotSureOne; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): L | null;
    template<L = T>(option: MethodOption & { sync?: SyncMode.Async; templateResult: TemplateResult.NotSureOne; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): Promise<L | null>;
    template<L = T>(option: MethodOption & { sync: SyncMode.Sync; templateResult: TemplateResult.Many; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): L[];
    template<L = T>(option: MethodOption & { sync?: SyncMode.Async; templateResult: TemplateResult.Many; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): Promise<L[]>;
    @P<T>()
    template<L = T>(option: MethodOption & { sync?: SyncMode; templateResult?: TemplateResult; id?: string | number | Array<string | number>; where?: Partial<L> | Array<Partial<L>>; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; mode?: SelectMode; error?: string; columns?: (keyof L)[]; }): number | L | null | L[] | Promise<number | L | null | L[]> {
        Throw.if(!!this[_ids] && this[_ids].length > 1 && !option.where, `muit id must set where!(${option.tableName})`);
        Throw.if((!this[_ids] || this[_ids].length === 0) && !option.where, `if not set id on class, must set where!(${option.tableName})`);
        Throw.if(!option.id && !option.where, `not found id or where!(${option.tableName})`);
        Throw.if(!!option.id && !!this[_ids] && this[_ids].length > 1, `muit id must set where!(${option.tableName})`);
        Throw.if(!!option.id && !!option.where, `id and where only one can set!(${option.tableName})`);

        option.mode ??= SelectMode.Common;
        option.templateResult ??= TemplateResult.AssertOne;
        option.error ??= 'error data!';
        const tableTemp = `${option?.tableName}_${Math.random()}`.replace(/\./, '');
        const tableTempESC = tableTemp;
        const tableNameESC = option?.tableName;

        if (option.id) {
            const idName = this[_ids]![0]!;
            const ids = option.id instanceof Array ? option.id : [option.id];
            option.where = ids.map(i => ({ [idName]: i })) as Array<Partial<L>>;
        }
        const columns = option.templateResult === TemplateResult.Count ? 'COUNT(1) ct' : iterate((option.columns as unknown as string[] ?? this[_columns])!).map((K: any) => `a.${this[_fields]![K]?.C3()}`).join(',');
        const wheres = option.where instanceof Array ? option.where : [option.where!];
        const sqls: { sql: string; params?: any[] }[] = [];
        let resultIndex = -1;
        if (option.mode === SelectMode.Common) {
            const params = new Array<any>();
            const whereSql = formatDialect(iterate(wheres).map(where => this[_transformer]!(where, option)).map(where => {
                return `SELECT ${columns} FROM ${tableNameESC} a WHERE
                    ${Object.entries(where).map(([K, V]) => {
                    params.push(V);
                    return `${this[_fields]![K]?.C2()} = ?`;
                }).join(' AND ')}`;
            }).join(' UNION ALL '), { dialect: formatDialects[option!.dbType!] });
            sqls.push({ sql: whereSql, params });
            resultIndex = 0;
        } else {
            sqls.push({ sql: `DROP TABLE IF EXISTS ${tableTempESC};` });
            const delWhere = Object.keys(wheres[0] as unknown as any);
            const _sqls = this._createTable<L>({ tableName: tableTemp, temp: true, columns: delWhere, data: wheres, index: 'all', id: 'none' })!;
            sqls.push(..._sqls);
            resultIndex = sqls.length;
            sqls.push({ sql: formatDialect(`SELECT ${columns} FROM ${tableNameESC} a INNER JOIN ${tableTempESC} b ON ${delWhere.map(K => `a.${this[_fields]![K]?.C2()} = b.${this[_fields]![K]?.C2()}`).join(' AND ')};`, { dialect: formatDialects[option!.dbType!] }) });
            sqls.push({ sql: `DROP TABLE IF EXISTS ${tableTempESC};` });
        }

        if (option.sync === SyncMode.Sync) {
            let result: any;
            for (let i = 0; i < sqls.length; i++) {
                if (i === resultIndex) {
                    result = option!.conn!.query(SyncMode.Sync, sqls[i]?.sql, sqls[i]?.params);
                } else {
                    option!.conn!.execute(SyncMode.Sync, sqls[i]?.sql, sqls[i]?.params);
                }
            }
            return this._template(option.templateResult, result, option.error);
        } else {
            return new Promise<L | null | L[]>(async (resolve, reject) => {
                try {
                    let result: any;
                    for (let i = 0; i < sqls.length; i++) {
                        if (i === resultIndex) {
                            result = await option!.conn!.query(SyncMode.Async, sqls[i]?.sql, sqls[i]?.params);
                        } else {
                            await option!.conn!.execute(SyncMode.Async, sqls[i]?.sql, sqls[i]?.params);
                        }
                    }
                    resolve(this._template(option.templateResult!, result, option.error));
                } catch (error) {
                    reject(error);
                }
            });
        }
    }


    private _select<L = T>(templateResult: SelectResult, result: any, def: L | null, errorMsg?: string, hump?: boolean, mapper?: string | SqlMapper, mapperIfUndefined?: MapperIfUndefined, dataConvert?: Record<string, string>) {
        switch (templateResult) {
            case SelectResult.R_C_NotSure: {
                try {
                    if (dataConvert) {
                        const key = Object.keys(result[0])[0];
                        const value = Object.values(result[0])[0];
                        if (key && dataConvert[key] && globalThis[_DataConvert][dataConvert[key]]) {
                            return globalThis[_DataConvert][dataConvert[key]](value);
                        }
                    }
                    return Object.values(result[0])[0];
                }
                catch (error) {
                    return def;
                }
            }
            case SelectResult.R_C_Assert: {
                try {
                    if (dataConvert) {
                        const key = Object.keys(result[0])[0];
                        const value = Object.values(result[0])[0];
                        if (key && dataConvert[key] && globalThis[_DataConvert][dataConvert[key]]) {
                            return globalThis[_DataConvert][dataConvert[key]](value);
                        }
                    }
                    return Object.values(result[0])[0] as L;
                } catch (error) {
                    if (def !== undefined) return def;
                    Throw.now(errorMsg ?? 'not found data!');
                }
            }
            case SelectResult.R_CS_NotSure: {
                if (mapper) {
                    return flatData<L>({ data: result[0], mapper, mapperIfUndefined });
                } else {
                    hump = hump === true || (hump === undefined && globalThis[_Hump] === true);
                    const __dataConvert = dataConvert ? Object.fromEntries(Object.entries(dataConvert).map(([k, v]) => [k, globalThis[_DataConvert][v]])) : undefined;
                    if (hump || __dataConvert) {
                        return C2P2(result[0], hump, __dataConvert) ?? null;
                    }
                    else {
                        return result[0] ?? null;
                    }
                }

            }
            case SelectResult.R_CS_Assert: {
                const data = result[0] as L;
                Throw.if(data === null || data === undefined, errorMsg ?? 'not found data!');
                if (mapper) {
                    return flatData<L>({ data, mapper, mapperIfUndefined });
                } else {
                    hump = hump === true || (hump === undefined && globalThis[_Hump] === true);
                    const __dataConvert = dataConvert ? Object.fromEntries(Object.entries(dataConvert).map(([k, v]) => [k, globalThis[_DataConvert][v]])) : undefined;
                    if (hump || __dataConvert) {
                        return C2P2(data as any, hump, __dataConvert) ?? null;
                    }
                    else {
                        return data;
                    }
                }
            }
            case SelectResult.RS_C: {
                try {
                    if (dataConvert) {
                        const key = Object.keys(result[0])[0];
                        if (key && dataConvert[key] && globalThis[_DataConvert][dataConvert[key]]) {
                            return result.map((r: any) => globalThis[_DataConvert][dataConvert[key]](Object.values(r)[0]));
                        }
                    }
                    return result.map((r: any) => Object.values(r)[0] as L);
                } catch (error) {
                    return result as L[];
                }
            }
            case SelectResult.RS_CS: {
                if (mapper) {
                    return iterate(result).map((data: any) => flatData<L>({ data, mapper, mapperIfUndefined })).toArray();
                } else {
                    hump = hump === true || (hump === undefined && globalThis[_Hump] === true);
                    const __dataConvert = dataConvert ? Object.fromEntries(Object.entries(dataConvert).map(([k, v]) => [k, globalThis[_DataConvert][v]])) : undefined;
                    if (hump || __dataConvert) {
                        return iterate(result).map((r) => C2P2(r as any, hump, __dataConvert)).toArray();
                    }
                    else {
                        return result;
                    }
                }
            }
        }
    }
    /**
    # 自由查询
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. `templateResult`: 返回值类型断言，6种, R表示行，C表示列，带S表示复数
        1. R_C_Assert,
        2. R_C_NotSure,
        3. R_CS_Assert,
        4. R_CS_NotSure,
        5. RS_C,
        7. RS_CS[默认]
    2. `sql` 或者 `sqlid`
    3. `params`
    4. `defValue`: One_Row_One_Column 时有效
    5. 禁止一次查询多个语句
    6. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    7. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    9.  `dao`: 永远不需要传入该值
    10. `hump`: 是否将列名改为驼峰写法？默认情况下按照全局配置
    11. `mapper`: 列名-属性 映射工具，优先级高于hump
     ```
     //    该属性支持传入mybatis.xml中定义的resultMap块ID，或者读取sqlMapDir目录下的JSON文件.
     //    注意：resultMap块ID与sql语句逻辑一致，同样是 目录.ID
     //    或者自定义Mapper,自定义Mapper格式如下:
     [
     {columnName: 'dit_id', mapNames: ['DTID'], def: 0, convert: 转换函数},  // 列名ditid,对应属性DTID,如果没有值，将返回默认值0,其中默认值0是可选的
     {columnName: 'event_id', mapNames: ['eventMainInfo', 'id'], def: 0,  convert: 转换函数},// 列名event_id对应属性eventMainInfo.id,这种方式将返回嵌套的json对象,其中默认值是可选的
     ]
     12. dataConvert 数据转换器
     ```
     dataConvert: {
         fileName: 'qiniu'
     }
         // 表示列 fileName 按 qiniu的函数格式化
         // qiniu 在项目初始化时定义
     ```
     */
    select<L = T>(option: MethodOption & { sync?: SyncMode.Async; selectResult?: SelectResult.RS_CS | SelectResult.RS_C; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; isCount?: boolean; defValue?: L | null; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L[]>;
    select<L = T>(option: MethodOption & { sync?: SyncMode.Async; selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; isCount?: boolean; defValue?: L | null; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L>;
    select<L = T>(option: MethodOption & { sync?: SyncMode.Async; selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; isCount?: boolean; defValue?: L | null; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L | null>;
    select<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult?: SelectResult.RS_CS | SelectResult.RS_C; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; isCount?: boolean; defValue?: L | null; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L[];
    select<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; isCount?: boolean; defValue?: L | null; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L;
    select<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; isCount?: boolean; defValue?: L | null; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L | null;
    @P<T>()
    select<L = T>(option: MethodOption & { sync?: SyncMode; selectResult?: SelectResult; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; isCount?: boolean; defValue?: L | null; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): null | L | L[] | Promise<null | L | L[]> {
        Throw.if(!option.sqlId && !option.sql, 'not found sql!');
        option.selectResult ??= SelectResult.RS_CS;
        option.defValue ??= null;
        if (option.sqlId && globalThis[_resultMap_SQLID][option.sqlId] && !option.mapper) {
            option.mapper = globalThis[_resultMap_SQLID][option.sqlId];
        }
        const _params = Object.assign({}, option.context, option.params);
        option.sql ??= globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: option.context, isCount: option.isCount, ..._params });
        const { sql, params } = this._generSql(option!.dbType!, option.sql, _params);
        if (option.sync === SyncMode.Sync) {
            const result = option!.conn!.query(SyncMode.Sync, sql, params);
            return this._select<L>(option.selectResult, result, option.defValue, option.errorMsg, option.hump, option.mapper, option.mapperIfUndefined, option.dataConvert);
        } else {
            return new Promise<L | null | L[]>(async (resolve, reject) => {
                try {
                    const result = await option!.conn!.query(SyncMode.Async, sql, params);
                    resolve(this._select<L>(option.selectResult!, result, option.defValue!, option.errorMsg, option.hump, option.mapper, option.mapperIfUndefined, option.dataConvert));
                } catch (error) {
                    reject(error);
                }
            });
        }
    }


    /**
    # 自由查询:一次执行多个SQL语句!
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. `sql` 或者 `sqlid`
    2. `params`
    3. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    4. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    5.  `dao`: 永远不需要传入该值
    6. `hump`: 是否将列名改为驼峰写法？默认情况下按照全局配置
    7. `mapper`: 列名-属性 映射工具，优先级高于hump
     ```
     //    该属性支持传入mybatis.xml中定义的resultMap块ID，或者读取sqlMapDir目录下的JSON文件(暂未实现).
     //    注意：resultMap块的寻找逻辑与sql语句逻辑一致，同样是 文件名.ID
     //    或者自定义Mapper,自定义Mapper格式如下:
     [
        // 数据列名ditid将转换为属性`DTID`,如果没有值，将返回默认值0,其中默认值0是可选的
        {columnName: 'dit_id', mapNames: ['DTID'], def?: 0, convert: 转换函数},
        // 数据列名event_id将转换为属性`eventMainInfo.id`,这种方式将返回嵌套的json对象,其中默认值0是可选的
        {columnName: 'event_id', mapNames: ['eventMainInfo', 'id'], def?: 0,  convert: 转换函数},
     ]
     ```
     8. `dataConvert` 数据转换器
     ```
     dataConvert: {
         fileName: 'qiniu'
     }
    // 表示列 fileName 按 qiniu的函数格式化
    // qiniu 在开始时定义
     ```
     */
    selectBatch<T extends any[] = []>(option: MethodOption & { sync?: SyncMode.Async; selectResult?: SelectResult.RS_CS | SelectResult.RS_C; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<{ [K in keyof T]: T[K][] }>;
    selectBatch<T extends any[] = []>(option: MethodOption & { sync?: SyncMode.Async; selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<{ [K in keyof T]: T[K] }>;
    selectBatch<T extends any[] = []>(option: MethodOption & { sync?: SyncMode.Async; selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<{ [K in keyof T]: T[K] | null }>;
    selectBatch<T extends any[] = []>(option: MethodOption & { sync: SyncMode.Sync; selectResult?: SelectResult.RS_CS | SelectResult.RS_C; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): { [K in keyof T]: T[K][] };
    selectBatch<T extends any[] = []>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): { [K in keyof T]: T[K] };
    selectBatch<T extends any[] = []>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): { [K in keyof T]: T[K] | null };
    @P<T>()
    selectBatch<T extends any[] = []>(option: MethodOption & { sync?: SyncMode; selectResult?: SelectResult; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): { [K in keyof T]: T[K][] } | { [K in keyof T]: T[K] } | { [K in keyof T]: T[K] | null } | Promise<{ [K in keyof T]: T[K][] } | { [K in keyof T]: T[K] } | { [K in keyof T]: T[K] | null }> {
        Throw.if(!option.sqlId && !option.sql, 'not found sql!');
        option.selectResult ??= SelectResult.RS_CS;
        if (option.sqlId && globalThis[_resultMap_SQLID][option.sqlId] && !option.mapper) {
            option.mapper = globalThis[_resultMap_SQLID][option.sqlId];
        }
        const _params = Object.assign({}, option.context, option.params);
        option.sql ??= globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: option.context, isCount: false, ..._params });
        const { sql, params } = this._generSql(option!.dbType!, option.sql, _params);
        if (option.sync === SyncMode.Sync) {
            const result = option!.conn!.query<{ [K in keyof T]: T[K][] }>(SyncMode.Sync, sql, params);
            return result.map(item => this._select<{ [K in keyof T]: T[K][]; }>(option.selectResult!, item, null, undefined, option.hump, option.mapper, option.mapperIfUndefined, option.dataConvert)) as { [K in keyof T]: T[K][] };
        } else {
            return new Promise<{ [K in keyof T]: T[K][] }>(async (resolve, reject) => {
                try {
                    const result = await option!.conn!.query<{ [K in keyof T]: T[K][] }>(SyncMode.Async, sql, params);
                    resolve(result.map(item => this._select<{ [K in keyof T]: T[K][]; }>(option.selectResult!, item, null, undefined, option.hump, option.mapper, option.mapperIfUndefined, option.dataConvert)) as { [K in keyof T]: T[K][] });
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    /**
     # 自由执行sql
     0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
     1. `sql` 或者 `sqlid`
     2. `params`
     3. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
     4. `conn`: 仅在开启事务时需要主动传入,传入示例:
         ```
             service.transaction(async conn => {
                 service.insert({conn});
             });
         ```
     5.  `dao`: 永远不需要传入该值
     
      */
    excute<L = T>(option: MethodOption & { sync?: SyncMode.Async; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; }): Promise<number>;
    excute<L = T>(option: MethodOption & { sync: SyncMode.Sync; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; }): number;
    @P<T>()
    excute<L = T>(option: MethodOption & { sync?: SyncMode; sqlId?: string; sql?: string; params?: Record<string, any>; context?: any; }): number | Promise<number> {
        Throw.if(!option.sqlId && !option.sql, 'not found sql!');
        const _params = Object.assign({}, option.context, option.params);
        option.sql ??= globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: option.context, ..._params });
        const { sql, params } = this._generSql(option!.dbType!, option.sql, _params);
        if (option.sync === SyncMode.Sync) {
            const result = option!.conn!.execute(SyncMode.Sync, sql, params);
            return result.affectedRows;
        } else {
            return new Promise<number>(async (resolve, reject) => {
                try {
                    const result = await option!.conn!.execute(SyncMode.Async, sql, params);
                    resolve(result.affectedRows);
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    /**
     ### 开启事务
     ### 这里面的所有数据方法，都必须传递CONN，否则会引起
     # 死锁
     ### 举例说明：
     #### 假设有两条代码，都操作同一个表A，其中代码1传了conn，但代码2没有传
     #### 代码1：插入数据，代码2：更新数据
     #### 二者操作的是不同的数据
     #### 以上为前提，开始分析：
     ** 当事务打开后，会创建一个连接1，开始执行代码1
     ** 代码1执行完毕，由于`transaction`方法尚未结束，所以不会提交事务。
     ** 代码1是插入数据，因此会导致全表锁
     ** 代码2开始执行，由于没有传入conn，所以会创建一个新的连接2
     ** 代码2执行时，会等待连接1的锁释放
     ** 但是连接1的锁是在`transaction`方法执行完后才会提交并释放锁，这导致死循环，开启死锁
     **
     */
    transaction<L = T>(option: MethodOption & { sync?: SyncMode.Async; fn: (conn: Connection) => Promise<L>; }): Promise<L | null>;
    transaction<L = T>(option: MethodOption & { sync: SyncMode.Sync; fn: (conn: Connection) => L; }): L | null;
    @P<T>(true)
    transaction<L = T>(option: MethodOption & { sync?: SyncMode; fn: (conn: Connection) => L | Promise<L>; }): L | null | Promise<L | null> {
        if (option.sync === SyncMode.Sync) {
            return option!.dao!.transaction(SyncMode.Sync, option.fn as (conn: Connection) => L, option.conn)!;
        } else {
            return new Promise(async (resolve, reject) => {
                try {
                    const rt = await option!.dao!.transaction(SyncMode.Async, option.fn as (conn: Connection) => Promise<L>, option.conn);
                    resolve(rt);
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    stream<L extends object = T>() {
        return new StreamQuery<L>(this as any, this[_fields]!, this[_columns]!);
    }

    page<L = T>(option: MethodOption & { sync?: SyncMode.Async; sqlId: string; context?: any; params: Record<string, any>; pageSize?: number; pageNumber?: number; limitSelf?: boolean; countSelf?: boolean; sum?: boolean; sumSelf?: boolean; sortName?: string; sortType?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<PageQuery<L>>;
    page<L = T>(option: MethodOption & { sync: SyncMode.Sync; sqlId: string; context?: any; params: Record<string, any>; pageSize?: number; pageNumber?: number; limitSelf?: boolean; countSelf?: boolean; sum?: boolean; sumSelf?: boolean; sortName?: string; sortType?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): PageQuery<L>;
    @P<T>()
    page<L = T>(option: MethodOption & { sync?: SyncMode; sqlId: string; context?: any; params: Record<string, any>; pageSize?: number; pageNumber?: number; limitSelf?: boolean; countSelf?: boolean; sum?: boolean; sumSelf?: boolean; sortName?: string; sortType?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): PageQuery<L> | Promise<PageQuery<L>> {
        const result: PageQuery<L> = {
            sum: {},
            records: [],
            size: 0,
            total: 0
        };
        option.pageNumber ??= 1;
        option.pageSize ??= 0;
        if (option.hump || (option.hump === undefined && globalThis[_Hump]) && option.sortName) {
            option.sortName = P2C(option.sortName!);
        }
        Object.assign(
            option.params,
            {
                limitStart: calc(option.pageNumber).sub(1).mul(option.pageSize).over(),
                limitEnd: option.pageSize - 0,
                sortName: option.sortName ?? undefined,
                sortType: option.sortType ?? undefined
            }
        );

        let sql = globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: option.context, isCount: false, ...option.params });
        let sqlSum = '';
        let sqlCount = '';
        if (option.sum) {
            if (option.sumSelf) {
                sqlCount = globalThis[_sqlCache].load(this._matchSqlid(`${option.sqlId}_sum`), { ctx: option.context, isCount: false, isSum: true, ...option.params });
            } else {
                sqlSum = globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: option.context, isCount: false, isSum: true, ...option.params });
            }
        }
        if (option.limitSelf !== true && option.pageSize > 0) {
            sql = `${sql} LIMIT ${option.params['limitStart']}, ${option.pageSize}`;
        }
        if (option.pageSize > 0) {
            if (option.countSelf) {
                sqlCount = globalThis[_sqlCache].load(this._matchSqlid(`${option.sqlId}_count`), { ctx: option.context, isCount: true, isSum: false, ...option.params });
            } else {
                sqlCount = globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: option.context, isCount: true, isSum: false, ...option.params });
            }
        }
        if (option.sync === SyncMode.Sync) {
            if (sqlCount) {
                result.total = this.select<number>({
                    ...option,
                    sql: sqlCount,
                    sync: SyncMode.Sync,
                    selectResult: SelectResult.R_C_Assert
                });
                result.size = calc(result.total)
                    .add(option.pageSize - 1)
                    .div(option.pageSize)
                    .round(0, 2)
                    .over();
            }
            if (sqlSum) {
                result.sum = this.select<Record<string, number>>({
                    ...option,
                    sql: sqlSum,
                    sync: SyncMode.Sync,
                    selectResult: SelectResult.R_CS_Assert
                });
            }
            if (sql) {
                result.records = this.select<L>({
                    ...option,
                    sql,
                    sync: SyncMode.Sync,
                    selectResult: SelectResult.RS_CS
                });
            }
            return result;
        } else {
            return new Promise<PageQuery<L>>(async (resolve, reject) => {
                try {
                    if (sqlCount) {
                        result.total = await this.select<number>({
                            ...option,
                            sql: sqlCount,
                            sync: SyncMode.Async,
                            selectResult: SelectResult.R_C_Assert
                        });
                        result.size = calc(result.total)
                            .add(option.pageSize ?? 10 - 1)
                            .div(option.pageSize)
                            .round(0, 2)
                            .over();
                    }
                    if (sqlSum) {
                        result.sum = await this.select<Record<string, number>>({
                            ...option,
                            sql: sqlSum,
                            sync: SyncMode.Async,
                            selectResult: SelectResult.R_CS_Assert
                        });
                    }
                    if (sql) {
                        result.records = await this.select<L>({
                            ...option,
                            sql,
                            sync: SyncMode.Async,
                            selectResult: SelectResult.RS_CS
                        });
                    }
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    /**
     * 导出数据，可以为EJS-EXCEL直接使用
     * @param list
     * @returns 
     */
    exp<L = T>(list: L[]) {
        Throw.if(list.length === 0, 'not found data!');
        const columnTitles = new Array<string>();
        const keys = this[_fields] ?
            iterate(Object.entries(this[_fields]))
                .filter(([K, F]) => (F.id !== true && F.exportable !== false) || (F.id === true && F.exportable === true))
                .map(([K, F]) => {
                    columnTitles.push(F.comment ?? K);
                    return K;
                }).toArray()
            : Object.keys(list[0]!).filter(K => !this[_ids]?.includes(K));
        const title = this[_comment] ?? this[_tableName];
        const titleSpan = `A1:${ten2Any(keys.length)}1`;
        const datas = list.map(data => keys.map(k => data[k] ?? ''));
        return { title, titleSpan, columnTitles, datas };
    }
    /**
     * 导入数据的模板
     * @returns
     */
    imp() {
        Throw.if(!this[_fields], 'not set fields!');
        const columnTitles = new Array<string>();
        const keys = iterate(Object.entries(this[_fields]!))
            .filter(([K, F]) => (F.id !== true && F.exportable !== false) || (F.id === true && F.exportable === true))
            .map(([K, F]) => {
                columnTitles.push(F.comment ?? K);
                return K;
            }).toArray();
        const title = this[_comment] ?? this[_tableName];
        const titleSpan = `A1:${ten2Any(keys.length)}1`;
        return { title, titleSpan, columnTitles };
    }

    /**
     * 初始化表结构
     * 只有sqlite、sqliteremote需要
     * force: 是否强制，默认false, 强制时会删除再创建
     * @param option
     */
    init(option?: MethodOption & { sync?: SyncMode.Async; force?: boolean }): Promise<void>;
    init(option: MethodOption & { sync: SyncMode.Sync; force?: boolean }): void;
    @P<T>()
    init(option?: MethodOption & { sync?: SyncMode; force?: boolean }): void | Promise<void> {
        const tableES = option!.tableName;
        option!.force ??= false;
        if (option!.dbType === DBType.Sqlite) {
            if (option?.force) {
                option!.conn!.execute(SyncMode.Sync, `DROP TABLE IF EXISTS ${tableES};`);
            }
            const lastVersion = this[_sqlite_version] ?? '0.0.1';
            // 检查表
            const tableCheckResult = option!.conn!.pluck<number>(SyncMode.Sync, `SELECT COUNT(1) t FROM sqlite_master WHERE TYPE = 'table' AND name = ?`, [option!.tableName]);
            if (tableCheckResult) {
                // 旧版本
                const tableVersion = option!.conn!.pluck<string>(SyncMode.Sync, 'SELECT ______version v from TABLE_VERSION WHERE ______tableName = ?', [option!.tableName]);
                if (tableVersion && tableVersion < lastVersion) { // 发现需要升级的版本
                    // 更新版本
                    const columns = iterate<{ name: string }>(option!.conn!.query(SyncMode.Sync, `PRAGMA table_info(${tableES})`))
                        .filter(c => this[_fields]!.hasOwnProperty(C2P(c.name, globalThis[_Hump])))
                        .map(c => c.name)
                        .join(',');

                    const rtable = `${option!.tableName}_${tableVersion.replace(/\./, '_')}`;
                    option!.conn!.execute(SyncMode.Sync, `DROP TABLE IF EXISTS ${rtable};`);
                    option!.conn!.execute(SyncMode.Sync, `ALTER TABLE ${tableES} RENAME TO ${rtable};`);
                    option!.conn!.execute(SyncMode.Sync, `
                        CREATE TABLE IF NOT EXISTS ${tableES}(
                            ${Object.values(this[_fields]!).map(K => K[DBType.Sqlite]()).join(',')}
                            ${this[_ids] && this[_ids].length ? `, PRIMARY KEY (${this[_ids].map(i => this[_fields]![i]?.C2()).join(',')})` : ''}
                        );
                    `);
                    if (this[_index] && this[_index].length) {
                        for (const index of this[_index]) {
                            option!.conn!.execute(SyncMode.Sync, `CREATE INDEX ${`${index}_${Math.random()}`.replace(/\./, '')} ON ${tableES} ("${this[_fields]![index]?.C2()}");`);
                        }
                    }
                    option!.conn!.execute(SyncMode.Sync, `INSERT INTO ${tableES} (${columns}) SELECT ${columns} FROM ${rtable};`);
                    option!.conn!.execute(SyncMode.Sync, `INSERT INTO ${tableES} (${columns}) SELECT ${columns} FROM ${rtable};`);
                    option!.conn!.execute(SyncMode.Sync, `DROP TABLE IF EXISTS ${rtable};`);
                    // 更新完毕，保存版本号
                    option!.conn!.execute(SyncMode.Sync, 'UPDATE TABLE_VERSION SET ______version = ? WHERE ______tableName = ?', [option!.tableName, lastVersion]);
                } else if (!tableVersion) { // 不需要升级情况：没有旧的版本号
                    option!.conn!.execute(SyncMode.Sync, 'INSERT INTO TABLE_VERSION (______tableName, ______version ) VALUES ( ?, ? )', [option!.tableName, lastVersion]);
                }
            } else { // 表不存在
                // 创建表
                option!.conn!.execute(SyncMode.Sync, `
                    CREATE TABLE IF NOT EXISTS ${tableES} (
                        ${Object.values(this[_fields]!).map(K => K[DBType.Sqlite]()).join(',')}
                        ${this[_ids] && this[_ids].length ? `, PRIMARY KEY (${this[_ids].map(i => this[_fields]![i]?.C2()).join(',')})` : ''}
            
                    );
                `);
                if (this[_index] && this[_index].length) {
                    for (const index of this[_index]) {
                        option!.conn!.execute(SyncMode.Sync, `CREATE INDEX ${`${index}_${Math.random()}`.replace(/\./, '')} ON ${tableES} ("${this[_fields]![index]?.C2()}");`);
                    }
                }
                option!.conn!.execute(SyncMode.Sync, 'INSERT OR REPLACE INTO TABLE_VERSION (______tableName, ______version ) VALUES ( ?, ? )', [option!.tableName, lastVersion]);
            }
        } else if (option!.dbType === DBType.SqliteRemote) {

            return new Promise(async (resolve, reject) => {
                try {
                    if (option?.force) {
                        await option!.conn!.execute(SyncMode.Async, `DROP TABLE IF EXISTS ${tableES};`);
                    }
                    const lastVersion = this[_sqlite_version] ?? '0.0.1';
                    // 检查表
                    const tableCheckResult = await option!.conn!.pluck<number>(SyncMode.Async, `SELECT COUNT(1) t FROM sqlite_master WHERE TYPE = 'table' AND name = ?`, [option!.tableName]);
                    if (tableCheckResult) {
                        // 旧版本
                        const tableVersion = await option!.conn!.pluck<string>(SyncMode.Async, 'SELECT ______version v from TABLE_VERSION WHERE ______tableName = ?', [option!.tableName]);
                        if (tableVersion && tableVersion < lastVersion) { // 发现需要升级的版本
                            // 更新版本
                            const columns = iterate<{ name: string }>(await option!.conn!.query(SyncMode.Async, `PRAGMA table_info(${tableES})`))
                                .filter(c => this[_fields]!.hasOwnProperty(C2P(c.name, globalThis[_Hump])))
                                .map(c => c.name)
                                .join(',');

                            const rtable = `${option!.tableName}_${tableVersion.replace(/\./, '_')}`;
                            await option!.conn!.execute(SyncMode.Async, `DROP TABLE IF EXISTS ${rtable};`);
                            await option!.conn!.execute(SyncMode.Async, `ALTER TABLE ${tableES} RENAME TO ${rtable};`);
                            await option!.conn!.execute(SyncMode.Async, `
                            CREATE TABLE IF NOT EXISTS ${tableES}(
                                ${Object.values(this[_fields]!).map(K => K[DBType.Sqlite]()).join(',')}
                                ${this[_ids] && this[_ids].length ? `, PRIMARY KEY (${this[_ids].map(i => this[_fields]![i]?.C2()).join(',')})` : ''}
                            );
                        `);
                            if (this[_index] && this[_index].length) {
                                for (const index of this[_index]) {
                                    await option!.conn!.execute(SyncMode.Async, `CREATE INDEX ${`${index}_${Math.random()}`.replace(/\./, '')} ON ${tableES} ("${this[_fields]![index]?.C2()}");`);
                                }
                            }
                            await option!.conn!.execute(SyncMode.Async, `INSERT INTO ${tableES} (${columns}) SELECT ${columns} FROM ${rtable};`);
                            await option!.conn!.execute(SyncMode.Async, `INSERT INTO ${tableES} (${columns}) SELECT ${columns} FROM ${rtable};`);
                            await option!.conn!.execute(SyncMode.Async, `DROP TABLE IF EXISTS ${rtable};`);
                            // 更新完毕，保存版本号
                            await option!.conn!.execute(SyncMode.Async, 'UPDATE TABLE_VERSION SET ______version = ? WHERE ______tableName = ?', [option!.tableName, lastVersion]);
                        } else if (!tableVersion) { // 不需要升级情况：没有旧的版本号
                            await option!.conn!.execute(SyncMode.Async, 'INSERT INTO TABLE_VERSION (______tableName, ______version ) VALUES ( ?, ? )', [option!.tableName, lastVersion]);
                        }
                    } else { // 表不存在
                        // 创建表
                        await option!.conn!.execute(SyncMode.Async, `
                        CREATE TABLE IF NOT EXISTS ${tableES}(
                            ${Object.values(this[_fields]!).map(K => K[DBType.Sqlite]()).join(',')}
                            ${this[_ids] && this[_ids].length ? `, PRIMARY KEY (${this[_ids].map(i => this[_fields]![i]?.C2()).join(',')})` : ''}
                        );
                    `);
                        if (this[_index] && this[_index].length) {
                            for (const index of this[_index]) {
                                await option!.conn!.execute(SyncMode.Async, `CREATE INDEX ${`${index}_${Math.random()}`.replace(/\./, '')} ON ${option!.tableName} ("${this[_fields]![index]?.C2()}");`);
                            }
                        }
                        await option!.conn!.execute(SyncMode.Async, 'INSERT OR REPLACE INTO TABLE_VERSION (______tableName, ______version ) VALUES ( ?, ? )', [option!.tableName, lastVersion]);
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    close(option?: MethodOption & { sync?: SyncMode.Async; }): Promise<void>;
    close(option: MethodOption & { sync: SyncMode.Sync; }): void;
    @P<T>()
    close(option?: MethodOption & { sync?: SyncMode; force?: boolean }): void | Promise<void> {
        delete globalThis[_dao][option!.dbType][option!.dbName];
        if (option?.sync === SyncMode.Async) {
            return option!.dao!.close(SyncMode.Async);
        } else if (option?.sync === SyncMode.Sync) {
            option!.dao!.close(SyncMode.Sync)
        }
    }

    /**
    #创建表
    ** `tableName` 表名称
    ** `temp` 是否是临时表，默认true
    ** `columns` 字符串数组，默认是当前实体类全部字段，通过`columns` 可以创建部分字段临时表
    ** `id` 表的主键设置 4种：
    1. `auto`: `columns`中已经在当前实体类配置的ID作为主键 `默认`
    2. `all`: `columns`中所有字段全部当主键
    3. `none`: 没有主键
    4. 自定义字段名称：字符串数组
    ** `index` 表的索引，设置方式同ID
     */
    private _createTable<L = T>({ tableName, temp = true, columns, data, id = 'auto', index = 'auto', dbType }: {
        tableName?: string;
        temp?: boolean,
        columns?: string[];
        data?: Array<Partial<L>>;
        id?: 'auto' | 'all' | 'none' | string[];
        index?: 'auto' | 'all' | 'none' | string[];
        dbType?: DBType;
    } = {}): { sql: string; params?: any[] }[] {
        const sqls: { sql: string; params?: any[] }[] = [];
        columns = columns || this[_columns]!;
        let ids: string[] | undefined;
        if (id === 'auto') {
            ids = this[_ids]?.filter(i => columns?.includes(i));
        } else if (id === 'all') {
            ids = columns;
        } else if (id === 'none') {
            ids = undefined;
        } else {
            ids = id;
        }
        let indexs: string[] | undefined;
        if (index === 'auto') {
            indexs = this[_index]?.filter(i => columns?.includes(i));
        } else if (index === 'all') {
            indexs = columns;
        } else if (index === 'none') {
            indexs = undefined;
        } else {
            indexs = index;
        }
        tableName = tableName ?? this[_tableName];
        switch (dbType) {
            case DBType.Mysql: {
                let sql = formatDialect(`CREATE ${temp ? 'TEMPORARY' : ''} TABLE IF NOT EXISTS ${tableName}(
                    ${columns.map(K => this[_fields]![K]![DBType.Mysql]()).join(',')}
                    ${ids && ids.length ? `,PRIMARY KEY (${ids.map(i => this[_fields]![i]?.C2()).join(',')})  USING BTREE ` : ''}
                    ${indexs && indexs.length ? `,${indexs.map(i => `KEY ${this[_fields]![i]?.C2()} (${this[_fields]![i]?.C2()})`).join(',')} ` : ''}
                ) ENGINE=MEMORY;`, { dialect: mysql });
                sqls.push({ sql });
                if (data && data.length > 0) {
                    const params: any[] = [];
                    let first = true;
                    sql = formatDialect(`INSERT INTO ${tableName} (${columns.map(c => this[_fields]![c]?.C2()).join(',')})
                    ${(data).map(d => {
                        const r = `SELECT ${Object.entries(d).map(([K, V]) => {
                            params.push(V);
                            return `? ${first ? this[_fields]![K]?.C2() : ''}`;
                        }).join(',')}`;
                        first = false;
                        return r;
                    }).join(' UNION ALL ')}`, { dialect: mysql });
                    sqls.push({ sql, params });
                }
                break;
            }
            case DBType.Sqlite:
            case DBType.SqliteRemote: {
                let sql = formatDialect(`CREATE ${temp ? 'TEMPORARY' : ''} TABLE IF NOT EXISTS ${tableName}(
                    ${columns.map(K => this[_fields]![K]![DBType.Sqlite]()).join(',')}
                    ${ids && ids.length ? `,PRIMARY KEY (${ids.map(i => this[_fields]![i]?.C2()).join(',')}) ` : ''}
                );`, { dialect: sqlite });
                sqls.push({ sql });
                if (indexs) {
                    for (const index of indexs) {
                        sql = formatDialect(`CREATE INDEX ${`${index}_${Math.random()}`.replace(/\./, '')} ON ${tableName} (${this[_fields]![index]?.C2()});`, { dialect: sqlite });
                        sqls.push({ sql });
                    }
                }
                if (data && data.length > 0) {
                    const params: any[] = [];
                    let first = true;
                    sql = formatDialect(`INSERT INTO ${tableName} (${columns.map(c => this[_fields]![c]?.C2()).join(',')})
                    ${(data).map(d => {
                        const r = `SELECT ${Object.entries(d).map(([K, V]) => {
                            params.push(V);
                            return `? ${first ? this[_fields]![K]?.C2() : ''}`;
                        }).join(',')}`;
                        first = false;
                        return r;
                    }).join(' UNION ALL ')}`, { dialect: sqlite });
                    sqls.push({ sql, params });
                }
                break;
            }
        }
        return sqls;
    }

    private _matchSqlid(sqlid?: string) {
        sqlid ??= '';
        if (sqlid.includes('.')) return [sqlid];
        else return [`${this[_tableName]}.${sqlid}`, `${this[_className]}.${sqlid}`, `${this[_ClassName]}.${sqlid}`, `${this[_vueName]}.${sqlid}`];
    }
    private _setParam(v: any, ps: any[]) {
        if (v instanceof Array) {
            ps.push(...v);
            return v.map(i => '?').join(',')
        } else {
            ps.push(v);
            return '?';
        }
    }
    private _generSql(dbType: DBType, _sql?: string, _params?: Record<string, any>) {
        const params: any[] = [];
        const sql = formatDialect(_sql?.replace(/\:([\w.]+)/g, (txt, key) => {
            let V = LGet(_params, key);

            if (V !== undefined) {
                return this._setParam(V, params);
            }
            const _key = C2P(key);
            V = LGet(_params, _key);
            if (V !== undefined) {
                return this._setParam(V, params);
            }
            const __key = P2C(key);
            V = LGet(_params, __key);
            if (V !== undefined) {
                return this._setParam(V, params);
            }
            return txt;
        })!, { dialect: formatDialects[dbType] });
        return { params, sql };
    }

}
/** 是否进行下一个动作 */
const IF_PROCEED = function <T extends object>() {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn = descriptor.value;
        descriptor.value = function (this: StreamQuery<T>) {
            if (this.if_proceed) {
                // eslint-disable-next-line prefer-rest-params
                const args = Array.from(arguments);
                fn.call(this, ...args);
            } else {
                this.if_proceed = true;
            }
            return this;
        };
    };
};
/*** 是否执行最终查询/操作*/
const IF_EXEC = function <T extends object>(def: any) {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn = descriptor.value;
        descriptor.value = async function (this: StreamQuery<T>) {
            if (this.if_proceed && this.if_exec) {
                // eslint-disable-next-line prefer-rest-params
                const args = Array.from(arguments);
                return await fn.call(this, ...args);
            } else {
                return def;
            }
        };
    };
};
class StreamQuery<T extends object> {
    private _prefix = 0;
    private _index = 0;

    private _wheres: string[] = [];

    private _andQuerys: StreamQuery<T>[] = [];
    private _orQuerys: StreamQuery<T>[] = [];

    private _paramKeys: Record<string, string[] | Record<string, string> | string> = {};
    private _param: Record<string, any> = {};
    public if_proceed = true;
    public if_exec = true;

    private _distinct = false;
    private _columns: string[] = [];

    private _updates?: Partial<T>;
    private _updateColumns: string[] = [];

    private _groups: string[] = [];
    private _orders: string[] = [];

    private _startRow = 0;
    private _pageSize = 0;

    private _service: SqlService<T>;
    private [_fields]: Record<string, AField>;
    private [_columns]: string[];
    constructor(service: SqlService<T>, __fields: Record<string, AField>, __columns: string[]) {

        this._prefix = parseInt(`${Math.random() * 1000}`);
        this._service = service;
        this[_fields] = __fields;
        this[_columns] = __columns;
    }
    /** 将当前stream重置 */
    reset() {
        this._index = 0;
        this._wheres.length = 0;
        this._param = {};
        this._paramKeys = {};
        this._pageSize = 0;
        this._startRow = 0;
        this._orders.length = 0;
        this._groups.length = 0;
        this._columns.length = 0;
        this._updateColumns.length = 0;
        return this;
    }
    // #region 条件
    /** 为下次链条执行提供条件判断：非异步方法跳过，异步方法不执行并返回默认值 */
    @IF_PROCEED<T>()
    if(condition: boolean) {
        this.if_proceed = condition;
        return this;
    }
    /**
     * AND(key1 = :value OR key2 = :value)
     * @param keys [key1, key2, ...]
     */
    @IF_PROCEED<T>()
    eqs(keys: (keyof T)[], value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this.__(keys, value, '=', { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /*** AND key = :value */
    @IF_PROCEED<T>()
    eq(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._(key, value, '=', { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /*** AND key1 = :value1 AND  key2 = :value2 */
    @IF_PROCEED<T>()
    eqT(t: Partial<T>, { name: paramName = '', breakExcuteIfEmpty = true } = {}) {
        let exe = false;
        if (t) {
            t = this._service[_transformer]!(t, {
                skipNull: true,
                skipUndefined: true,
                skipEmptyString: true
            });
            const keys = Object.keys(t);
            if (keys.length > 0) {
                if (paramName && this._paramKeys[paramName]) {
                    for (const [key, pname] of Object.entries(this._paramKeys[paramName] as Record<string, string>)) {
                        this._param[pname as string] = t[key];
                    }
                } else {
                    const paramKeys: Record<string, string> = {};
                    for (const [key, value] of Object.entries(t)) {
                        const pkey = `p${this._prefix}${this._index++}`;
                        this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} = :${pkey} `);
                        this._param[pkey] = value;
                        if (paramName) {
                            paramKeys[key] = pkey;
                        }
                    }
                    if (paramName) {
                        this._paramKeys[paramName] = paramKeys;
                    }
                }
                exe = true;
            }
        }
        if (breakExcuteIfEmpty && exe === false) {
            this.if_exec = false;
        }
        return this;
    }
    /*** AND key <> :value */
    @IF_PROCEED<T>()
    notEq(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._(key, value, '<>', { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND key1 = key2 */
    @IF_PROCEED<T>()
    eqWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '='); }
    /** AND key1 <> key2 */
    @IF_PROCEED<T>()
    notEqWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '<>'); }
    /** AND key > :value */
    @IF_PROCEED<T>()
    grate(key: keyof T, value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, value, '>', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key >= :value */
    @IF_PROCEED<T>()
    grateEq(key: keyof T, value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, value, '>=', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key1 > key2 */
    @IF_PROCEED<T>()
    grateWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '>'); }
    /** AND key1 >= key2 */
    @IF_PROCEED<T>()
    grateEqWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '>='); }
    /** AND key < :value */
    @IF_PROCEED<T>()
    less(key: keyof T, value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, value, '<', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key <= :value */
    @IF_PROCEED<T>()
    lessEq(key: keyof T, value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, value, '<=', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key1 < key2 */
    @IF_PROCEED<T>()
    lessWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '<'); }
    /** AND key1 <= key2 */
    @IF_PROCEED<T>()
    lessEqWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '<='); }
    /** AND key REGEXP :regexp */
    @IF_PROCEED<T>()
    regexp(key: keyof T, regexp: string, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, regexp, 'REGEXP', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key NOT REGEXP :regexp */
    @IF_PROCEED<T>()
    notRegexp(key: keyof T, regexp: string, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, regexp, 'REGEXP', { paramName, skipEmptyString: true, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :regexp REGEXP key */
    @IF_PROCEED<T>()
    regexp2(key: keyof T, regexp: string, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._2(key, regexp, 'REGEXP', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND :regexp NOT REGEXP key */
    @IF_PROCEED<T>()
    notRegexp2(key: keyof T, regexp: string, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._2(key, regexp, 'REGEXP', { paramName, skipEmptyString: true, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND (key1 << 8) + key2 = value */
    @IF_PROCEED<T>()
    shiftEq(key1: keyof T, key2: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._shift(key1, key2, value, '=', { paramName, breakExcuteIfEmpty }); }
    /** AND (key1 << 8) + key2 <> value */
    @IF_PROCEED<T>()
    shiftNotEq(key1: keyof T, key2: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._shift(key1, key2, value, '<>', { paramName, breakExcuteIfEmpty }); }
    /** AND key LIKE CONCAT('%', :value, '%') */
    @IF_PROCEED<T>()
    like(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', right: '%', breakExcuteIfEmpty }); }
    /** AND key NOT LIKE CONCAT('%', :value, '%') */
    @IF_PROCEED<T>()
    notLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', right: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key NOT LIKE CONCAT('%', :value) */
    @IF_PROCEED<T>()
    leftLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', breakExcuteIfEmpty }); }
    /** AND key LIKE CONCAT('%', :value) */
    @IF_PROCEED<T>()
    notLeftLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key LIKE CONCAT(:value, '%') */
    @IF_PROCEED<T>()
    rightLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, right: '%', breakExcuteIfEmpty }); }
    /** AND key NOT LIKE CONCAT(:value, '%') */
    @IF_PROCEED<T>()
    notRightLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, right: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key LIKE :value 注意：不会拼接% */
    @IF_PROCEED<T>()
    PreciseLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND key NOT LIKE :value 注意：不会拼接%*/
    @IF_PROCEED<T>()
    notPreciseLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key GLOB CONCAT('%', :value, '%') 注意：GLOB是大小写敏感like */
    @IF_PROCEED<T>()
    glob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', right: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key NOT GLOB CONCAT('%', :value, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', right: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key GLOB CONCAT('%', :value) 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    leftGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key NOT GLOB CONCAT('%', :value) 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notLeftGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key GLOB CONCAT(:value, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    rightGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, right: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key NOT GLOB CONCAT(:value, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notRightGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, right: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key GLOB :value 注意：GLOB是大小写敏感like,这里不拼接%*/
    @IF_PROCEED<T>()
    preciseGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key NOT GLOB :value 注意：GLOB是大小写敏感like,这里不拼接%*/
    @IF_PROCEED<T>()
    notPreciseGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value LIKE CONCAT('%', key, '%') */
    @IF_PROCEED<T>()
    like2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', right: '%', breakExcuteIfEmpty }); }
    /** AND :value NOT LIKE CONCAT('%', key, '%') */
    @IF_PROCEED<T>()
    notLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', right: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value NOT LIKE CONCAT('%', key) */
    @IF_PROCEED<T>()
    leftLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', breakExcuteIfEmpty }); }
    /** AND :value LIKE CONCAT('%', key) */
    @IF_PROCEED<T>()
    notLeftLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value LIKE CONCAT(key, '%') */
    @IF_PROCEED<T>()
    rightLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, right: '%', breakExcuteIfEmpty }); }
    /** AND :value NOT LIKE CONCAT(key, '%') */
    @IF_PROCEED<T>()
    notRightLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, right: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value LIKE key 注意：不会拼接% */
    @IF_PROCEED<T>()
    PreciseLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND :value NOT LIKE key 注意：不会拼接%*/
    @IF_PROCEED<T>()
    notPreciseLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value GLOB CONCAT('%', key, '%') 注意：GLOB是大小写敏感like */
    @IF_PROCEED<T>()
    glob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', right: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value NOT GLOB CONCAT('%', key, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', right: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value GLOB CONCAT('%', key) 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    leftGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value NOT GLOB CONCAT('%', key) 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notLeftGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value GLOB CONCAT(key, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    rightGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, right: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value NOT GLOB CONCAT(key, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notRightGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, right: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value GLOB key 注意：GLOB是大小写敏感like,这里不拼接%*/
    @IF_PROCEED<T>()
    preciseGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value NOT GLOB key 注意：GLOB是大小写敏感like,这里不拼接%*/
    @IF_PROCEED<T>()
    notPreciseGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key IN (:value) */
    @IF_PROCEED<T>()
    in(key: keyof T, value: Array<string | number>, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._in(key, value, { paramName, breakExcuteIfEmpty }); }
    /** AND key NOT IN (:value) */
    @IF_PROCEED<T>()
    notIn(key: keyof T, value: Array<string | number>, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._in(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value IN (key1, key2, ...) */
    @IF_PROCEED<T>()
    in2(key: (keyof T)[], value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._in2(key, value, { paramName, breakExcuteIfEmpty }); }
    /** AND :value NOT IN (key1, key2, ...) */
    @IF_PROCEED<T>()
    notIn2(key: (keyof T)[], value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._in2(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key IS NULL */
    @IF_PROCEED<T>()
    isNULL(key: keyof T) { return this._null(key); }
    /** AND key IS NOT NULL */
    @IF_PROCEED<T>()
    isNotNULL(key: keyof T) { return this._null(key, 'NOT'); }
    /** AND (key IS NULL OR key = '') */
    @IF_PROCEED<T>()
    isEmpty(key: keyof T) {
        this._wheres.push(`AND (t.${this[_fields]![String(key)]?.C2()} IS NULL OR t.${this[_fields]![String(key)]?.C2()} = '')`);
        return this;
    }
    /** AND key IS NOT NULL AND key <> ''*/
    @IF_PROCEED<T>()
    isNotEmpty(key: keyof T) {
        this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} IS NOT NULL AND t.${this[_fields]![String(key)]?.C2()} <> ''`);
        return this;
    }
    /** AND key BETWEEN :value1 AND :value2 */
    @IF_PROCEED<T>()
    between(key: keyof T, value1: string | number, value2: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._between(key, value1, value2, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND key NOT BETWEEN :value1 AND :value2 */
    @IF_PROCEED<T>()
    notBetween(key: keyof T, value1: string | number, value2: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._between(key, value1, value2, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND POW(2, key) & :value */
    @IF_PROCEED<T>()
    pow(key: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow(key, value, { paramName, breakExcuteIfEmpty }); }
    /** AND NOT POW(2, key) & :value */
    @IF_PROCEED<T>()
    notPow(key: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow(key, value, { paramName, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND POW(2, :value) & key */
    @IF_PROCEED<T>()
    pow2(key: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow2(key, value, { paramName, breakExcuteIfEmpty }); }
    /** AND NOT POW(2, :value) & key */
    @IF_PROCEED<T>()
    notPow2(key: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow2(key, value, { paramName, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND POW(2, key1) & key2 */
    @IF_PROCEED<T>()
    powWith(key: keyof T, values: Array<number | string>, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow(key, add(...values.map(value => Math.pow(2, +value))), { paramName, breakExcuteIfEmpty }); }
    /** AND NOT POW(2, key1) & key2 */
    @IF_PROCEED<T>()
    notPowWith(key: keyof T, values: Array<number | string>, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow(key, add(...values.map(value => Math.pow(2, +value))), { paramName, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) */
    @IF_PROCEED<T>()
    match(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) */
    @IF_PROCEED<T>()
    notMatch(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) IN BOOLEAN MODE*/
    @IF_PROCEED<T>()
    matchBoolean(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty, append: 'IN BOOLEAN MODE' }); }
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) IN BOOLEAN MODE */
    @IF_PROCEED<T>()
    notMatchBoolean(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty, not: 'NOT', append: 'IN BOOLEAN MODE' }); }
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) WITH QUERY EXPANSION*/
    @IF_PROCEED<T>()
    matchQuery(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty, append: 'WITH QUERY EXPANSION' }); }
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) WITH QUERY EXPANSION*/
    @IF_PROCEED<T>()
    notMatchQuery(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty, not: 'NOT', append: 'WITH QUERY EXPANSION' }); }
    /** AND LOCATE(key, :value) > 0 */
    @IF_PROCEED<T>()
    includes(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._includes(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND NOT LOCATE(key, :value) = 0 */
    @IF_PROCEED<T>()
    notIncludes(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._includes(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND LOCATE(:value, key) > 0 */
    @IF_PROCEED<T>()
    includes2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._includes2(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND NOT LOCATE(:value, key) = 0 */
    @IF_PROCEED<T>()
    notIncludes2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._includes2(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND FIND_IN_SET(:value, key) */
    @IF_PROCEED<T>()
    findInSet(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND FIND_IN_SET(:${pkey}, t.${this[_fields]![String(key)]?.C2()})`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    /** AND FIND_IN_SET(key, :value) */
    @IF_PROCEED<T>()
    findInSet2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND FIND_IN_SET(t.${this[_fields]![String(key)]?.C2()}, :${pkey})`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    @IF_PROCEED<T>()
    and(fn: StreamQuery<T> | ((stream: StreamQuery<T>) => boolean | void)) {
        if (fn instanceof StreamQuery) {
            this._andQuerys.push(fn);
        } else {
            const stream = new StreamQuery<T>(this._service, this[_fields], this[_columns]);
            const ret = fn(stream);
            if (ret !== false) { this._andQuerys.push(stream); }
        }
        return this;
    }
    @IF_PROCEED<T>()
    or(fn: StreamQuery<T> | ((stream: StreamQuery<T>) => boolean | void)) {
        if (fn instanceof StreamQuery) {
            this._andQuerys.push(fn);
        } else {
            const stream = new StreamQuery<T>(this._service, this[_fields], this[_columns]!);
            const ret = fn(stream);
            if (ret !== false) { this._orQuerys.push(stream); }
        }
        return this;
    }
    /**
     * sql WHERE 查询语句拼接：注意若有JOIN，需要写明别名。本表别名为t.例如:
     * ```
     * where('t.name > :name', {name: 1});
     * where('(t.name > :name OR t.name <> :name)', {name: 1});
     * ```
     */
    @IF_PROCEED<T>()
    where(sql: string, param?: Record<string, any>) {
        this._wheres.push(`AND ${sql}`);
        if (param) {
            Object.assign(this._param, param);
        }
        return this;
    }
    /** SET key = IFNULL(key, 0) + :value */
    @IF_PROCEED<T>()
    incr(key: keyof T, value = 1) {
        const pkey = `p${this._prefix}${this._index++}`;
        const keyName = this[_fields]![String(key)]?.C2()!;
        this._updateColumns.push(`t.${keyName} = IFNULL(t.${keyName}, 0) + :${pkey}`);
        this._param[pkey] = value;
        return this;
    }
    /** GROUP BY key1, key2, ... */
    @IF_PROCEED<T>()
    groupBy(...keys: (keyof T)[]) { this._groups.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()}`)); return this; }
    /** GROUP BY key1, key2, ... */
    @IF_PROCEED<T>()
    groupBy2(...keys: string[]) { this._groups.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()}`)); return this; }
    /** ORDER BY key1 ASC, key2 ASC, ... */
    @IF_PROCEED<T>()
    asc(...keys: (keyof T)[]) { this._orders.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()} ASC`)); return this; }
    /** ORDER BY key1 ASC, key2 ASC, ... */
    @IF_PROCEED<T>()
    asc2(...keys: string[]) { this._orders.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()} ASC`)); return this; }
    /** ORDER BY key1 DESC, key2 DESC, ... */
    @IF_PROCEED<T>()
    desc(...keys: (keyof T)[]) { this._orders.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()} DESC`)); return this; }
    /** ORDER BY key1 DESC, key2 DESC, ... */
    @IF_PROCEED<T>()
    desc2(...keys: string[]) { this._orders.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()} ASC`)); return this; }
    /** LIMIT :startRow, :pageSize */
    @IF_PROCEED<T>()
    limit(startRow: number, pageSize: number) { this._startRow = startRow; this._pageSize = pageSize; return this; }
    /** LIMIT ((:pageNumber || 1) - 1) * :pageSize, :pageSize */
    @IF_PROCEED<T>()
    page(pageNumber: number, pageSize: number) { this._startRow = ((pageNumber || 1) - 1) * pageSize; this._pageSize = pageSize; return this; }
    @IF_PROCEED<T>()
    distinct(on = true) { this._distinct = on; return this; }
    /** COUNT(DISTINCT key) */
    @IF_PROCEED<T>()
    countDistinct(key: keyof T, countName?: string,) { this._columns.push(`COUNT(DISTINCT t.${this[_fields]![String(key)]?.C2()}) ${countName || this[_fields]![String(key)]?.C2()}`); return this; }
    @IF_PROCEED<T>()
    count(countName?: string) { this._columns.push(`COUNT(1) ${countName ?? 'ct'}`); return this; }
    @IF_PROCEED<T>()
    sum(key: keyof T, legName?: string, distinct?: boolean) { this._columns.push(`SUM(${distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}) ${legName || this[_fields]![String(key)]?.C2()}`); return this; }
    @IF_PROCEED<T>()
    avg(key: keyof T, legName?: string, distinct?: boolean) { this._columns.push(`AVG(${distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}) ${legName || this[_fields]![String(key)]?.C2()}`); return this; }
    @IF_PROCEED<T>()
    max(key: keyof T, legName?: string, distinct?: boolean) { this._columns.push(`MAX(${distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}) ${legName || this[_fields]![String(key)]?.C2()}`); return this; }
    @IF_PROCEED<T>()
    min(key: keyof T, legName?: string, distinct?: boolean) { this._columns.push(`MIN(${distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}) ${legName || this[_fields]![String(key)]?.C2()}`); return this; }
    /** GROUP_CONCAT([DISTINCT] key [ORDER BY :asc ASC] [ORDER BY :asc DESC] [SEPARATOR :separator]) */
    @IF_PROCEED<T>()
    groupConcat(key: keyof T, param?: { distinct?: boolean, separator?: string, asc?: (keyof T)[], desc?: (keyof T)[], groupName?: string }): this {
        this._columns.push(`GROUP_CONCAT(
            ${param && param.distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}
            ${param && param.asc && param.asc.length > 0 ? `ORDER BY ${param.asc.map(i => `t.${this[_fields]![String(i)]?.C2()} ASC`)} ` : ''}
            ${param && param.desc && param.desc.length > 0 ? `${param && param.asc && param.asc.length > 0 ? '' : 'ORDER BY'} ${param.desc.map(i => `t.${this[_fields]![String(i)]?.C2()} DESC`)} ` : ''}
            SEPARATOR '${param && param.separator || ','}'
            ) ${param && param.groupName || this[_fields]![String(key)]?.C2()}`);
        return this;
    }
    @IF_PROCEED<T>()
    select(...key: (keyof T)[]) { this._columns.push(...(key.map(k => `t.${this[_fields]![String(k)]!.C3()}`))); return this; }
    /**
     * sql查询语句拼接：注意若有JOIN，需要写明别名。本表别名为t.例如:
     * ```
     * select2('t.name, t.age, ISNULL(t.type, :type)', {type: 1});
     * select2('MAX(t.age) MAXAge');
     * ```
     */
    @IF_PROCEED<T>()
    select2(sql: string, param?: Record<string, any>) { this._columns.push(`${sql}`); Object.assign(this._param, param); return this; }
    @IF_PROCEED<T>()
    update(key: keyof T, value: T[keyof T]) { this._updates ??= {}; this._updates[this[_fields]![String(key)]?.C2()!] = value; return this; }
    /** update语句拼接：注意若有JOIN，需要写明别名。本表别名为t */
    @IF_PROCEED<T>()
    update2(sql: string, param?: Record<string, any>) { this._updateColumns.push(sql); Object.assign(this._param, param); return this; }
    @IF_PROCEED<T>()
    updateT(t: Partial<T>) {
        this._updates ??= {};
        for (const [key, value] of Object.entries(t)) {
            this._updates[this[_fields]![String(key)]?.C2()!] = value;
        }
        Object.assign(this._updates, t);
        return this;
    }
    /** SET key = REPLACE(key, :valueToFind,  :valueToReplace) */
    @IF_PROCEED<T>()
    replace(key: keyof T, valueToFind: T[keyof T], valueToReplace: T[keyof T]) {
        const [pkey1, pkey2] = [`p${this._prefix}${this._index++}`, `p${this._prefix}${this._index++}`];
        this._updateColumns.push(` t.${this[_fields]![String(key)]?.C2()} = REPLACE(t.${this[_fields]![String(key)]?.C2()}, :${pkey1}, :${pkey2}) `);
        this._param[pkey1] = valueToFind as any;
        this._param[pkey2] = valueToReplace as any;
        return this;
    }
    // #endregion

    excuteSelect<L = T>(option?: MethodOption & { sync?: SyncMode.Async; selectResult?: SelectResult.RS_CS | SelectResult.RS_C; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L[]>;
    excuteSelect<L = T>(option: MethodOption & { sync?: SyncMode.Async; selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L>;
    excuteSelect<L = T>(option: MethodOption & { sync?: SyncMode.Async; selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L | null>;
    excuteSelect<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.RS_CS | SelectResult.RS_C; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L[];
    excuteSelect<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L;
    excuteSelect<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L | null;
    @IF_EXEC<T>(null)
    excuteSelect<L = T>(option?: MethodOption & { sync?: SyncMode; selectResult?: SelectResult; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; }): null | L | L[] | Promise<null | L | L[]> {
        option ??= {};
        option.sync ??= SyncMode.Async;
        option.selectResult ??= SelectResult.RS_CS;
        const { where, params } = this._where();
        let sql = `
            SELECT
            ${this._distinct ? 'DISTINCT' : ''} ${this._columns && this._columns.length > 0 ? this._columns.join(',') : this[_columns].map(key => `t.${this[_fields]![String(key)]?.C3()}`).join(',')}
            FROM ${option.tableName ?? this._service[_tableName]} t
            ${where ? ' WHERE ' : ''}
            ${where}
            ${this._groups.length > 0 ? `GROUP BY ${this._groups.join(',')} ` : ''}
            ${this._orders.length > 0 ? `ORDER BY ${this._orders.join(',')} ` : ''}
        `;
        if (this._startRow && this._pageSize) {
            sql += `LIMIT ${this._startRow}, ${this._pageSize}`;
        } else if (this._startRow) {
            sql += `LIMIT ${this._startRow}`;
        }
        if (option.sync === SyncMode.Async) {
            switch (option.selectResult) {
                case SelectResult.RS_CS: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.RS_CS, sql, params });
                case SelectResult.RS_C: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.RS_C, sql, params });
                case SelectResult.R_CS_Assert: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.R_CS_Assert, sql, params });
                case SelectResult.R_C_Assert: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.R_C_Assert, sql, params });
                case SelectResult.R_CS_NotSure: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.R_CS_NotSure, sql, params });
                case SelectResult.R_C_NotSure: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.R_C_NotSure, sql, params });
            }
        } else {
            switch (option.selectResult) {
                case SelectResult.RS_CS: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.RS_CS, sql, params });
                case SelectResult.RS_C: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.RS_C, sql, params });
                case SelectResult.R_CS_Assert: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.R_CS_Assert, sql, params });
                case SelectResult.R_C_Assert: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.R_C_Assert, sql, params });
                case SelectResult.R_CS_NotSure: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.R_CS_NotSure, sql, params });
                case SelectResult.R_C_NotSure: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.R_C_NotSure, sql, params });
            }
        }
    }
    @IF_EXEC<T>(null)
    excutePage<L = T>(option?: MethodOption & { sync?: SyncMode; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): PageQuery<L> | Promise<PageQuery<L>> {
        option ??= {};
        option.sync ??= SyncMode.Async;
        const { where, params } = this._where();
        const result: PageQuery<L> = {
            records: [],
            size: 0,
            total: 0
        };
        let sql = `
            SELECT
            ${this._distinct ? 'DISTINCT' : ''} ${this._columns && this._columns.length > 0 ? this._columns.join(',') : this[_columns].map(key => `t.${this[_fields]![String(key)]?.C3()}`).join(',')}
            FROM ${option.tableName ?? this._service[_tableName]} t
            ${where ? ' WHERE ' : ''}
            ${where}
            ${this._groups.length > 0 ? `GROUP BY ${this._groups.join(',')} ` : ''}
            ${this._orders.length > 0 ? `ORDER BY ${this._orders.join(',')} ` : ''}
        `;
        if (this._startRow && this._pageSize) {
            sql += `LIMIT ${this._startRow}, ${this._pageSize}`;
        } else if (this._startRow) {
            sql += `LIMIT ${this._startRow}`;
        }
        const sqlCount = `
            SELECT COUNT(1)
            FROM ${option.tableName ?? this._service[_tableName]} t
            ${where ? ' WHERE ' : ''}
            ${where}
            ${this._groups.length > 0 ? `GROUP BY ${this._groups.join(',')} ` : ''}
            ${this._orders.length > 0 ? `ORDER BY ${this._orders.join(',')} ` : ''}
        `;
        if (option.sync === SyncMode.Sync) {
            result.total = this._service.select<number>({
                ...option,
                params,
                sql: sqlCount,
                sync: SyncMode.Sync,
                selectResult: SelectResult.R_C_Assert
            });
            result.size = calc(result.total)
                .add(this._pageSize - 1)
                .div(this._pageSize)
                .round(0, 2)
                .over();
            result.records = this._service.select<L>({
                ...option,
                params,
                sql,
                sync: SyncMode.Sync,
                selectResult: SelectResult.RS_CS
            });
            return result;
        } else {
            return new Promise<PageQuery<L>>(async (resolve, reject) => {
                try {
                    result.total = await this._service.select<number>({
                        ...option,
                        params,
                        sql: sqlCount,
                        sync: SyncMode.Async,
                        selectResult: SelectResult.R_C_Assert
                    });
                    result.size = calc(result.total)
                        .add(this._pageSize - 1)
                        .div(this._pageSize)
                        .round(0, 2)
                        .over();
                    result.records = await this._service.select<L>({
                        ...option,
                        params,
                        sql,
                        sync: SyncMode.Async,
                        selectResult: SelectResult.RS_CS
                    });
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        }
    }
    excuteUpdate(option?: MethodOption & { sync?: SyncMode.Async; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; }): Promise<number>;
    excuteUpdate(option: MethodOption & { sync: SyncMode.Sync; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; }): number;
    @IF_EXEC<T>(0)
    excuteUpdate(option?: MethodOption & { sync?: SyncMode; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; }): number | Promise<number> {
        option ??= {};
        option.sync ??= SyncMode.Async;
        const { where, params } = this._where();
        const sets = new Array<string>(...this._updateColumns);
        if (this._updates) {
            for (const [K, V] of Object.entries(this._updates)) {
                const pkey = `p${this._prefix}${this._index++}`;
                sets.push(` t.${K} = :${pkey} `);
                params[pkey] = V;
            }
        }
        if (sets.length > 0) {
            const sql = `UPDATE ${option.tableName ?? this._service[_tableName]} SET ${sets.join(',')}
            ${where ? ' WHERE ' : ''}
            ${where}
            `.replace(/t\./g, '');
            if (option.sync === SyncMode.Async) {
                return this._service.excute({ ...option, sync: SyncMode.Async, sql, params });
            } else {
                return this._service.excute({ ...option, sync: SyncMode.Sync, sql, params });
            }
        } else {
            return 0;
        }
    }
    excuteDelete(option?: MethodOption & { sync?: SyncMode.Async; forceDelete?: boolean; }): Promise<number>;
    excuteDelete(option: MethodOption & { sync: SyncMode.Sync; forceDelete?: boolean; }): number;
    @IF_EXEC<T>(0)
    excuteDelete(option?: MethodOption & { sync?: SyncMode; forceDelete?: boolean; }): number | Promise<number> {
        option ??= {};
        option.sync ??= SyncMode.Async;
        const { where, params } = this._where();
        const sql = `DELETE FROM ${option.tableName ?? this._service[_tableName]}
            ${where ? ' WHERE ' : ''}
            ${where}
        `.replace(/t\./g, '');
        // if (option.sync === SyncMode.Async) {
        //     return this._service.delete({ ...option, sync: SyncMode.Async, whereSql: where, whereParams: params });
        // } else {
        //     return this._service.delete({ ...option, sync: SyncMode.Sync, whereSql: where, whereParams: params });
        // }
        if (option.sync === SyncMode.Async) {
            return this._service.excute({ ...option, sync: SyncMode.Async, sql, params });
        } else {
            return this._service.excute({ ...option, sync: SyncMode.Sync, sql, params });
        }
    }
    private _where() {
        const wheres = new Array<string>();
        const sql = this._wheres.join(' ');
        if (sql) {
            wheres.push(`(${sql.replace(/^and|^or/i, '')})`);
        }
        if (this._orQuerys.length > 0) {
            for (const query of this._orQuerys) {
                const { where, params } = query._where();
                if (where) {
                    wheres.push(` OR (${where}) `);
                }
                Object.assign(this._param, params);
            }
        }
        if (this._andQuerys.length > 0) {
            for (const query of this._andQuerys) {
                const { where, params } = query._where();
                if (where) {
                    wheres.push(` AND (${where}) `);
                }
                Object.assign(this._param, params);
            }
        }
        return { where: wheres.join(' '), params: this._param };
    }
    private _(key: keyof T, value: any, op: string, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} ${not} ${op} :${pkey} `);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _2(key: keyof T, value: any, op: string, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND :${pkey} ${not} ${op} t.${this[_fields]![String(key)]?.C2()}`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private __(keys: (keyof T)[], value: any, op: string, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND (${keys.map(key => `t.${this[_fields]![String(key)]?.C2()} ${not} ${op} :${pkey} `).join(' OR ')})`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _null(key: keyof T, not = ''): this {
        this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} IS ${not} NULL`);
        return this;
    }
    private _key(key1: keyof T, key2: keyof T, op: string, not = '') {
        this._wheres.push(`AND t.${this[_fields]![String(key1)]?.C2()} ${not} ${op} t.${this[_fields]![String(key2)]?.C2()} `);
        return this;
    }
    private _between(key: keyof T, value1: string | number, value2: string | number, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value1 === null
            || value1 === undefined
            || (emptyString(`${value1 ?? ''}`) && skipEmptyString)
            || value2 === null
            || value2 === undefined
            || (emptyString(`${value2 ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName && this._paramKeys[paramName]) {
            this._param[this._paramKeys[paramName]![0]] = value1;
            this._param[this._paramKeys[paramName]![1]] = value2;
        } else {
            const [pkey1, pkey2] = [`p${this._prefix}${this._index++}`, `p${this._prefix}${this._index++}`];
            this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} ${not} BETWEEN :${pkey1} AND :${pkey2}`);
            this._param[pkey1] = value1;
            this._param[pkey2] = value2;
            if (paramName) {
                this._paramKeys[paramName] = [pkey1, pkey2];
            }
        }
        return this;
    }
    private _in(key: keyof T, value: Array<string | number>, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (value && value.length > 0 && skipEmptyString) {
            value = value.filter(v => !emptyString(`${v ?? ''}`));
        }
        if (value && value.length > 0) {
            if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
                this._param[this._paramKeys[paramName] as string] = value;
            } else {
                const pkey = `p${this._prefix}${this._index++}`;
                this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} ${not} IN (:${pkey}) `);
                this._param[pkey] = value;
                if (paramName) {
                    this._paramKeys[paramName] = pkey;
                }
            }
        } else if (breakExcuteIfEmpty) {
            this.if_exec = false;
        }
        return this;
    }
    private _in2(key: (keyof T)[], value: any, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        const skip = emptyString(`${value ?? ''}`) && skipEmptyString;
        if (!skip) {
            if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
                this._param[this._paramKeys[paramName] as string] = value;
            } else {
                const pkey = `p${this._prefix}${this._index++}`;
                this._wheres.push(`AND :${pkey} ${not} IN (${key.map(k => `t.${this[_fields]![String(k)]?.C2()}`).join(',')}) `);
                this._param[pkey] = value;
                if (paramName) {
                    this._paramKeys[paramName] = pkey;
                }
            }
        } else if (breakExcuteIfEmpty) {
            this.if_exec = false;
        }
        return this;
    }
    private _shift(key1: keyof T, key2: keyof T, value: number, op: string, { not = '', paramName = '', breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || emptyString(`${value ?? ''}`)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND (t.${this[_fields]![String(key1)]?.C2()} << 8) + t.${this[_fields]![String(key2)]?.C2()} ${not} ${op} :${pkey} `);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _match(value: string, keys: (keyof T)[], { paramName = '', not = '', append = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || emptyString(`${value ?? ''}`)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND ${not} MATCH(${keys.map(key => `t.${this[_fields]![String(key)]?.C2()}`).join(',')}) AGAINST (:${pkey} ${append ?? ''})`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _pow(key: keyof T, value: number, { not = '', paramName = '', breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || emptyString(`${value ?? ''}`)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND ${not} POW(2, t.${this[_fields]![String(key)]?.C2()}) & :${pkey}`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _pow2(key: keyof T, value: number, { not = '', paramName = '', breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || emptyString(`${value ?? ''}`)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND ${not} POW(2, :${pkey}) & t.${this[_fields]![String(key)]?.C2()}`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _like(key: keyof T, value: any, { not = '', left = '', right = '', paramName = '', op = 'LIKE', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }

        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} ${not} ${op} CONCAT('${left}', :${pkey}, '${right}') `);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _like2(key: keyof T, value: any, { not = '', left = '', right = '', paramName = '', op = 'LIKE', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }

        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND :${pkey} ${not} ${op} CONCAT('${left}',t.${this[_fields]![String(key)]?.C2()}, '${right}') `);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _includes(key: keyof T, value: any, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND LOCATE(t.${this[_fields]![String(key)]?.C2()}, :${pkey}) ${not ? '=' : '>'}  0`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _includes2(key: keyof T, value: any, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND LOCATE(:${pkey}, t.${this[_fields]![String(key)]?.C2()}) ${not ? '=' : '>'}  0`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
}
/**
 获取REDIS客户端，
 # [查看库的API](https://redis.github.io/ioredis/)
 # [REDIS API](http://doc.redisfans.com/)
 REDIS 的API 可以直接用，将方法名转为小写
 ```
 // 设置<Redis>来获得代码提示
 getRedisDB<Redis>('').exists(?)
 ```
 */
export function getRedisDB<T = any>(db?: string): T {
    const rd = globalThis[_dao][DBType.Redis][db ?? _primaryDB];
    Throw.if(!rd, 'not found redis!');
    return rd as T;
}
/**
 redlock
 */
export async function GetRedisLock(key: string, lockMaxActive?: number) {
    const lock = globalThis[_dao][DBType.RedisLock];
    Throw.if(!lock, 'not found lock!');
    const db = getRedisDB();
    let initLock: any;
    try {
        initLock = await lock.acquire([`[lockex]${key}`], 5000);
        const count = await db.get(key);
        if (count === null || parseInt(count) < (lockMaxActive ?? 1)) {
            await db.incr(key);
            return true;
        } else {
            return false;
        }
    } catch (er: any) {
        return await GetRedisLock(key, lockMaxActive);
    } finally {
        if (initLock) {
            try {
                await initLock.release();
                // eslint-disable-next-line no-empty
            } catch (error: any) {
            }
        }
    }
};
/** 对FN加锁、缓存执行 */
export async function excuteWithLock<T>(config: {
    /** 返回缓存key,参数=方法的参数+当前用户对象，可以用来清空缓存。 */
    key: ((...args: any[]) => string) | string;
    /** 被锁定线程是否sleep直到解锁为止? 默认true */
    lockWait?: boolean;
    /** 当设置了lockWait=true时，等待多少【毫秒】进行一次锁查询? 默认：100MS */
    lockRetryInterval?: number;
    /** 当设置了lockWait=true时，等待多少【毫秒】即视为超时，放弃本次访问？默认：永不放弃 */
    lockMaxWaitTime?: number;
    /** 错误信息 */
    errorMessage?: string;
    /** 允许的并发数，默认：1 */
    lockMaxActive?: number;
    /** 单个锁多少【毫秒】后自动释放?默认：60*1000MS  */
    lockMaxTime?: number;
}, fn__: () => Promise<T>): Promise<T> {
    const key = `[lock]${typeof config.key === 'function' ? config.key() : config.key}`;
    const db = getRedisDB();
    let wait_time = 0;
    const fn = async () => {
        const lock = await GetRedisLock(key, config.lockMaxActive);
        if (lock === false) {
            if (config.lockWait !== false && ((config.lockMaxWaitTime ?? 0) === 0 || (wait_time + (config.lockRetryInterval ?? 100)) <= (config.lockMaxWaitTime ?? 0))) {
                logger.debug(`get lock ${key} fail, retry after ${config.lockRetryInterval ?? 100}ms...`);
                await sleep(config.lockRetryInterval ?? 100);
                wait_time += (config.lockRetryInterval ?? 100);
                return await fn();
            } else {
                logger.debug(`get lock ${key} fail`);
                throw new Error(config.errorMessage || `get lock fail: ${key}`);
            }
        } else {
            logger.debug(`get lock ${key} ok!`);
            await db.pexpire(key, config.lockMaxTime ?? 60000);
            try {
                return await fn__();
            } finally {
                logger.debug(`unlock ${key} ok!`);
                await db.decr(key);
            }
        }
    };
    return await fn();
}
/** 与缓存共用时，需要在缓存之前:有缓存则返回缓存,否则加锁执行并缓存,后续队列全部返回缓存,跳过执行 */
export function MethodLock<T = any>(config: {
    /** 返回缓存key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来清空缓存。 */
    key: ((this: T, ...args: any[]) => string) | string;
    /** 被锁定线程是否sleep直到解锁为止? 默认true */
    lockWait?: boolean;
    /** 当设置了lockWait=true时，等待多少【毫秒】进行一次锁查询? 默认100ms */
    lockRetryInterval?: number;
    /** 当设置了lockWait=true时，等待多少【毫秒】即视为超时，放弃本次访问？默认永不放弃 */
    lockMaxWaitTime?: number;
    /** 错误信息 */
    errorMessage?: string;
    /** 允许的并发数，默认=1 */
    lockMaxActive?: number;
    /** 单个锁多少【毫秒】后自动释放?即时任务没有执行完毕或者没有主动释放锁?  */
    lockMaxTime?: number;
}) {
    return function (target: T, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn__ = descriptor.value;
        descriptor.value = async function (this: any, ...args: any[]) {
            config.key = typeof config.key === 'function' ? config.key.call(target, ...args) : config.key;
            return await excuteWithLock(config, async () => await fn__.call(this, ...args));
        };
    };
}
/** 设置方法缓存 */
async function setMethodCache(
    config: {
        key: string;
        clearKey?: string[];
        /** 自动清空缓存的时间，单位分钟 */
        autoClearTime?: number;
        result: any;
    },
    devid?: string | false | undefined
) {
    const db = getRedisDB();
    if (config.result !== null && config.result !== undefined) {
        // 映射关系存放
        if (config.clearKey && config.clearKey.length > 0) {
            for (const clear of config.clearKey) {
                await db.sadd(`[cache-parent]${clear}`, config.key);
                await db.sadd(`[cache-child]${config.key}`, clear);
            }
        }
        if (config.autoClearTime) { // 自动清空
            await db.set(`[cache]${config.key}`, JSON.stringify(config.result), 'EX', config.autoClearTime * 60);
            // 订阅：清空 clear list
            if (config.clearKey && config.clearKey.length > 0) {
                globalThis[_EventBus].on(`[cache]${config.key}`, async (key: string) => {
                    await clearChild(key, true);
                });
            }
        } else {
            await db.set(`[cache]${config.key}`, JSON.stringify(config.result));
        }
        if (devid) {
            // 订阅：清空 clear list
            globalThis[_EventBus].on(`user-${devid}`, async function (key: string) {
                await clearChild(key);
            });
        }
    }
}
/** 清空方法缓存 */
export async function clearMethodCache(key: string) {
    const db = getRedisDB();
    let type = await db.type(`[cache-parent]${key}`);
    if (type === 'set') {
        await clearParent(key);
    }
    type = await db.type(`[cache]${key}`);
    if (type !== 'none') {
        await clearChild(key);
    }
}
async function clearChild(key: string, skipDel = false) {
    const db = getRedisDB();
    if (skipDel === false) {
        await db.del(`[cache]${key}`);
    }
    const childtype = await db.type(`[cache-child]${key}`);
    if (childtype === 'set') {
        const parentKeys = await db.smembers(`[cache-child]${key}`);
        for (const clear of parentKeys) {
            const type = await db.type(`[cache-parent]${clear}`);
            if (type === 'set') {
                await db.srem(`[cache-parent]${clear}`, key);
            }
        }
        await db.del(`[cache-child]${key}`);
    }
}
async function clearParent(clearKey: string) {
    const db = getRedisDB();
    const keys = await db.smembers(`[cache-parent]${clearKey}`);
    if (keys) {
        for (const key of keys) {
            logger.debug(`cache ${key} cleared!`);
            await clearChild(key);
        }
    }
}
/**
 * 执行一个方法fn，
 * 如果有缓存，则返回缓存，否则执行方法并缓存
 */
export async function excuteWithCache<T>(config: {
    /** 返回缓存key,参数=方法的参数+当前用户对象，可以用来清空缓存。 */
    key: string;
    /** 返回缓存清除key,参数=方法的参数+当前用户对象，可以用来批量清空缓存 */
    clearKey?: string[];
    /** 自动清空缓存的时间，单位分钟 */
    autoClearTime?: number;
    /** 随着当前用户sesion的清空而一起清空 */
    clearWithSession?: boolean;
}, fn: () => Promise<T>): Promise<T> {
    const db = getRedisDB();
    const cache = await db.get(`[cache]${config.key}`);
    if (cache) {
        logger.debug(`cache ${config.key} hit!`);
        return JSON.parse(cache as string);
    } else {
        logger.debug(`cache ${config.key} miss!`);
        const result = await fn();
        await setMethodCache({
            key: config.key,
            clearKey: config.clearKey,
            autoClearTime: config.autoClearTime,
            result
        });
        return result;
    }
}
/** 缓存注解 */
export function MethodCache<T = any>(config: {
    /** 返回缓存key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来清空缓存。 */
    key: ((this: T, ...args: any[]) => string) | string;
    /** 返回缓存清除key,参数=方法的参数[注意：必须和主方法的参数数量、完全一致，同时会追加一个当前用户对象]+当前用户对象，可以用来批量清空缓存 */
    clearKey?: ((this: T, ...args: any[]) => string[]) | string[];
    /** 自动清空缓存的时间，单位分钟 */
    autoClearTime?: number;
    /** 随着当前用户sesion的清空而一起清空 */
    clearWithSession?: boolean;
}) {
    return function (target: T, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn = descriptor.value;
        descriptor.value = async function (this: any, ...args: any[]) {
            const key = typeof config.key === 'function' ? config.key.call(this, ...args) : config.key;
            const db = getRedisDB();
            const cache = await db.get(`[cache]${key}`);
            if (cache) {
                logger.debug(`cache ${key} hit!`);
                return JSON.parse(cache);
            } else {
                logger.debug(`cache ${key} miss!`);
                const result = await fn.call(this, ...args);
                const clearKey = config.clearKey ? typeof config.clearKey === 'function' ? config.clearKey.call(this, ...args) : config.clearKey : undefined;
                await setMethodCache({
                    key,
                    clearKey,
                    autoClearTime: config.autoClearTime,
                    result
                }, config.clearWithSession && this.ctx.me && this.ctx.me.devid);
                return result;
            }
        };
    };
}
class MUParser {
    static END = 1;
    private modelName: string;
    private linNumber = 0;
    private lastLine: string = '';
    private lastlastLine: string = '';
    private status = 0;
    private lineSeparator = '\n';
    private files: string[];
    constructor(modelName: string, file: string) {
        this.modelName = modelName;
        this.files = file.replace(/\r/g, '').split(this.lineSeparator);
        this.skipHeader();
    }
    next(): [string, string] | null {
        let sqlId: string = this.readSqlId();
        if (this.status === MUParser.END) {
            return null;
        }
        // 去掉可能的尾部空格
        sqlId = sqlId.trim();
        this.skipComment();
        if (this.status === MUParser.END) {
            return null;
        }
        const sql: string = this.readSql();
        return [`${this.modelName}.${sqlId}`, sql];
    }
    private skipHeader(): void {
        while (true) {
            const line: string = this.nextLine();
            if (this.status === MUParser.END) {
                return;
            }
            if (line.startsWith('===')) {
                return;
            }
        }
    }
    private nextLine(): string {
        const line: string = this.files[this.linNumber]!;
        this.linNumber++;
        if (line === undefined) {
            this.status = MUParser.END;
        }
        // 保存最后读的俩行
        this.lastlastLine = this.lastLine;
        this.lastLine = line;
        return line;
    }
    private readSqlId(): string {
        return this.lastlastLine;
    }
    private skipComment(): void {
        let findComment = false;
        while (true) {
            let line: string = this.nextLine();
            if (this.status === MUParser.END) {
                return;
            }
            line = line.trim();
            if (!findComment && line.length === 0) {
                continue;
            }
            if (line.startsWith('*')) {
                // 注释符号
                findComment = true;
                continue;
            } else {
                if (line.length === 0) {
                    continue;
                } else if (line.startsWith('```') || line.startsWith('~~~')) {
                    // 忽略以code block开头的符号
                    continue;
                } else {
                    // 注释结束
                    return;
                }
            }
        }
    }
    private readSql(): string {
        const list: string[] = [];
        list.push(this.lastLine);
        while (true) {
            const line: string = this.nextLine();

            if (this.status === MUParser.END) {
                return this.getBuildSql(list);
            }

            if (line.startsWith('===')) {
                // 删除下一个sqlId表示
                list.pop();
                return this.getBuildSql(list);
            }
            list.push(line);
        }
    }
    private getBuildSql(list: string[]): string {
        const sb: string[] = [];
        for (const str of list) {
            const s: string = str.trim();
            if (s.startsWith('```') || s.startsWith('~~~')) {
                // 忽略以code block开头的符号
                continue;
            }
            sb.push(str);
        }
        return sb.join(this.lineSeparator);
    }
}
