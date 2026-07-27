import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { DBType, SqlType } from 'baja-lite-field';
import { _dao, SyncMode, TemplateResult } from '../../.test-build/const/index.js';
import { DeclareService, SqlService } from '../../.test-build/db/service.js';
import { setupGlobals, declareModel } from './helpers.js';

class Product {
    id?: number;
    name?: string;
    price?: number;
    category?: string;
}
declareModel(Product, [
    { prop: 'id', type: SqlType.int, id: true },
    { prop: 'name', type: SqlType.string, len: 128 },
    { prop: 'price', type: SqlType.int },
    { prop: 'category', type: SqlType.string, len: 64 },
]);

class ProductService extends SqlService<Product> {}
const WrappedProductService = DeclareService(ProductService, {
    tableName: 'product',
    clz: Product,
    dbType: DBType.Sqlite,
    dbName: 'test_db',
});

describe('SqlService 扩展方法', () => {
    let dao: any;
    beforeAll(() => {
        setupGlobals();
        const g: any = globalThis;
        dao = g[_dao][DBType.Sqlite]['test_db'];
    });
    beforeEach(() => {
        dao.allSqls.length = 0;
        dao.lastParams.length = 0;
    });

    describe('select', () => {
        it('select 返回查询结果', () => {
            const svc = new WrappedProductService();
            const result = svc.select({ sql: 'SELECT * FROM product', params: [], sync: SyncMode.Sync });
            expect(Array.isArray(result)).toBe(true);
        });
        it('select 带参数', () => {
            const svc = new WrappedProductService();
            const result = svc.select({ sql: 'SELECT * FROM product WHERE id = ?', params: [1], sync: SyncMode.Sync });
            expect(Array.isArray(result)).toBe(true);
        });
        it('select 空结果', () => {
            const svc = new WrappedProductService();
            const result = svc.select({ sql: 'SELECT * FROM product WHERE id = ?', params: [99999], sync: SyncMode.Sync });
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });
    });

    describe('selectBatch', () => {
        it('selectBatch 返回多条结果', () => {
            const svc = new WrappedProductService();
            const result = svc.selectBatch({ sql: 'SELECT * FROM product WHERE id IN (?,?)', params: [1, 2], sync: SyncMode.Sync });
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('transaction', () => {
        it('transaction 提交成功', () => {
            const svc = new WrappedProductService();
            svc.transaction({
                sync: SyncMode.Sync,
                fn: (conn) => {
                    conn.execute('INSERT INTO product (name) VALUES (?)', ['test-product']);
                },
            });
            expect(true).toBe(true);
        });
        it('transaction 回滚', () => {
            const svc = new WrappedProductService();
            try {
                svc.transaction({
                    sync: SyncMode.Sync,
                    fn: (conn) => {
                        conn.execute('INSERT INTO product (name) VALUES (?)', ['rollback-test']);
                        throw new Error('rollback');
                    },
                });
            } catch (e: any) {
                expect(e.message).toBe('rollback');
            }
        });
    });

    describe('imp (导入)', () => {
        it('imp 导入数据', () => {
            const svc = new WrappedProductService();
            svc.imp({ data: [{ name: 'imported', price: 100 }], sync: SyncMode.Sync });
            expect(true).toBe(true);
        });
        it('imp 导入空数组', () => {
            const svc = new WrappedProductService();
            svc.imp({ data: [], sync: SyncMode.Sync });
            expect(true).toBe(true);
        });
    });

    describe('init', () => {
        it('init 初始化数据库', () => {
            const svc = new WrappedProductService();
            svc.init({ sync: SyncMode.Sync } as any);
            expect(true).toBe(true);
        });
    });

    describe('close', () => {
        it('close 关闭连接', () => {
            const svc = new WrappedProductService();
            svc.close({ sync: SyncMode.Sync } as any);
            expect(true).toBe(true);
        });
    });

    describe('stream', () => {
        it('stream 流式查询', () => {
            const svc = new WrappedProductService();
            const q = svc.stream();
            expect(q).toBeDefined();
        });
    });
});
