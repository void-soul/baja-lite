import { describe, it, expect, beforeAll } from 'bun:test';
import { SyncMode } from '../../.test-build/const/index.js';
import { Postgresql } from '../../.test-build/db/dao/postgresql.js';
import { setupGlobals } from './helpers.js';

describe('Postgresql DAO', () => {
    let p: any;
    beforeAll(() => {
        setupGlobals();
        const fakePgClient = {
            query: (_arg: any) => Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 }),
        };
        const fakePool = { connect: () => Promise.resolve(fakePgClient) };
        p = new Postgresql(fakePool as any);
    });

    it('同步 createConnection/transaction 返回 null', () => {
        expect(p.createConnection(SyncMode.Sync)).toBeNull();
        expect(p.transaction(SyncMode.Sync, async () => {})).toBeNull();
    });

    it('异步创建连接并查询', async () => {
        const conn = await p.createConnection(SyncMode.Async);
        expect(conn).toBeDefined();
        const res = await conn.query(SyncMode.Async, 'select 1', []);
        expect(res).toEqual([{ id: 1 }]);
    });

    it('异步事务执行回调', async () => {
        const res = await p.transaction(SyncMode.Async, (c: any) => c.query(SyncMode.Async, 'select 1', []));
        expect(res).toEqual([{ id: 1 }]);
    });
});
