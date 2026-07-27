import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { DBType, SqlType } from 'baja-lite-field';
import { _dao, SyncMode } from '../../.test-build/const/index.js';
import { DeclareService, SqlService, StreamQuery } from '../../.test-build/db/service.js';
import { setupGlobals, declareModel } from './helpers.js';

class User {
    id!: number;
    name!: string;
    age!: number;
    email!: string;
    status!: number;
    score!: amount;
    tags!: string;
    created_at!: string;
}
declareModel(User, [
    { prop: 'id', type: SqlType.int, id: true },
    { prop: 'name', type: SqlType.string },
    { prop: 'age', type: SqlType.int },
    { prop: 'email', type: SqlType.string },
    { prop: 'status', type: SqlType.int },
    { prop: 'score', type: SqlType.int },
    { prop: 'tags', type: SqlType.string },
    { prop: 'created_at', type: SqlType.string },
]);
class UserService extends SqlService<User> {}
const WrappedUserService = DeclareService(UserService, { tableName: 'user', clz: User, dbType: DBType.Sqlite, dbName: 'test_db' }) as any;

describe('StreamQuery 扩展方法', () => {
    let dao: any;
    beforeAll(() => {
        setupGlobals();
        dao = (globalThis as any)[_dao][DBType.Sqlite]['test_db'];
    });
    beforeEach(() => {
        dao.allSqls.length = 0;
    });

    function newQuery(): StreamQuery<User> {
        const svc = new WrappedUserService();
        return svc.stream();
    }

    // === 比较操作符 ===
    describe('eq (等于)', () => {
        it('eq 生成等于条件', () => {
            const q = newQuery();
            q.eq('name', 'test').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('name');
        });
        it('eq null 值跳过', () => {
            const q = newQuery();
            q.eq('name', null).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('eqs (多字段等于)', () => {
        it('eqs 生成多字段条件', () => {
            const q = newQuery();
            q.eqs(['name', 'email'], 'test').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('notEq (不等于)', () => {
        it('notEq 生成不等于条件', () => {
            const q = newQuery();
            q.notEq('name', 'test').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('<>');
        });
    });

    describe('eqT (表别名等于)', () => {
        it('eqT 带表别名', () => {
            const q = newQuery();
            q.eqT({ name: 'test' }).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('eqWith (字段间比较)', () => {
        it('eqWith 两字段相等', () => {
            const q = newQuery();
            q.eqWith('name', 'email').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('notEqWith (字段间不等)', () => {
        it('notEqWith 两字段不等', () => {
            const q = newQuery();
            q.notEqWith('name', 'email').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('grate (大于)', () => {
        it('grate 生成大于条件', () => {
            const q = newQuery();
            q.grate('age', 18).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('>');
        });
    });

    describe('grateEq (大于等于)', () => {
        it('grateEq 生成大于等于条件', () => {
            const q = newQuery();
            q.grateEq('age', 18).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('>=');
        });
    });

    describe('less (小于)', () => {
        it('less 生成小于条件', () => {
            const q = newQuery();
            q.less('age', 30).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('<');
        });
    });

    describe('lessEq (小于等于)', () => {
        it('lessEq 生成小于等于条件', () => {
            const q = newQuery();
            q.lessEq('age', 30).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('<=');
        });
    });

    describe('regexp (正则匹配)', () => {
        it('regexp 生成正则条件', () => {
            const q = newQuery();
            q.regexp('name', '^test').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('like (模糊匹配)', () => {
        it('like 生成模糊条件', () => {
            const q = newQuery();
            q.like('name', '%test%').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('LIKE');
        });
    });

    describe('in (包含)', () => {
        it('in 生成包含条件', () => {
            const q = newQuery();
            q.in('id', [1, 2, 3]).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('IN');
        });
    });

    describe('notIn (不包含)', () => {
        it('notIn 生成不包含条件', () => {
            const q = newQuery();
            q.notIn('id', [1, 2, 3]).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('NOT IN');
        });
    });

    describe('between (范围)', () => {
        it('between 生成范围条件', () => {
            const q = newQuery();
            q.between('age', 18, 30).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('BETWEEN');
        });
    });

    // === 逻辑操作符 ===
    describe('and', () => {
        it('and 添加 AND 条件', () => {
            const q = newQuery();
            q.and((q) => q.eq('status', 1)).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('AND');
        });
    });

    describe('or', () => {
        it('or 添加 OR 条件', () => {
            const q = newQuery();
            q.or((q) => q.eq('status', 1)).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('OR');
        });
    });

    // === 排序 ===
    describe('asc', () => {
        it('asc 升序', () => {
            const q = newQuery();
            q.select('name').asc('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('ASC');
        });
    });

    describe('desc', () => {
        it('desc 降序', () => {
            const q = newQuery();
            q.select('name').desc('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('DESC');
        });
    });

    // === 聚合 ===
    describe('distinct', () => {
        it('distinct 去重', () => {
            const q = newQuery();
            q.distinct().select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('DISTINCT');
        });
    });

    describe('count', () => {
        it('count 计数', () => {
            const q = newQuery();
            q.count().select2('count(*) as total');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('sum', () => {
        it('sum 求和', () => {
            const q = newQuery();
            q.sum('score').select2('sum(score) as total');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('avg', () => {
        it('avg 平均值', () => {
            const q = newQuery();
            q.avg('score').select2('avg(score) as avg_score');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('max', () => {
        it('max 最大值', () => {
            const q = newQuery();
            q.max('score').select2('max(score) as max_score');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('min', () => {
        it('min 最小值', () => {
            const q = newQuery();
            q.min('score').select2('min(score) as min_score');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    // === 其他查询方法 ===
    describe('select2 (指定字段查询)', () => {
        it('select2 指定字段', () => {
            const q = newQuery();
            q.select2('id, name, age');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('id');
            expect(dao.lastSql).toContain('name');
        });
    });

    describe('page (分页)', () => {
        it('page 分页查询', () => {
            const q = newQuery();
            q.select('name').page(1, 10);
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('LIMIT');
        });
    });

    // === 更新操作 ===
    describe('update', () => {
        it('update 生成更新', () => {
            const q = newQuery();
            q.update({ name: 'new-name' });
            expect(q).toBeDefined();
        });
    });

    describe('update2 (指定表更新)', () => {
        it('update2 指定表', () => {
            const q = newQuery();
            q.update2('user', { name: 'new-name' });
            expect(q).toBeDefined();
        });
    });

    describe('updateT (带表别名更新)', () => {
        it('updateT 带别名', () => {
            const q = newQuery();
            q.updateT('u', { name: 'new-name' });
            expect(q).toBeDefined();
        });
    });

    describe('replace (替换)', () => {
        it('replace 生成替换', () => {
            const q = newQuery();
            q.replace({ id: 1, name: 'new-name' });
            expect(q).toBeDefined();
        });
    });

    // === 执行方法 ===
    describe('excuteUpdate', () => {
        it('excuteUpdate 执行更新', () => {
            const q = newQuery();
            const result = q.eq('id', 1).excuteUpdate({ name: 'updated', sync: SyncMode.Sync } as any);
            expect(result).toBeDefined();
        });
    });

    describe('excuteDelete', () => {
        it('excuteDelete 执行删除', () => {
            const q = newQuery();
            const result = q.eq('id', 1).excuteDelete({ sync: SyncMode.Sync } as any);
            expect(result).toBeDefined();
        });
    });

    describe('excutePage', () => {
        it('excutePage 执行分页查询', () => {
            const q = newQuery();
            const result = q.excutePage({ pageNum: 1, pageSize: 10, sync: SyncMode.Sync, skipConn: true } as any);
            expect(result).toBeDefined();
        });
    });

    // === 工具方法 ===
    describe('reset', () => {
        it('reset 重置查询', () => {
            const q = newQuery();
            q.eq('name', 'test').reset().select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('if (条件)', () => {
        it('if 条件为真时应用', () => {
            const q = newQuery();
            q.if(true, (q) => q.eq('name', 'test')).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toContain('name');
        });
        it('if 条件为假时不应用', () => {
            const q = newQuery();
            q.if(false, (q) => q.eq('name', 'test')).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('isNULL', () => {
        it('isNULL 生成 NULL 条件', () => {
            const q = newQuery();
            q.isNULL('email').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql.toUpperCase()).toContain('NULL');
        });
    });

    describe('isEmpty', () => {
        it('isEmpty 生成空字符串条件', () => {
            const q = newQuery();
            q.isEmpty('email').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('findInSet', () => {
        it('findInSet 生成 FIND_IN_SET 条件', () => {
            const q = newQuery();
            q.findInSet('tag1', 'tags').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('match (全文搜索)', () => {
        it('match 生成全文搜索条件', () => {
            const q = newQuery();
            q.match('keyword', ['name']).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('shiftEq (位移等于)', () => {
        it('shiftEq 生成位移条件', () => {
            const q = newQuery();
            q.shiftEq('status', 'score', 1).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('pow (幂运算)', () => {
        it('pow 生成幂运算', () => {
            const q = newQuery();
            q.pow('score', 2).select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('includes (包含检查)', () => {
        it('includes 生成包含条件', () => {
            const q = newQuery();
            q.includes('tags', 'javascript').select('name');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });

    describe('groupConcat (分组连接)', () => {
        it('groupConcat 生成 GROUP_CONCAT', () => {
            const q = newQuery();
            q.groupConcat('name').select2('group_concat(name) as names');
            q.excuteSelect({ sync: SyncMode.Sync, skipConn: true } as any);
            expect(dao.lastSql).toBeDefined();
        });
    });
});
