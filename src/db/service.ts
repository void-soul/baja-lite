import {
    _columns,
    _columnsNoId,
    _def,
    _deleteState,
    _fields,
    _Hump,
    _ids,
    _index,
    _logicIds,
    _stateFileName,
    AField,
    DBType,
    Field,
    FieldOption,
    LGet,
} from 'baja-lite-field';
import * as ite from 'iterare';
import { formatDialect, mysql, postgresql, sqlite } from 'sql-formatter';
import tslib from 'tslib';
import { Throw } from '../error.js';
import { excuteSplit, ExcuteSplitMode } from '../fn.js';
import { calc, ten2Any } from '../math.js';
import { C2P, C2P2, P2C } from '../object.js';
import { snowflake } from '../snowflake.js';
import { emptyString } from '../string.js';
import {
    _ClassName,
    _className,
    _comment,
    _Context,
    _dao,
    _DataConvert,
    _daoConnection,
    _daoDB,
    _daoDBName,
    _dbType,
    _GlobalSqlOption,
    _inTransaction,
    _LoggerService,
    _primaryDB,
    _resultMap_SQLID,
    _sqlCache,
    _SqlOption,
    _sqlite_version,
    _tableName,
    _transformer,
    _vueName,
} from '../const/symbols.js';
import { LoggerService } from '../logger.js';
import {
    Connection,
    Dao,
    DeleteMode,
    InsertMode,
    MethodOption,
    PageQuery,
    SelectMode,
    SelectResult,
    ServiceOption,
    SqlMapper,
    SyncMode,
    TemplateResult,
    MapperIfUndefined,
    _defOption,
} from '../const/types.js';
import { Sqlite } from './dao/sqlite.js';
import { SqliteRemote } from './dao/sqlite-remote.js';
import { flatData } from './sql-template.js';
import { StreamQuery } from './stream-query.js';

const iterate = ite.iterate;

const formatDialects = {
    [DBType.Mysql]: mysql,
    [DBType.Sqlite]: sqlite,
    [DBType.SqliteRemote]: sqlite,
    [DBType.Postgresql]: postgresql,
};

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

            // 错误日志输出函数：原实现里 `let args = ''` 把外层 rest 参数 `args` 给遮蔽了，
            // 导致 args.length 永远是 0，params 日志永远打不出来，生产排查时丢失关键上下文。
            const dumpArgs = (callArgs: any[]) => {
                if (callArgs.length > 0 && callArgs[0] && (callArgs[0] as any).params) {
                    try {
                        return JSON.stringify((callArgs[0] as any).params);
                    } catch {
                        return '<unserializable params>';
                    }
                }
                return '';
            };

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
                    (globalThis[_LoggerService]! as LoggerService).log(`${propertyKey}:${(option as any).sqlId ?? option!.tableName}:use ${+new Date() - startTime}ms`);
                    return result;
                } catch (error) {
                    console.error(`${(option as any).sqlId ?? option.tableName} service ${propertyKey} have an error:${error}, it's argumens: ${dumpArgs(args)}`);
                    throw error;
                } finally {
                    if (needRealseConn && option && option!.conn) {
                        try {
                            option!.conn!.release(SyncMode.Sync);
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
                return (async () => {
                    try {
                        // 连接共享
                        if (skipConn === false && !option!.conn) {
                            (option!).conn = await option!.dao!.createConnection(SyncMode.Async);
                        } else {
                            needRealseConn = false;
                        }
                        const result = await fn.call(this, ...args);
                        (globalThis[_LoggerService]! as LoggerService).log(`${propertyKey}:${(option as any).sqlId ?? option!.tableName}:use ${+new Date() - startTime}ms`);
                        return result;
                    } catch (error) {
                        console.error(`${(option as any).sqlId ?? option.tableName} service ${propertyKey} have an error:${error}, it's argumens: ${dumpArgs(args)}`);
                        throw error;
                    } finally {
                        if (needRealseConn && option && option!.conn) {
                            try {
                                await option!.conn!.release(SyncMode.Async);
                            } catch (error) {

                            }
                        }
                    }
                })();

            } else if (option!.dbType === DBType.Mysql) {
                Throw.if(!option!.dao, `not found db:${String(option!.dbName)}(${option!.dbType})`);
                return (async () => {
                    try {
                        // 连接共享
                        if (skipConn === false && !option!.conn) {
                            (option!).conn = await option!.dao!.createConnection(SyncMode.Async);
                        } else {
                            needRealseConn = false;
                        }
                        const result = await fn.call(this, ...args);
                        (globalThis[_LoggerService]! as LoggerService).log(`${propertyKey}:${(option as any).sqlId ?? option!.tableName}:use ${+new Date() - startTime}ms`);
                        return result;
                    } catch (error) {
                        console.error(`${(option as any).sqlId ?? option.tableName} service ${propertyKey} have an error:${error}, it's argumens: ${dumpArgs(args)}`);
                        throw error;
                    } finally {
                        if (needRealseConn && option && option!.conn) {
                            try {
                                await option!.conn!.release(SyncMode.Async);
                            } catch (error) {

                            }
                        }
                    }
                })();
            } else if (option!.dbType === DBType.Postgresql) {
                Throw.if(!option!.dao, `not found db:${String(option!.dbName)}(${option!.dbType})`);
                return (async () => {
                    try {
                        // 连接共享
                        if (skipConn === false && !option!.conn) {
                            (option!).conn = await option!.dao!.createConnection(SyncMode.Async);
                        } else {
                            needRealseConn = false;
                        }
                        const result = await fn.call(this, ...args);
                        (globalThis[_LoggerService]! as LoggerService).log(`${propertyKey}:${(option as any).sqlId ?? option!.tableName}:use ${+new Date() - startTime}ms`);
                        return result;
                    } catch (error) {
                        console.error(`${(option as any).sqlId ?? option.tableName} service ${propertyKey} have an error:${error}, it's argumens: ${dumpArgs(args)}`);
                        throw error;
                    } finally {
                        if (needRealseConn && option && option!.conn) {
                            try {
                                await option!.conn!.release(SyncMode.Async);
                            } catch (error) {

                            }
                        }
                    }
                })();
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
                // 用 snowflake 替代 Math.random()——Math.random() 在高并发下可能碰撞，
                // 同一连接里多次 InsertWithTempTable 会因为撞名 DDL 报错。
                const tableTemp = `${option?.tableName}_${snowflake.generate()}`;
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
        const tableTemp = `${option?.tableName}_${snowflake.generate()}`;
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
        const tableTemp = `${option?.tableName}_${snowflake.generate()}`;
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
            return (async (): Promise<L | null | L[]> => {
                let result: any;
                for (let i = 0; i < sqls.length; i++) {
                    if (i === resultIndex) {
                        result = await option!.conn!.query(SyncMode.Async, sqls[i]?.sql, sqls[i]?.params);
                    } else {
                        await option!.conn!.execute(SyncMode.Async, sqls[i]?.sql, sqls[i]?.params);
                    }
                }
                return this._template(option.templateResult!, result, option.error);
            })();
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
        const _params = Object.assign({}, option.params);
        option.sql ??= globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: Object.assign({}, option.context, globalThis[_Context]), isCount: option.isCount, ..._params });
        const { sql, params } = this._generSql(option!.dbType!, option.sql, _params);
        if (option.sync === SyncMode.Sync) {
            const result = option!.conn!.query(SyncMode.Sync, sql, params);
            return this._select<L>(option.selectResult, result, option.defValue, option.errorMsg, option.hump, option.mapper, option.mapperIfUndefined, option.dataConvert);
        } else {
            return (async (): Promise<L | null | L[]> => {
                const result = await option!.conn!.query(SyncMode.Async, sql, params);
                return this._select<L>(option.selectResult!, result, option.defValue!, option.errorMsg, option.hump, option.mapper, option.mapperIfUndefined, option.dataConvert)!;
            })();
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
        const _params = Object.assign({}, option.params);
        option.sql ??= globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: Object.assign({}, option.context, globalThis[_Context]), isCount: false, ..._params });
        const { sql, params } = this._generSql(option!.dbType!, option.sql, _params);
        if (option.sync === SyncMode.Sync) {
            const result = option!.conn!.query<{ [K in keyof T]: T[K][] }>(SyncMode.Sync, sql, params);
            return result.map(item => this._select<{ [K in keyof T]: T[K][]; }>(option.selectResult!, item, null, undefined, option.hump, option.mapper, option.mapperIfUndefined, option.dataConvert)) as { [K in keyof T]: T[K][] };
        } else {
            return (async (): Promise<{ [K in keyof T]: T[K][] }> => {
                const result = await option!.conn!.query<{ [K in keyof T]: T[K][] }>(SyncMode.Async, sql, params);
                return result.map(item => this._select<{ [K in keyof T]: T[K][]; }>(option.selectResult!, item, null, undefined, option.hump, option.mapper, option.mapperIfUndefined, option.dataConvert)) as { [K in keyof T]: T[K][] };
            })();
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
        const _params = Object.assign({}, option.params);
        option.sql ??= globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx: Object.assign({}, option.context, globalThis[_Context]), ..._params });
        const { sql, params } = this._generSql(option!.dbType!, option.sql, _params);
        if (option.sync === SyncMode.Sync) {
            const result = option!.conn!.execute(SyncMode.Sync, sql, params);
            return result.affectedRows;
        } else {
            return (async (): Promise<number> => {
                const result = await option!.conn!.execute(SyncMode.Async, sql, params);
                return result.affectedRows;
            })();
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
            return option!.dao!.transaction(SyncMode.Async, option.fn as (conn: Connection) => Promise<L>, option.conn);
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
        // 不要 Object.assign 进调用方的 params——@P 装饰器对 option 只做了浅拷贝，
        // option.params 仍指向用户传入的对象，原写法会把分页字段写回去污染下一次调用。
        option.params = Object.assign(
            {},
            option.params,
            {
                limitStart: calc(option.pageNumber).sub(1).mul(option.pageSize).over(),
                limitEnd: option.pageSize - 0,
                sortName: option.sortName ?? undefined,
                sortType: option.sortType ?? undefined
            }
        );
        const ctx = Object.assign({}, option.context, globalThis[_Context]);
        let sql = globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx, isCount: false, ...option.params });
        let sqlSum = '';
        let sqlCount = '';
        if (option.sum) {
            if (option.sumSelf) {
                sqlCount = globalThis[_sqlCache].load(this._matchSqlid(`${option.sqlId}_sum`), { ctx, isCount: false, isSum: true, ...option.params });
            } else {
                sqlSum = globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx, isCount: false, isSum: true, ...option.params });
            }
        }
        if (option.limitSelf !== true && option.pageSize > 0) {
            sql = `${sql} LIMIT ${option.params['limitStart']}, ${option.pageSize}`;
        }
        if (option.pageSize > 0) {
            if (option.countSelf) {
                sqlCount = globalThis[_sqlCache].load(this._matchSqlid(`${option.sqlId}_count`), { ctx, isCount: true, isSum: false, ...option.params });
            } else {
                sqlCount = globalThis[_sqlCache].load(this._matchSqlid(option.sqlId), { ctx, isCount: true, isSum: false, ...option.params });
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
            return (async (): Promise<PageQuery<L>> => {
                if (sqlCount) {
                    result.total = await this.select<number>({
                        ...option,
                        sql: sqlCount,
                        sync: SyncMode.Async,
                        selectResult: SelectResult.R_C_Assert
                    });
                    // 修正运算符优先级：`option.pageSize ?? 10 - 1` 被解析为 `pageSize ?? 9`，
                    // 而同步分支用的是 `option.pageSize - 1`，行为不一致。
                    result.size = calc(result.total)
                        .add((option.pageSize ?? 10) - 1)
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
                return result;
            })();
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
            const lastVersion = this[_sqlite_version] ?? '1';
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

            return (async (): Promise<void> => {
                if (option?.force) {
                    await option!.conn!.execute(SyncMode.Async, `DROP TABLE IF EXISTS ${tableES};`);
                }
                const lastVersion = this[_sqlite_version] ?? '1';
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
            })();
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
