import { describe, it, expect, beforeAll } from 'bun:test';
import { DBType, _Hump } from 'baja-lite-field';
import { ColumnMode, _GlobalSqlOption, _dao, _LoggerService, _sqlCache } from '../../.test-build/const/index.js';
import { Boot } from '../../.test-build/boot.js';
import { setupGlobals } from './helpers.js';

describe('Boot 启动配置', () => {
    beforeAll(() => {
        setupGlobals();
    });

    it('Boot 是函数并按 columnMode 设置全局 _Hump', async () => {
        expect(typeof Boot).toBe('function');
        await Boot({ columnMode: ColumnMode.HUMP });
        const g: any = globalThis;
        expect(g[_Hump]).toBe(true);
    });

    it('声明的关键全局符号存在', () => {
        const g: any = globalThis;
        expect(g[_GlobalSqlOption]).toBeDefined();
        expect(g[_dao]).toBeDefined();
        expect(g[_LoggerService]).toBeDefined();
        expect(g[_sqlCache]).toBeDefined();
        expect(_Hump).toBeDefined();
        expect(DBType.Sqlite).toBeDefined();
    });
});
