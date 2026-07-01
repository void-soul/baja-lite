import { snowflake } from '../../snowflake.js';
import { _daoConnection, _daoDB, _GlobalSqlOption, _inTransaction, _LoggerService } from '../../const/symbols.js';
import { LoggerService } from '../../logger.js';
import { Connection, Dao, SyncMode } from '../../const/types.js';

export class SqliteConnection implements Connection {
    [_daoConnection]: any;
    [_inTransaction] = false;
    constructor(conn: any) {
        this[_daoConnection] = conn;
    }

    execute(sync: SyncMode.Sync, sql?: string, params?: any): { affectedRows: number; insertId: bigint; };
    execute(sync: SyncMode.Async, sql?: string, params?: any): Promise<{ affectedRows: number; insertId: bigint; }>;
    execute(sync: SyncMode, sql?: string, params?: any): { affectedRows: number; insertId: bigint; } | Promise<{ affectedRows: number; insertId: bigint; }> {
        try {
            (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
            if (!sql) { return { affectedRows: 0, insertId: 0n }; };
            if (sync === SyncMode.Async) {
                (globalThis[_LoggerService]! as LoggerService).warn(`SQLITE not supported async mode`);
                return { affectedRows: 0, insertId: 0n };
            };
            const result = this[_daoConnection].prepare(sql).run(params ?? {});
            const { changes, lastInsertRowid } = result;
            return { affectedRows: changes, insertId: lastInsertRowid ? BigInt(lastInsertRowid) : 0n };
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
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
            (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
            if (!sql) { return null };
            if (sync === SyncMode.Async) {
                (globalThis[_LoggerService]! as LoggerService).warn(`SQLITE not supported async mode`);
                return null;
            };
            return this[_daoConnection].prepare(sql).pluck().get(params ?? {});
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
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
            (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
            if (!sql) { return null };
            if (sync === SyncMode.Async) { return null };
            return this[_daoConnection].prepare(sql).get(params ?? {});
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
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
            (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
            if (!sql) { return []; };
            if (sync === SyncMode.Async) {
                (globalThis[_LoggerService]! as LoggerService).warn(`SQLITE not supported async mode`);
                return [];
            };
            return this[_daoConnection].prepare(sql).raw().all(params ?? {});
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
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
            (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
            if (!sql) { return []; };
            if (sync === SyncMode.Async) {
                (globalThis[_LoggerService]! as LoggerService).warn(`SQLITE not supported async mode`);
                return [];
            };
            return this[_daoConnection].prepare(sql).all(params ?? {});
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }

    release(sync: SyncMode.Sync): void;
    release(sync: SyncMode.Async): Promise<void>;
    release(sync: SyncMode): Promise<void> | void {
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
        this[_daoDB].function('TIME_TO_SEC', { deterministic: true }, (time: string) => {
            const parts = time.split(':');
            const hours = parseInt(parts[0] || '0');
            const minutes = parseInt(parts[1] || '0');
            const seconds = parseInt(parts[2] || '0');
            return hours * 3600 + minutes * 60 + seconds;
        });
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
            (globalThis[_LoggerService]! as LoggerService).error(`SQLITE not supported async mode`);
            return null;
        };
        return new SqliteConnection(this[_daoDB]);
    }

    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    transaction<T = any>(sync: SyncMode, fn: (conn: Connection) => T | Promise<T>, conn?: Connection | null): T | null | Promise<T | null> {
        if (sync === SyncMode.Async) {
            (globalThis[_LoggerService]! as LoggerService).warn(`SQLITE not supported async mode`);
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
