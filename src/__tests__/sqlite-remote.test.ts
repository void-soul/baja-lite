import { describe, it, expect, beforeAll } from 'bun:test';
import { SyncMode } from '../../.test-build/const/index.js';
import { SqliteRemote } from '../../.test-build/db/dao/sqlite-remote.js';
import { encode } from '@msgpack/msgpack';
import { extensionCodec } from '../../.test-build/db/dao/sqlite-remote.js';
import { setupGlobals } from './helpers.js';

describe('SqliteRemote 远程 DAO', () => {
    let conn: any;
    beforeAll(async () => {
        setupGlobals();
        const fakeInterface = {
            execute: (buf: any) => encode({ affectedRows: 2, insertId: 5 }, { extensionCodec }),
            query: (buf: any) => encode([{ a: 1 }, { b: 2 }], { extensionCodec }),
            get: (buf: any) => encode({ x: 9 }, { extensionCodec }),
            pluck: (buf: any) => encode(42, { extensionCodec }),
            raw: (buf: any) => encode([1, 2, 3], { extensionCodec }),
            close: () => Promise.resolve(),
            export: () => Promise.resolve(),
            restore: () => Promise.resolve(),
        };
        const remote = new SqliteRemote(fakeInterface as any, 'db1');
        conn = await remote.createConnection(SyncMode.Async);
    });

    it('execute 返回 {affectedRows, insertId}', async () => {
        const e = await conn.execute(SyncMode.Async, 'insert ...', [1, 2]);
        expect(e.affectedRows).toBe(2);
        expect(Number(e.insertId)).toBe(5);
    });
    it('query 返回结果数组', async () => {
        const r = await conn.query(SyncMode.Async, 'select ...', []);
        expect(r).toEqual([{ a: 1 }, { b: 2 }]);
    });
    it('pluck 返回标量', async () => {
        const v = await conn.pluck(SyncMode.Async, 'select ...', []);
        expect(v).toBe(42);
    });
    it('get 返回单行', async () => {
        const v = await conn.get(SyncMode.Async, 'select ...', []);
        expect(v).toEqual({ x: 9 });
    });
    it('raw 返回原始数组', async () => {
        const v = await conn.raw(SyncMode.Async, 'select ...', []);
        expect(v).toEqual([1, 2, 3]);
    });
});
