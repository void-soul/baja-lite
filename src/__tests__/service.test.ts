import { describe, it, expect, beforeAll } from 'bun:test';
import { DBType, SqlType } from 'baja-lite-field';
import { _dao, SyncMode, TemplateResult } from '../../.test-build/const/index.js';
import { DeclareService, SqlService } from '../../.test-build/db/service.js';
import { setupGlobals, declareModel } from './helpers.js';

// 用 @Field 装饰器声明模型，使 Reflect 元数据被记录（DB 装饰器据此读取 _ids/_fields）。
class User {
    id?: number;
    name?: string;
    age?: number;
}
declareModel(User, [
    { prop: 'id', type: SqlType.int, id: true },
    { prop: 'name', type: SqlType.string, len: 64 },
    { prop: 'age', type: SqlType.int },
]);

class UserService extends SqlService<User> {}
const WrappedUserService = DeclareService(UserService, {
    tableName: 'user',
    clz: User,
    dbType: DBType.Sqlite,
    dbName: 'test_db',
});

describe('SqlService 数据库操作', () => {
    let dao: any;
    beforeAll(() => {
        setupGlobals();
        const g: any = globalThis;
        dao = g[_dao][DBType.Sqlite]['test_db'];
    });

    it('insert 生成 INSERT 语句', () => {
        dao.allSqls.length = 0;
        dao.lastParams.length = 0;
        const svc = new WrappedUserService();
        svc.insert({ data: { name: 'alice', age: 30 }, sync: SyncMode.Sync });
        expect(dao.allSqls.some((s: string) => /insert\s+into\s+user/i.test(s))).toBe(true);
    });

    it('update 生成 UPDATE 语句', () => {
        dao.allSqls.length = 0;
        dao.lastParams.length = 0;
        const svc = new WrappedUserService();
        // update 要求 id 字段必须包含在 data 中
        svc.update({ data: { id: 1, name: 'bob' }, sync: SyncMode.Sync });
        expect(dao.allSqls.some((s: string) => /update\s+user/i.test(s))).toBe(true);
    });

    it('delete 生成 DELETE 语句', () => {
        dao.allSqls.length = 0;
        dao.lastParams.length = 0;
        const svc = new WrappedUserService();
        svc.delete({ id: 5, sync: SyncMode.Sync });
        expect(dao.allSqls.some((s: string) => /delete\s+from\s+user/i.test(s))).toBe(true);
    });

    it('template 生成主键查询', () => {
        dao.allSqls.length = 0;
        dao.lastParams.length = 0;
        const svc = new WrappedUserService();
        svc.template({ id: 9, templateResult: TemplateResult.NotSureOne, sync: SyncMode.Sync });
        expect(dao.allSqls.some((s: string) => /from\s+user/i.test(s))).toBe(true);
    });

    it('excute 执行原生 SQL', () => {
        dao.allSqls.length = 0;
        dao.lastParams.length = 0;
        const svc = new WrappedUserService();
        const affected = svc.excute({ sql: 'select 1', params: [], sync: SyncMode.Sync });
        expect(affected).toBeDefined();
        expect(dao.lastSql.toLowerCase().replace(/\s+/g, ' ').includes('select 1')).toBe(true);
    });
});
