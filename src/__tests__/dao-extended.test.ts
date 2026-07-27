import { describe, it, expect, beforeEach } from 'bun:test';
import { _LoggerService, _daoConnection, _daoDB, _inTransaction } from '../../.test-build/const/symbols.js';
import { PrinterLogger } from '../../.test-build/logger.js';
import { SqliteConnection, Sqlite } from '../../.test-build/db/dao/sqlite.js';
import { MysqlConnection, Mysql } from '../../.test-build/db/dao/mysql.js';
import { PostgresqlConnection, Postgresql } from '../../.test-build/db/dao/postgresql.js';
import { SqliteRemote } from '../../.test-build/db/dao/sqlite-remote.js';
import { SyncMode } from '../../.test-build/const/types.js';

beforeEach(() => {
    (globalThis as any)[_LoggerService] = new PrinterLogger();
});

/** 创建模拟的 better-sqlite3 数据库对象 */
function createFakeDb() {
    const data: Record<string, any> = {
        DUAL: [{ ______id: 1 }],
    };
    return {
        pragma: (_s: string) => {},
        exec: (_s: string) => {},
        function: (_name: string, _opts: any, _fn: any) => {},
        prepare: (sql: string) => {
            if (sql.includes('INVALID') || sql.includes('ERROR')) {
                throw new Error('SQL syntax error');
            }
            return {
                run: (..._args: any[]) => ({ changes: 1, lastInsertRowid: 1 }),
                get: (..._args: any[]) => ({ id: 1, name: 'test' }),
                all: (..._args: any[]) => [{ id: 1, name: 'test' }],
                raw: (_mode: boolean) => ({
                    all: (..._args: any[]) => [[1], [2]] }),
                pluck: (_mode: boolean) => ({
                    get: (..._args: any[]) => 1,
                    all: (..._args: any[]) => [1, 2] }),
            };
        },
        close: () => {},
        backup: async (_path: string) => ({ status: 'ok' }),
        loadExtension: (_path: string) => {},
    };
}

describe('DAO 扩展测试', () => {
    describe('SqliteConnection 错误路径', () => {
        it('execute 错误时抛出异常', () => {
            const conn = new SqliteConnection(createFakeDb());
            expect(() => conn.execute(SyncMode.Sync, 'INVALID SQL')).toThrow();
        });

        it('pluck 错误时抛出异常', () => {
            const conn = new SqliteConnection(createFakeDb());
            expect(() => conn.pluck(SyncMode.Sync, 'ERROR SQL')).toThrow();
        });

        it('get 错误时抛出异常', () => {
            const conn = new SqliteConnection(createFakeDb());
            expect(() => conn.get(SyncMode.Sync, 'INVALID')).toThrow();
        });

        it('raw 错误时抛出异常', () => {
            const conn = new SqliteConnection(createFakeDb());
            expect(() => conn.raw(SyncMode.Sync, 'ERROR')).toThrow();
        });

        it('query 错误时抛出异常', () => {
            const conn = new SqliteConnection(createFakeDb());
            expect(() => conn.query(SyncMode.Sync, 'INVALID')).toThrow();
        });
    });

    describe('Sqlite DAO 扩展', () => {
        it('close 同步', () => {
            const db = createFakeDb();
            const dao = new Sqlite(db);
            expect(() => dao.close(SyncMode.Sync)).not.toThrow();
        });

        it('backup 同步不抛异常', () => {
            const db = createFakeDb();
            const dao = new Sqlite(db);
            expect(() => dao.backup(SyncMode.Sync, '/tmp/backup.db')).not.toThrow();
        });

        it('remove 同步', () => {
            const db = createFakeDb();
            const dao = new Sqlite(db);
            expect(() => dao.remove(SyncMode.Sync)).not.toThrow();
        });

        it('restore 同步不抛异常', () => {
            const db = createFakeDb();
            const dao = new Sqlite(db);
            expect(() => dao.restore(SyncMode.Sync, '/tmp/backup.db')).not.toThrow();
        });
    });

    describe('MysqlConnection 基础', () => {
        it('可实例化', () => {
            const conn = new MysqlConnection({ execute: async () => [[]], query: async () => [[]] });
            expect(conn).toBeDefined();
        });

        it('execute 异步返回结果', async () => {
            const conn = new MysqlConnection({
                execute: async (_sql: string, _params: any) => [{ affectedRows: 1, insertId: 42n }],
            });
            const result = await conn.execute(SyncMode.Async, 'INSERT INTO t VALUES (1)');
            expect(result.affectedRows).toBe(1);
            expect(result.insertId).toBe(42n);
        });

        it('pluck 异步返回结果', async () => {
            const conn = new MysqlConnection({
                query: async (_sql: string, _params: any) => [[{ val: 99 }]],
            });
            const result = await conn.pluck(SyncMode.Async, 'SELECT val FROM t');
            expect(result).toBe(99);
        });

        it('get 异步返回结果', async () => {
            const conn = new MysqlConnection({
                query: async (_sql: string, _params: any) => [[{ id: 1, name: 'test' }]],
            });
            const result = await conn.get(SyncMode.Async, 'SELECT * FROM t');
            expect(result).toEqual({ id: 1, name: 'test' });
        });

        it('sync 模式返回警告', () => {
            const conn = new MysqlConnection({});
            const result = conn.execute(SyncMode.Sync, 'SELECT 1');
            expect(result).toEqual({ affectedRows: 0, insertId: 0n });
        });
    });

    describe('Mysql DAO 基础', () => {
        it('可实例化', () => {
            const pool = { getConnection: async () => ({ execute: async () => [[]], query: async () => [[]], release: () => {} }) };
            const dao = new Mysql(pool);
            expect(dao).toBeDefined();
        });
    });

    describe('PostgresqlConnection 基础', () => {
        it('可实例化', () => {
            const conn = new PostgresqlConnection({ query: async () => ({ rows: [] }) });
            expect(conn).toBeDefined();
        });

        it('execute 异步返回结果', async () => {
            const conn = new PostgresqlConnection({
                query: async (_sql: string, _params: any) => ({ rows: [{ id: 1 }], rowCount: 1 }),
            });
            const result = await conn.execute(SyncMode.Async, 'INSERT INTO t VALUES (1)');
            expect(result.affectedRows).toBe(1);
        });

        it('get 异步返回结果', async () => {
            const conn = new PostgresqlConnection({
                query: async (_sql: string, _params: any) => ({ rows: [{ id: 1, name: 'test' }] }),
            });
            const result = await conn.get(SyncMode.Async, 'SELECT * FROM t');
            expect(result).toEqual({ id: 1, name: 'test' });
        });
    });

    describe('Postgresql DAO 基础', () => {
        it('可实例化', () => {
            const pool = { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) };
            const dao = new Postgresql(pool);
            expect(dao).toBeDefined();
        });
    });

    describe('SqliteRemote 基础', () => {
        it('createConnection 同步返回 null', () => {
            const dao = new SqliteRemote('http://localhost:3000');
            const result = dao.createConnection(SyncMode.Sync);
            expect(result).toBeNull();
        });

        it('transaction 返回 null', () => {
            const dao = new SqliteRemote('http://localhost:3000');
            const result = dao.transaction(SyncMode.Sync, () => {});
            expect(result).toBeNull();
        });

        it('close 同步不抛异常', () => {
            const dao = new SqliteRemote('http://localhost:3000');
            expect(() => dao.close(SyncMode.Sync)).not.toThrow();
        });

        it('backup 同步不抛异常', () => {
            const dao = new SqliteRemote('http://localhost:3000');
            expect(() => dao.backup(SyncMode.Sync, '/tmp/backup.db')).not.toThrow();
        });

        it('remove 同步不抛异常', () => {
            const dao = new SqliteRemote('http://localhost:3000');
            expect(() => dao.remove(SyncMode.Sync)).not.toThrow();
        });

        it('restore 同步不抛异常', () => {
            const dao = new SqliteRemote('http://localhost:3000');
            expect(() => dao.restore(SyncMode.Sync, '/tmp/backup.db')).not.toThrow();
        });
    });
});
