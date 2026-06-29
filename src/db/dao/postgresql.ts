import { _daoConnection, _daoDB, _GlobalSqlOption, _inTransaction, _LoggerService, _MysqlKeepAliveTime, DEFAULT_KEEPALIVE_INTERVAL } from '../../const/symbols.js';
import { LoggerService } from '../../logger.js';
import { Connection, Dao, SyncMode } from '../../const/types.js';
import { replacePlaceholders } from '../../string.js';

export class PostgresqlConnection implements Connection {
    [_daoConnection]: any;
    [_inTransaction] = false;
    constructor(conn: any) {
        this[_daoConnection] = conn;
    }

    execute(sync: SyncMode.Sync, sql?: string, params?: any): { affectedRows: number; insertId: bigint; };
    execute(sync: SyncMode.Async, sql?: string, params?: any): Promise<{ affectedRows: number; insertId: bigint; }>;
    execute(sync: SyncMode, sql?: string, params?: any): { affectedRows: number; insertId: bigint; } | Promise<{ affectedRows: number; insertId: bigint; }> {
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        if (!sql) { return { affectedRows: 0, insertId: 0n }; };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('Postgresql not supported sync mode');
            return { affectedRows: 0, insertId: 0n };
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<{ affectedRows: number; insertId: bigint; }> => {
            try {
                const { rowCount } = await this[_daoConnection].query({
                    text: replacePlaceholders(sql),
                    values: params
                });
                const result = rowCount as any;
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    (globalThis[_LoggerService]! as LoggerService).verbose?.(result);
                }
                return { affectedRows: rowCount || 0, insertId: 0n };
            } catch (error) {
                (globalThis[_LoggerService]! as LoggerService).error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                throw error;
            }
        })();
    }

    pluck<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    pluck<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    pluck<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('Postgresql not supported sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<T | null> => {
            try {
                const { rows } = await this[_daoConnection].query({
                    text: replacePlaceholders(sql),
                    values: params
                });
                // 修复 fall-through：原代码 if 分支 resolve 后没 return，导致 resolve(null)
                // 紧跟其后（虽然第二次 resolve 是 no-op，但写法有歧义）。
                if (rows && rows[0]) {
                    const r = Object.values(rows[0])[0];
                    return r === null ? null : r as T;
                }
                return null;
            } catch (error) {
                (globalThis[_LoggerService]! as LoggerService).error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                throw error;
            }
        })();
    }

    get<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    get<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    get<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('Postgresql not supported sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<T | null> => {
            try {
                const { rows } = await this[_daoConnection].query({
                    text: replacePlaceholders(sql),
                    values: params
                });
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    (globalThis[_LoggerService]! as LoggerService).verbose?.(rows);
                }
                if (rows && rows[0]) {
                    return rows[0] as T;
                }
                return null;
            } catch (error) {
                (globalThis[_LoggerService]! as LoggerService).error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                throw error;
            }
        })();
    }

    raw<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    raw<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    raw<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('Postgresql not supported sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<T[]> => {
            try {
                const { rows } = await this[_daoConnection].query({
                    text: replacePlaceholders(sql),
                    values: params
                });
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    (globalThis[_LoggerService]! as LoggerService).verbose?.(rows);
                }
                if (rows) {
                    return rows.map((i: any) => Object.values(i)[0]);
                }
                return [];
            } catch (error) {
                (globalThis[_LoggerService]! as LoggerService).error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                throw error;
            }
        })();
    }

    query<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    query<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    query<T = any>(sync: SyncMode, sql?: string, params?: any): T[] | Promise<T[]> {
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('Postgresql not supported sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<T[]> => {
            try {
                const { rows } = await this[_daoConnection].query({
                    text: replacePlaceholders(sql),
                    values: params
                });
                if (globalThis[_GlobalSqlOption].log === 'trace') {
                    (globalThis[_LoggerService]! as LoggerService).verbose?.(rows);
                }
                return rows;
            } catch (error) {
                (globalThis[_LoggerService]! as LoggerService).error(`
                    error: ${error},
                    sql: ${sql},
                    params: ${params}
                `);
                throw error;
            }
        })();
    }

    release(sync: SyncMode.Sync): void;
    release(sync: SyncMode.Async): Promise<void>;
    release(sync: SyncMode): Promise<void> | void {
        try {
            this[_daoConnection]?.release();
        } catch (error) {
        }
        if (sync === SyncMode.Async) {
            return Promise.resolve();
        }
    }
}
export class Postgresql implements Dao {
    [_daoDB]: any;
    private keepAliveTimer?: NodeJS.Timeout;
    private isClosing = false;
    constructor(pool: any) {
        this[_daoDB] = pool;
        this.keepAlive();
    }
    async keepAlive() {
        if (this.isClosing) return;
        let connection: Connection | null = null;
        try {
            connection = await this.createConnection(SyncMode.Async);
            if (connection) {
                await connection.query(SyncMode.Async, 'SELECT 1 FROM DUAL');
                // (globalThis[_LoggerService]! as LoggerService).debug?.('keepAlive->', data?.[0]?.[1]);
            }
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error('keepAlive error', error);
        } finally {
            if (connection) {
                await connection.release(SyncMode.Async);
            }
            if (!this.isClosing) {
                this.keepAliveTimer = setTimeout(() => this.keepAlive(), globalThis[_MysqlKeepAliveTime] ?? DEFAULT_KEEPALIVE_INTERVAL);
            }
        }
    }
    createConnection(sync: SyncMode.Sync): Connection | null;
    createConnection(sync: SyncMode.Async): Promise<Connection | null>;
    createConnection(sync: SyncMode): Connection | null | Promise<Connection | null> {
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).error('Postgresql not supported sync mode');
            return null;
        };
        return (async (): Promise<Connection> => {
            try {
                const connection = await this[_daoDB].connect();
                (globalThis[_LoggerService]! as LoggerService).debug?.('create new connection!');
                return new PostgresqlConnection(connection);
            } catch (error) {
                throw error;
            }
        })();
    }

    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    transaction<T = any>(sync: SyncMode, fn: (conn: Connection) => T | Promise<T>, conn?: Connection | null): T | null | Promise<T | null> {
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('Postgresql not supported sync mode');
            return null;
        };
        return (async (): Promise<T> => {
            let needCommit = false;
            let newConn = false;
            if (!conn) {
                conn = await this.createConnection(SyncMode.Async) ?? undefined;
                newConn = true;
            }
            if (conn?.[_inTransaction] !== true) {
                needCommit = true;
                (globalThis[_LoggerService]! as LoggerService).debug?.('beginTransaction begin!');
                await conn![_daoConnection].query('BEGIN');
                (globalThis[_LoggerService]! as LoggerService).debug?.('beginTransaction end!');
            }
            conn![_inTransaction] = true;
            try {
                const result = await fn(conn!);
                if (needCommit) {
                    (globalThis[_LoggerService]! as LoggerService).debug?.('commit begin!');
                    await conn![_daoConnection].query('COMMIT');
                    (globalThis[_LoggerService]! as LoggerService).debug?.('commit end!');
                }
                return result;
            } catch (error) {
                if (needCommit) {
                    (globalThis[_LoggerService]! as LoggerService).debug?.('rollback begin!');
                    await conn![_daoConnection].query('ROLLBACK');
                    (globalThis[_LoggerService]! as LoggerService).debug?.('rollback end!');
                }
                (globalThis[_LoggerService]! as LoggerService).error(error.message, { cause: error });
                throw error;
            } finally {
                try {
                    if (needCommit) {
                        conn![_inTransaction] = false;
                    }
                    if (newConn) {
                        (globalThis[_LoggerService]! as LoggerService).debug?.('release begin!');
                        conn![_daoConnection].release();
                        (globalThis[_LoggerService]! as LoggerService).debug?.('release end!');
                    }
                } catch (error) {
                    // 释放连接失败通常不影响业务逻辑，记录日志即可
                    (globalThis[_LoggerService]! as LoggerService).warn?.('Failed to release connection in finally block', error);
                }
            }
        })();
    }

    close(sync: SyncMode.Sync): void;
    close(sync: SyncMode.Async): Promise<void>;
    close(sync: SyncMode): Promise<void> | void {
        this.isClosing = true;
        if (this.keepAliveTimer) {
            clearTimeout(this.keepAliveTimer);
        }
        this[_daoDB]?.end();
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
