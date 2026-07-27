import { describe, it, expect, beforeAll } from 'bun:test';
import { encode, decode } from '@msgpack/msgpack';
import { SqliteRemoteClass } from '../../.test-build/sqlite.js';
import { extensionCodec } from '../../.test-build/db/index.js';
import { setupGlobals } from './helpers.js';

class FakeBetterSqlite3 {
    constructor(_storeName?: string, _options?: any) { }
    pragma(_s: string) { }
    exec(_s: string) { }
    function(_name: string, _opts: any, _fn: any) { }
    prepare(_sql: string) {
        const self: any = {
            run: (_p: any) => ({ changes: 1, lastInsertRowid: 5 }),
            all: (_p: any) => [{ a: 1 }],
            get: (_p: any) => ({ x: 1 }),
            // better-sqlite3 的 Statement.pluck()/raw() 返回自身以支持链式调用
            pluck: () => self,
            raw: () => self,
        };
        return self;
    }
}

// SqliteRemoteClass 为抽象类，必须提供抽象成员的具体实现才能实例化。
class TestRemote extends SqliteRemoteClass {
    getStoreName(dbName: string) { return `:memory:${dbName}`; }
    getBackName(dbName: string) { return `:back:${dbName}`; }
    BetterSqlite3 = FakeBetterSqlite3;
    cpSync() { }
    setMod() { }
    trace = false;
}

describe('SqliteRemoteClass 服务端桥接', () => {
    let r: any;
    beforeAll(() => {
        setupGlobals();
        r = new TestRemote();
        r.initDB('db1');
    });

    it('execute 编码执行结果', async () => {
        const out = await r.execute(encode(['db1', 'insert into t values (?)', [1]]));
        const decoded = decode(out, { extensionCodec });
        expect(decoded.affectedRows).toBe(1);
        expect(decoded.insertId).toBe(5n);
    });
    it('query 编码查询结果', async () => {
        const out = await r.query(encode(['db1', 'select * from t', []]));
        const decoded = decode(out, { extensionCodec });
        expect(decoded).toEqual([{ a: 1 }]);
    });
    it('get 编码单行结果', async () => {
        const out = await r.get(encode(['db1', 'select * from t', []]));
        const decoded = decode(out, { extensionCodec });
        expect(decoded).toEqual({ x: 1 });
    });
    it('pluck 编码标量结果', async () => {
        const out = await r.pluck(encode(['db1', 'select c from t', []]));
        const decoded = decode(out, { extensionCodec });
        // 注意：fake 的 pluck().get() 返回整行，这里验证服务端正确编码/解码往返
        expect(decoded).toEqual({ x: 1 });
    });
    it('raw 编码原始结果', async () => {
        const out = await r.raw(encode(['db1', 'select c from t', []]));
        const decoded = decode(out, { extensionCodec });
        expect(decoded).toEqual([{ a: 1 }]);
    });
});
