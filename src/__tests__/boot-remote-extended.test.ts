import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BootRomote } from '../../.test-build/boot-remote.js';
import { _dao, _LoggerService, _sqlCache, _GlobalSqlOption, _Context, _DataConvert, _enum } from '../../.test-build/const/index.js';

function makeLogger() {
    return {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
        fatal: () => {},
        verbose: () => {},
        log: () => {},
        setLogLevels: () => {},
        debugCategory: () => {},
        prefix: '',
    } as any;
}

describe('BootRomote 完整调用', () => {
    afterEach(() => {
        // 清理 globalThis 上的服务
        delete (globalThis as any)[_dao];
        delete (globalThis as any)[_LoggerService];
        delete (globalThis as any)[_sqlCache];
        delete (globalThis as any)[_GlobalSqlOption];
        delete (globalThis as any)[_Context];
        delete (globalThis as any)[_DataConvert];
        delete (globalThis as any)[_enum];
    });

    it('BootRomote 是函数', () => {
        expect(typeof BootRomote).toBe('function');
    });

    it('BootRomote 带空选项调用', async () => {
        await BootRomote({ logger: makeLogger() } as any);
        expect(true).toBe(true);
    });

    it('BootRomote 带 skipEmptyString 选项', async () => {
        await BootRomote({ logger: makeLogger(), skipEmptyString: true } as any);
        expect((globalThis as any)[_GlobalSqlOption].skipEmptyString).toBe(true);
    });

    it('BootRomote 带 skipNull 选项', async () => {
        await BootRomote({ logger: makeLogger(), skipNull: true } as any);
        expect((globalThis as any)[_GlobalSqlOption].skipNull).toBe(true);
    });

    it('BootRomote 带 maxDeal 选项', async () => {
        await BootRomote({ logger: makeLogger(), maxDeal: 100 } as any);
        expect((globalThis as any)[_GlobalSqlOption].maxDeal).toBe(100);
    });

    it('BootRomote 带 memCacheMaxSize 选项', async () => {
        await BootRomote({ logger: makeLogger(), memCacheMaxSize: 1024 } as any);
        expect((globalThis as any)[_GlobalSqlOption].memCacheMaxSize).toBe(1024);
    });

    it('BootRomote 带 log 选项 (true)', async () => {
        await BootRomote({ logger: makeLogger(), log: true } as any);
        expect(true).toBe(true);
    });

    it('BootRomote 带 log 选项 (数组)', async () => {
        await BootRomote({ logger: makeLogger(), log: ['info', 'error'] } as any);
        expect(true).toBe(true);
    });

    it('BootRomote 带 columnMode 选项', async () => {
        await BootRomote({ logger: makeLogger(), columnMode: 'hump' } as any);
        expect(true).toBe(true);
    });

    it('BootRomote 带 sqlMap 选项', async () => {
        await BootRomote({ logger: makeLogger(), sqlMap: { 'getUser': 'SELECT * FROM user' } } as any);
        expect(true).toBe(true);
    });

    it('BootRomote 带 dataConvert 选项', async () => {
        await BootRomote({ logger: makeLogger(), dataConvert: { 'user': (row: any) => row } } as any);
        expect((globalThis as any)[_DataConvert]).toBeDefined();
    });

    it('BootRomote 带 ctx 选项', async () => {
        await BootRomote({ logger: makeLogger(), ctx: { requestId: 'test-123' } } as any);
        expect((globalThis as any)[_Context]).toBeDefined();
    });

    it('BootRomote 带完整选项 (不含 enums)', async () => {
        await BootRomote({
            logger: makeLogger(),
            skipEmptyString: true,
            skipNull: true,
            maxDeal: 50,
            memCacheMaxSize: 2048,
            log: ['info', 'warn'],
            columnMode: 'positional',
            sqlMap: { 'getUser': 'SELECT * FROM user' },
            dataConvert: { 'user': (row: any) => row },
            ctx: { requestId: 'test-123' },
        } as any);
        expect((globalThis as any)[_GlobalSqlOption]).toBeDefined();
    });
});
