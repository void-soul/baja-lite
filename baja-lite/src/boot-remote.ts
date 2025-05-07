import { DBType, _Hump, getEnums } from 'baja-lite-field';
import { ColumnMode, GlobalSqlOptionForWeb, SqlCache, SqliteRemote, _GlobalSqlOption, _dao, _defOption, _enum, _primaryDB, _sqlCache, logger } from './sql.js';

export const BootRomote = async function (options: GlobalSqlOptionForWeb) {
    globalThis[_GlobalSqlOption] = Object.assign({}, _defOption, options);
    globalThis[_Hump] = globalThis[_GlobalSqlOption].columnMode === ColumnMode.HUMP;
    logger.level = options.log ?? 'info';
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