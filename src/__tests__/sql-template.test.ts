import { describe, it, expect, beforeAll } from 'bun:test';
import { MapperIfUndefined } from '../../.test-build/const/index.js';
import { SqlCache, flatData } from '../../.test-build/db/sql-template.js';
import { setupGlobals } from './helpers.js';

describe('db/sql-template', () => {
    beforeAll(() => setupGlobals());

    it('SqlCache.load 渲染 mustache 模板（inline sqlMap）', async () => {
        const cache = new SqlCache();
        await cache.init({
            sqlMap: {
                'user.selectById': 'SELECT * FROM user WHERE id = {{id}}',
                'user.list': 'SELECT * FROM user {{#where}} and name = {{name}} {{/where}}',
            },
        });
        expect(cache.load(['user.selectById'], { id: 5 })).toContain('id = 5');
        const listSql = cache.load(['user.list'], { name: 'bob' });
        expect(listSql).toContain('WHERE');
        expect(listSql).toContain('name = bob');
    });

    it('SqlCache.load 未知 sqlId 抛错', async () => {
        const cache = new SqlCache();
        await cache.init({ sqlMap: { 'x.y': 'SELECT 1' } });
        expect(() => cache.load(['not.exist'], {})).toThrow(/不存在/);
    });

    it('flatData 按映射展平（跳过 undefined）', () => {
        const res = flatData({
            data: { dit_id: 1, event_id: 2, _index: 0 } as any,
            mapper: [
                { columnName: 'dit_id', mapNames: ['id'] },
                { columnName: 'event_id', mapNames: ['eventMainInfo', 'id'] },
            ],
            mapperIfUndefined: MapperIfUndefined.Skip,
        });
        expect(res).toEqual({ id: 1, eventMainInfo: { id: 2 } });
    });
});
