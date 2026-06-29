import { decode, DecodeError, encode, ExtensionCodec } from "@msgpack/msgpack";
import { _daoConnection, _daoDB, _GlobalSqlOption, _inTransaction, _LoggerService, _sqliteRemoteName } from '../../const/symbols.js';
import { LoggerService } from '../../logger.js';
import { Connection, Dao, SqliteRemoteInterface, SyncMode } from '../../const/types.js';

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
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        if (!sql) { return { affectedRows: 0, insertId: 0n }; };
        if (sync === SyncMode.Sync) {
            (globalThis[_LoggerService]! as LoggerService).warn('SqliteRemote not supported sync mode');
            return { affectedRows: 0, insertId: 0n };
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<{ affectedRows: number; insertId: bigint; }> => {
            try {
                const data = await this[_daoConnection].execute(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                const { affectedRows, insertId } = decode(data, { extensionCodec }) as { affectedRows: number; insertId: bigint; };
                return { affectedRows, insertId: insertId ? BigInt(insertId) : 0n };
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
            (globalThis[_LoggerService]! as LoggerService).warn('SqliteRemote not supported sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<T | null> => {
            try {
                const data = await this[_daoConnection].pluck(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                return decode(data, { extensionCodec }) as T;
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
            (globalThis[_LoggerService]! as LoggerService).warn('SqliteRemote not supported sync mode');
            return null;
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<T | null> => {
            try {
                const data = await this[_daoConnection].get(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                return decode(data, { extensionCodec }) as T;
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
            (globalThis[_LoggerService]! as LoggerService).warn('SqliteRemote not supported sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<T[]> => {
            try {
                const data = await this[_daoConnection].raw(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                return decode(data, { extensionCodec }) as T[];
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
            (globalThis[_LoggerService]! as LoggerService).warn('SqliteRemote not supported sync mode');
            return [];
        };
        if (globalThis[_GlobalSqlOption].log === 'trace') {
            (globalThis[_LoggerService]! as LoggerService).verbose?.(`${sql}\n,${JSON.stringify(params ?? '')}`);
        }
        return (async (): Promise<T[]> => {
            try {
                const data = await this[_daoConnection].query(encode([this[_sqliteRemoteName], sql, params], { extensionCodec }));
                return decode(data, { extensionCodec }) as T[];
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
            (globalThis[_LoggerService]! as LoggerService).error('SQLITEREMOTE not supported sync mode');
            return null;
        };
        if (!this.connection) {
            this.connection = new SqliteRemoteConnection(this[_daoDB], this[_sqliteRemoteName]);
        }
        return Promise.resolve(this.connection);
    }

    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    transaction<T = any>(sync: SyncMode, fn: (conn: Connection) => T | Promise<T>, conn?: Connection | null): T | null | Promise<T | null> {
        (globalThis[_LoggerService]! as LoggerService).warn(`SQLITEREMOTE not supported transaction`);
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
