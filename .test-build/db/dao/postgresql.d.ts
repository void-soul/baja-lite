import { _daoConnection, _daoDB, _inTransaction } from '../../const/symbols.js';
import { Connection, Dao, SyncMode } from '../../const/types.js';
export declare class PostgresqlConnection implements Connection {
    [_daoConnection]: any;
    [_inTransaction]: boolean;
    constructor(conn: any);
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
export declare class Postgresql implements Dao {
    [_daoDB]: any;
    private keepAliveTimer?;
    private isClosing;
    constructor(pool: any);
    keepAlive(): Promise<void>;
    createConnection(sync: SyncMode.Sync): Connection | null;
    createConnection(sync: SyncMode.Async): Promise<Connection | null>;
    transaction<T = any>(sync: SyncMode.Sync, fn: (conn: Connection) => T, conn?: Connection | null): T | null;
    transaction<T = any>(sync: SyncMode.Async, fn: (conn: Connection) => Promise<T>, conn?: Connection | null): Promise<T | null>;
    close(sync: SyncMode.Sync): void;
    close(sync: SyncMode.Async): Promise<void>;
    backup(sync: SyncMode.Sync, name: string): void;
    backup(sync: SyncMode.Async, name: string): Promise<void>;
    remove(sync: SyncMode.Sync): void;
    remove(sync: SyncMode.Async): Promise<void>;
    restore(sync: SyncMode.Sync, name: string): void;
    restore(sync: SyncMode.Async, name: string): Promise<void>;
}
