import { ExtensionCodec } from "@msgpack/msgpack";
import { _daoConnection, _daoDB, _inTransaction, _sqliteRemoteName } from '../../const/symbols.js';
import { Connection, Dao, SqliteRemoteInterface, SyncMode } from '../../const/types.js';
export declare const extensionCodec: ExtensionCodec<undefined>;
export declare class SqliteRemoteConnection implements Connection {
    [_daoConnection]: SqliteRemoteInterface;
    [_sqliteRemoteName]: string;
    [_inTransaction]: boolean;
    constructor(conn: SqliteRemoteInterface, name: string);
    execute(sync: SyncMode.Sync, sql?: string, params?: any): {
        affectedRows: number;
        insertId: bigint;
    };
    execute(sync: SyncMode.Async, sql?: string, params?: any): Promise<{
        affectedRows: number;
        insertId: bigint;
    }>;
    pluck<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    pluck<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    get<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T | null;
    get<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T | null>;
    raw<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    raw<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    query<T = any>(sync: SyncMode.Sync, sql?: string, params?: any): T[];
    query<T = any>(sync: SyncMode.Async, sql?: string, params?: any): Promise<T[]>;
    release(sync: SyncMode.Sync): void;
    release(sync: SyncMode.Async): Promise<void>;
}
export declare class SqliteRemote implements Dao {
    [_sqliteRemoteName]: string;
    [_daoDB]: SqliteRemoteInterface;
    private connection?;
    constructor(db: SqliteRemoteInterface, name: string);
    createConnection(sync: SyncMode.Sync): Connection | null;
    createConnection(sync: SyncMode.Async): Promise<Connection | null>;
    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    close(sync: SyncMode.Sync): void;
    close(sync: SyncMode.Async): Promise<void>;
    backup(sync: SyncMode.Sync, exportPath: string): void;
    backup(sync: SyncMode.Async, exportPath: string): Promise<void>;
    remove(sync: SyncMode.Sync): void;
    remove(sync: SyncMode.Async): Promise<void>;
    restore(sync: SyncMode.Sync, importPath: string): void;
    restore(sync: SyncMode.Async, importPath: string): Promise<void>;
}
