import { _Hump, DBType, getEnums } from 'baja-lite-field';
import events from 'events';
import { _Context, _dao, _DataConvert, _defOption, _enum, _EventBus, _fs, _GlobalSqlOption, _path, _primaryDB, _sqlCache, ColumnMode, GlobalSqlOption, logger, Mysql, Postgresql, SqlCache, Sqlite, SqliteRemote } from './sql.js';

export const Boot = async function (options: GlobalSqlOption) {
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
    globalThis[_Hump] = options.columnMode === ColumnMode.HUMP;
    logger.level = options.log ?? 'info';
    globalThis[_sqlCache] = new SqlCache();
    if (options.sqlDir) {
        globalThis[_path] = await import('path');
        globalThis[_fs] = await import('fs');
    }
    if (options.sqlMap || options.sqlDir) {
        await globalThis[_sqlCache].init(options);
    }
    globalThis[_dao] = {
        [DBType.Mongo]: {},
        [DBType.Mysql]: {},
        [DBType.Postgresql]: {},
        [DBType.Sqlite]: {},
        [DBType.SqliteRemote]: {},
        [DBType.Redis]: {}
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
    if (options.Mysql) {
        const { createPool } = await import('mysql2/promise');
        if (options.Mysql['host']) {
            globalThis[_dao][DBType.Mysql][_primaryDB] = new Mysql(createPool({
                ...options.Mysql,
                multipleStatements: true,
                decimalNumbers: true,
                supportBigNumbers: true
            }));
        }
        else {
            let flag = false;
            for (const [key, option] of Object.entries(options.Mysql)) {
                const db = new Mysql(createPool({
                    ...option,
                    multipleStatements: true,
                    decimalNumbers: true,
                    supportBigNumbers: true
                }));
                if (!flag) {
                    globalThis[_dao][DBType.Mysql][_primaryDB] = db;
                    flag = true;
                }
                globalThis[_dao][DBType.Mysql][key] = db;
            }
        }
    }
    if (options.Sqlite) {
        if (typeof options.Sqlite === 'string') {
            globalThis[_dao][DBType.Sqlite][_primaryDB] = new Sqlite(new options.BetterSqlite3(options.Sqlite, { fileMustExist: false }));
        } else {
            let flag = false;
            for (const [key, fileName] of Object.entries(options.Sqlite)) {
                const db = new Sqlite(new options.BetterSqlite3(fileName, { fileMustExist: false }));
                if (!flag) {
                    globalThis[_dao][DBType.Sqlite][_primaryDB] = db;
                    flag = true;
                }
                globalThis[_dao][DBType.Sqlite][key] = db;
            }
        }
    }
    if (options.SqliteRemote && options.SqliteRemote.db) {
        if (typeof options.SqliteRemote.db === 'string') {
            options.SqliteRemote.service.initDB(options.SqliteRemote.db);
            globalThis[_dao][DBType.SqliteRemote][_primaryDB] = new SqliteRemote(options.SqliteRemote.service, options.SqliteRemote.db);
        }
        else {
            let flag = false;
            for (const [key, fileName] of Object.entries(options.SqliteRemote.db)) {
                options.SqliteRemote.service.initDB(fileName);
                const db = new SqliteRemote(options.SqliteRemote.service, fileName);
                if (!flag) {
                    globalThis[_dao][DBType.SqliteRemote][_primaryDB] = db;
                    flag = true;
                }
                globalThis[_dao][DBType.SqliteRemote][key] = db;
            }
        }
    }
    if (options.Redis) {
        events.setMaxListeners(0);
        const { Redis } = await import('ioredis');
        if (options.Redis['host']) {
            globalThis[_dao][DBType.Redis][_primaryDB] = new Redis(options.Redis);
        }
        else {
            let flag = false;
            for (const [key, option] of Object.entries(options.Redis)) {
                const db = new Redis(option);
                if (!flag) {
                    globalThis[_dao][DBType.Redis][_primaryDB] = db;
                    flag = true;
                }
                globalThis[_dao][DBType.Redis][key] = db;
            }
        }
        const clients = Object.values(globalThis[_dao][DBType.Redis]) as any;
        const Redlock = await import('redlock');
        globalThis[_dao][DBType.RedisLock] = new Redlock.default(
            clients,
            {
                // The expected clock drift; for more details see:
                // http://redis.io/topics/distlock
                driftFactor: 0.01, // multiplied by lock ttl to determine drift time

                // The max number of times Redlock will attempt to lock a resource
                // before erroring.
                retryCount: 10,

                // the time in ms between attempts
                retryDelay: 200, // time in ms

                // the max time in ms randomly added to retries
                // to improve performance under high contention
                // see https://www.awsarchitectureblog.com/2015/03/backoff.html
                retryJitter: 200, // time in ms

                // The minimum remaining time on a lock before an extension is automatically
                // attempted with the `using` API.
                automaticExtensionThreshold: 500, // time in ms
            }
        );
        const { EventEmitter } = await import('events');
        const event = new EventEmitter({ captureRejections: true });
        event.on('error', error => {
            logger.error('event-bus', error);
        });
        globalThis[_EventBus] = event;
    }
    if (options.Postgresql) {
        const Pool = await import('pg-pool');
        if (options.Postgresql['host']) {
            globalThis[_dao][DBType.Postgresql][_primaryDB] = new Postgresql(new Pool.default(options.Postgresql));
        }
        else {
            let flag = false;
            for (const [key, option] of Object.entries(options.Postgresql)) {
                const db = new Postgresql(new Pool.default(option));
                if (!flag) {
                    globalThis[_dao][DBType.Postgresql][_primaryDB] = db;
                    flag = true;
                }
                globalThis[_dao][DBType.Postgresql][key] = db;
            }
        }
    }
}