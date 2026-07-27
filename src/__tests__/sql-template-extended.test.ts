import { describe, it, expect, beforeAll } from 'bun:test';
import { SqlCache, flatData } from '../../.test-build/db/sql-template.js';
import { _resultMap } from '../../.test-build/const/symbols.js';
import { setupGlobals } from './helpers.js';

describe('SqlCache 扩展方法', () => {
    beforeAll(() => {
        setupGlobals();
    });

    describe('SqlCache.init', () => {
        it('init 加载 sqlMap', async () => {
            const cache = new SqlCache();
            await cache.init({
                sqlMap: { 'getUser': 'SELECT * FROM user WHERE id = #{id}' },
            });
            expect(cache).toBeDefined();
        });
        it('init 带 sqlFNMap', async () => {
            const cache = new SqlCache();
            await cache.init({
                sqlFNMap: { 'columns': 'id, name, age' },
            });
            expect(cache).toBeDefined();
        });
        it('init 带 sqlMapperMap', async () => {
            const cache = new SqlCache();
            await cache.init({
                sqlMapperMap: { 'userMapper': [] as any },
            });
            expect(cache).toBeDefined();
        });
        it('init 带完整配置', async () => {
            const cache = new SqlCache();
            await cache.init({
                sqlMap: { 'test': 'SELECT 1' },
                sqlFNMap: { 'cols': 'id' },
                sqlMapperMap: {} as any,
            });
            expect(cache).toBeDefined();
        });
    });
});

describe('flatData 扩展', () => {
    beforeAll(() => {
        // 注册一个测试 mapper
        (globalThis as any)[_resultMap] = {
            userMapper: [
                { columnName: 'user_name', mapNames: ['userName'] },
                { columnName: 'user_age', mapNames: ['userAge'] },
            ],
        };
    });

    it('flatData 带 mapper 数组', () => {
        const data = { user_name: 'test', user_age: '18' };
        const mapper = [
            { columnName: 'user_name', mapNames: ['userName'] },
            { columnName: 'user_age', mapNames: ['userAge'] },
        ];
        const result = flatData<any>({ data, mapper });
        expect(result).toBeDefined();
        expect(result.userName).toBe('test');
        expect(result.userAge).toBe('18');
    });

    it('flatData 带 mapperIfUndefined Null', () => {
        const data = { user_name: 'test' };
        const mapper = [
            { columnName: 'user_name', mapNames: ['userName'] },
            { columnName: 'user_age', mapNames: ['userAge'] },
        ];
        const result = flatData<any>({ data, mapper, mapperIfUndefined: 'Null' });
        expect(result).toBeDefined();
        expect(result.userName).toBe('test');
    });

    it('flatData 带 mapperIfUndefined Zero', () => {
        const data = { user_name: 'test' };
        const mapper = [
            { columnName: 'user_name', mapNames: ['userName'] },
            { columnName: 'user_age', mapNames: ['userAge'] },
        ];
        const result = flatData<any>({ data, mapper, mapperIfUndefined: 'Zero' });
        expect(result).toBeDefined();
    });

    it('flatData 带 mapperIfUndefined EmptyString', () => {
        const data = { user_name: 'test' };
        const mapper = [
            { columnName: 'user_name', mapNames: ['userName'] },
            { columnName: 'user_age', mapNames: ['userAge'] },
        ];
        const result = flatData<any>({ data, mapper, mapperIfUndefined: 'EmptyString' });
        expect(result).toBeDefined();
    });

    it('flatData 带字符串 mapper 名称', () => {
        const data = { user_name: 'test', user_age: '18' };
        const result = flatData<any>({ data, mapper: 'userMapper' });
        expect(result).toBeDefined();
        expect(result.userName).toBe('test');
        expect(result.userAge).toBe('18');
    });

    it('flatData 带 convert 函数', () => {
        const data = { user_name: 'test', user_age: '18' };
        const mapper = [
            { columnName: 'user_name', mapNames: ['userName'] },
            { columnName: 'user_age', mapNames: ['userAge'], convert: (v: any) => Number(v) },
        ];
        const result = flatData<any>({ data, mapper });
        expect(result).toBeDefined();
        expect(result.userAge).toBe(18);
    });

    it('flatData 带 def 默认值', () => {
        const data = { user_name: 'test' };
        const mapper = [
            { columnName: 'user_name', mapNames: ['userName'] },
            { columnName: 'user_age', mapNames: ['userAge'], def: 0 },
        ];
        const result = flatData<any>({ data, mapper });
        expect(result).toBeDefined();
    });
});
