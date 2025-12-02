import { DBType, _Hump, getEnums } from 'baja-lite-field';
import { ColumnMode, GlobalSqlOptionForWeb, LoggerService, PrinterLogger, SqlCache, SqliteRemote, _Context, _DataConvert, _GlobalSqlOption, _LoggerService, _dao, _defOption, _enum, _primaryDB, _sqlCache } from './sql.js';

export const BootRomote = async function (options: GlobalSqlOptionForWeb) {
    globalThis[_GlobalSqlOption] = Object.assign({}, _defOption);
    if (options.skipEmptyString !== undefined) {
        globalThis[_GlobalSqlOption].skipEmptyString = options.skipEmptyString;
    }
    if (options.skipNull !== undefined) {
        globalThis[_GlobalSqlOption].skipNull = options.skipNull;
    }
    if (options.skipEmptyString !== undefined) {
        globalThis[_GlobalSqlOption].skipEmptyString = options.skipEmptyString;
    }
    if (options.maxDeal !== undefined) {
        globalThis[_GlobalSqlOption].maxDeal = options.maxDeal;
    }
    if (options.SqliteRemote !== undefined) {
        globalThis[_GlobalSqlOption].SqliteRemote = options.SqliteRemote;
    }
    if (options.logger) {
        globalThis[_LoggerService] = options.logger;
    } else {
        globalThis[_LoggerService] = new PrinterLogger();
    }
    (globalThis[_LoggerService]! as LoggerService).setLogLevels(options.log ? (options.log instanceof Array ? options.log : [options.log]) : ['info']);
    globalThis[_Hump] = options.columnMode === ColumnMode.HUMP;
    globalThis[_sqlCache] = new SqlCache();
    if (options.sqlMap) {
        await globalThis[_sqlCache].init(options);
    }
    globalThis[_dao] = {
        [DBType.SqliteRemote]: {},
    };
    if (options.enums) {
        globalThis[_enum] = getEnums(options.enums);
    }
    if (options.dataConvert) {
        globalThis[_DataConvert] = options.dataConvert;
    }
    if (options.ctx) {
        globalThis[_Context] = options.ctx;
    }
    if (options.SqliteRemote && options.SqliteRemote.db) {
        if (typeof options.SqliteRemote.db === 'string') {
            options.SqliteRemote.service.initDB(options.SqliteRemote.db);
            globalThis[_dao][DBType.SqliteRemote][_primaryDB] = new SqliteRemote(options.SqliteRemote.service, options.SqliteRemote.db);
        } else {
            let flag = false;
            for (const [key, fileName] of Object.entries(options.SqliteRemote.db)) {
                await options.SqliteRemote.service.initDB(fileName);
                const db = new SqliteRemote(options.SqliteRemote.service, fileName);
                if (flag === false) {
                    globalThis[_dao][DBType.SqliteRemote][_primaryDB] = db;
                    flag = true;
                }
                globalThis[_dao][DBType.SqliteRemote][key] = db;
            }
        }
    }
}

// export const AppendRomote = async function (dbName: string) {
//     if (!globalThis[_dao][DBType.SqliteRemote][dbName]) {
//         globalThis[_GlobalSqlOption].SqliteRemote.service.initDB(dbName);
//         const db = new SqliteRemote(globalThis[_GlobalSqlOption].SqliteRemote.service, dbName);
//         if (globalThis[_dao][DBType.SqliteRemote][_primaryDB] === undefined) {
//             globalThis[_dao][DBType.SqliteRemote][_primaryDB] = db;
//         }
//         globalThis[_dao][DBType.SqliteRemote][dbName] = db;
//     }
// }