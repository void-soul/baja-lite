import { describe, it, expect, beforeAll } from 'bun:test';
import { SyncMode } from '../../.test-build/const/index.js';
import { Sqlite } from '../../.test-build/db/dao/sqlite.js';
import { setupGlobals } from './helpers.js';

function makeFakeDb() {
    const stmt = () => ({
        run: (_p?: any) => ({ changes: 1, lastInsertRowid: 5 }),
        all: (_p?: any) => [{ a: 1 }],
        get: (_p?: any) => ({ x: 1 }),
        pluck: (_p?: any) => 1,
        raw: (_p?: any) => [1, 2],
    });
    return {
        pragma: (_s: string) => {},
        exec: (_s: string) => {},
        function: (_name: string, _opts: any, _fn: any) => {},
        prepare: (_sql: string) => stmt(),
        // 注意：必须返回 cb 本身（函数），而不是 cb() 的结果，
        // 因为 Sqlite.transaction 内部会再执行一次 `()` 调用。
        transaction: (cb: any) => cb,
        backup: (_n: string) => {},
        close: () => {},
        remove: () => {},
        restore: () => {},
    };
}

describe('Sqlite DAO', () => {
    let sqlite: any;
    beforeAll(() => {
        setupGlobals();
        sqlite = new Sqlite(makeFakeDb() as any);
    });

    it('构造并注册内置 SQL 函数', () => {
        expect(sqlite).toBeDefined();
    });
    it('createConnection 返回连接', () => {
        const conn = sqlite.createConnection(SyncMode.Sync);
        expect(conn).toBeDefined();
    });
    it('transaction 执行函数并返回受影响行数', () => {
        const result = sqlite.transaction(SyncMode.Sync, (c: any) => c.execute(SyncMode.Sync, 'select 1', []));
        expect(result.affectedRows).toBe(1);
    });
    it('close/backup/remove/restore 不抛错', () => {
        expect(() => sqlite.close(SyncMode.Sync)).not.toThrow();
        expect(() => sqlite.backup(SyncMode.Sync, 'bak')).not.toThrow();
        expect(() => sqlite.remove('x')).not.toThrow();
        expect(() => sqlite.restore('x')).not.toThrow();
    });
});
