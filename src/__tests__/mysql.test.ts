import { describe, it, expect, beforeAll } from 'bun:test';
import { SyncMode } from '../../.test-build/const/index.js';
import { Mysql } from '../../.test-build/db/dao/mysql.js';
import { setupGlobals } from './helpers.js';

describe('Mysql DAO', () => {
    let m: any;
    beforeAll(() => {
        setupGlobals();
        const fakeMysqlConn = {
            execute: (_sql: string, _p: any) => Promise.resolve([{ affectedRows: 1, insertId: 0 }, {}]),
            query: (_sql: string, _p: any) => Promise.resolve([[{ affectedRows: 1, insertId: 0 }], {}]),
            beginTransaction: () => Promise.resolve(),
            commit: () => Promise.resolve(),
            rollback: () => Promise.resolve(),
            release: () => Promise.resolve(),
        };
        const fakePool = { getConnection: () => Promise.resolve(fakeMysqlConn) };
        m = new Mysql(fakePool as any);
    });

    it('同步 createConnection/transaction 返回 null', () => {
        expect(m.createConnection(SyncMode.Sync)).toBeNull();
        expect(m.transaction(SyncMode.Sync, async () => {})).toBeNull();
    });

    it('异步创建连接并执行查询', async () => {
        const conn = await m.createConnection(SyncMode.Async);
        expect(conn).toBeDefined();
        const res = await conn.query(SyncMode.Async, 'select 1', []);
        expect(res).toEqual([{ affectedRows: 1, insertId: 0 }]);
        const exec = await conn.execute(SyncMode.Async, 'insert ...', []);
        expect(exec).toEqual({ affectedRows: 1, insertId: 0 });
    });

    it('异步事务执行回调', async () => {
        const res = await m.transaction(SyncMode.Async, (c: any) => c.query(SyncMode.Async, 'select 1', []));
        expect(res).toEqual([{ affectedRows: 1, insertId: 0 }]);
    });
});
