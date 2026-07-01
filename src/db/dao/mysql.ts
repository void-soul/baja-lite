import { _daoConnection, _daoDB, _GlobalSqlOption, _inTransaction, _LoggerService, _MysqlKeepAliveTime, DEFAULT_KEEPALIVE_INTERVAL } from '../../const/symbols.js';
import { LoggerService } from '../../logger.js';
import { Connection, Dao, SyncMode } from '../../const/types.js';

export class MysqlConnection implements Connection {
    [_daoConnection]: any;
    [_inTransaction] = false;
    constructor(conn: any) {
        this[_daoConnection] = conn;
    }

    execute(sync: SyncMode.Sync, sql?: string, params?: any): { affectedRows: number; insertId: bigint; };
    execute(sync: SyncMode.Async, sql?: string, params?: any): Promise<{ affectedRows: number; insertId: bigint; }>;
    execute(sync: SyncMode, sql?: string, params?: any): { affectedRows: number; insertId: bigint; } | Promise<{ affectedRows: number; insertId: bigint; }> {
        (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
        if (!sql) { return { affectedRows: 0, insertId: 0n }; };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('MYSQL not supported sync mode');
            return { affectedRows: 0, insertId: 0n };
        };
        return (async (): Promise<{ affectedRows: number; insertId: bigint; }> => {
            try {
                const [_result] = await this[_daoConnection].execute(sql, params);
                const result = _result as any;
                return { affectedRows: result.affectedRows, insertId: result.insertId };
            } catch (error) {
                (globalThis[_LoggerService]! as LoggerService).error(error.message, { cause: error });
                throw error;
            }
        })();
    }

    pluck<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    pluck<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    pluck<T = any>(sync: SyncMode, sql?: string, params?: any): T | null | Promise<T | null> {
        (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('MYSQL not supported sync mode');
            return null;
        };
        return (async (): Promise<T | null> => {
            try {
                const [result] = await this[_daoConnection].query(sql, params);
                if (result && result[0]) {
                    const r = Object.values(result[0])[0];
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
        (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
        if (!sql) { return null };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('MYSQL not supported sync mode');
            return null;
        };
        return (async (): Promise<T | null> => {
            try {
                const [result] = await this[_daoConnection].query(sql, params);
                if (result && result[0]) {
                    return result[0] as T;
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
        (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('MYSQL not supported sync mode');
            return [];
        };
        return (async (): Promise<T[]> => {
            try {
                const [result] = await this[_daoConnection].query(sql, params);
                // 修复 fall-through：原代码 `if (result) resolve(...); resolve([])` 第二行
                // 是 no-op，但写法埋雷。
                if (result) {
                    return result.map((i: any) => Object.values(i)[0]);
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
        (globalThis[_LoggerService]! as any).debugCategory?.('sql', sql, params ?? '');
        if (!sql) { return []; };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('MYSQL not supported sync mode');
            return [];
        };
        return (async (): Promise<T[]> => {
            try {
                const [result] = await this[_daoConnection].query(sql, params);
                return result;
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
export class Mysql implements Dao {
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
                // (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'keepAlive->', data?.[0]?.[1]);
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
            (globalThis[_LoggerService]! as LoggerService).error('MYSQL not supported sync mode');
            return null;
        };
        return (async (): Promise<Connection> => {
            try {
                const connection = await this[_daoDB].getConnection();
                (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'create new connection!');
                return new MysqlConnection(connection);
            } catch (error) {
                (globalThis[_LoggerService]! as LoggerService).error(error.message, { cause: error });
                throw error;
            }
        })();
    }

    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    transaction<T = any>(sync: SyncMode, fn: (conn: Connection) => T | Promise<T>, conn?: Connection | null): T | null | Promise<T | null> {
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('MYSQL not supported sync mode');
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
                (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'beginTransaction begin!');
                await conn![_daoConnection].beginTransaction();
                (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'beginTransaction end!');
            }
            conn![_inTransaction] = true;
            try {
                const result = await fn(conn!);
                if (needCommit) {
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'commit begin!');
                    await conn![_daoConnection].commit();
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'commit end!');
                }
                return result;
            } catch (error) {
                if (needCommit) {
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'rollback begin!');
                    await conn![_daoConnection].rollback();
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'rollback end!');
                }
                (globalThis[_LoggerService]! as LoggerService).error(error.message, { cause: error });
                throw error;
            } finally {
                try {
                    if (needCommit) {
                        conn![_inTransaction] = false;
                    }
                    if (newConn) {
                        (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'release begin!');
                        conn![_daoConnection].release();
                        (globalThis[_LoggerService]! as any).debugCategory?.('sql', 'release end!');
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
        return this[_daoDB]?.destroy();
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
