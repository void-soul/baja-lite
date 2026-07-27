import { describe, it, expect, beforeAll } from 'bun:test';
import { DBType, SqlType } from 'baja-lite-field';
import { _dao, SyncMode } from '../../.test-build/const/index.js';
import { DeclareService, SqlService, StreamQuery } from '../../.test-build/db/service.js';
import { setupGlobals, declareModel } from './helpers.js';

class User {
    id!: number;
    name!: string;
    age!: number;
}
declareModel(User, [
    { prop: 'id', type: SqlType.int, id: true },
    { prop: 'name', type: SqlType.string },
    { prop: 'age', type: SqlType.int },
]);
class UserService extends SqlService<User> {}
const WrappedUserService = DeclareService(UserService, { tableName: 'user', clz: User, dbType: DBType.Sqlite, dbName: 'test_db' }) as any;

describe('stream-query', () => {
    let dao: any;
    beforeAll(() => {
        setupGlobals();
        dao = (globalThis as any)[_dao][DBType.Sqlite]['test_db'];
    });

    it('where + select 生成带 WHERE 的 SQL', () => {
        const svc = new WrappedUserService();
        const q = svc.stream();
        q.where('user.name = :name', { name: 'bob' }).select('name');
        q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
        expect(dao.lastSql).toContain('WHERE');
        expect(dao.lastSql).toContain('name');
        expect(dao.lastSql).toContain('user');
    });
    it('limit 生成 LIMIT', () => {
        dao.allSqls.length = 0;
        const svc = new WrappedUserService();
        const q = svc.stream();
        q.select('name').limit(0, 10);
        q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
        expect(dao.lastSql.toUpperCase()).toContain('LIMIT');
    });
    it('groupBy 生成 GROUP BY', () => {
        dao.allSqls.length = 0;
        const svc = new WrappedUserService();
        const q = svc.stream();
        q.select('name').groupBy('age');
        q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
        expect(dao.lastSql.toUpperCase()).toContain('GROUP BY');
    });
});
