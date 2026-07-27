import { describe, it, expect } from 'bun:test';
import * as baja from '../../.test-build/index.js';

describe('baja-lite 公共 API', () => {
    it('导出核心数据库构件', () => {
        expect(typeof baja.SqlCache).toBe('function');
        expect(typeof baja.DeclareClass).toBe('function');
        expect(typeof baja.DeclareService).toBe('function');
        expect(typeof baja.SqlService).toBe('function');
        expect(typeof baja.StreamQuery).toBe('function');
        expect(typeof baja.DB).toBe('function');
        expect(typeof baja.SqliteRemoteClass).toBe('function');
    });

    it('导出工具与基础设施', () => {
        expect(typeof baja.excuteWithCache).toBe('function');
        expect(typeof baja.trigger).toBe('function');
        expect(typeof baja.PrinterLogger).toBe('function');
        expect(typeof baja.Snowflake).toBe('function');
        expect(baja.ColumnMode).toBeDefined();
        expect(baja.SyncMode).toBeDefined();
    });

    it('导出其他模块符号', () => {
        // error
        expect(typeof baja.DatabaseError).toBe('function');
        expect(baja.Throw).toBeDefined();
        // event
        expect(typeof baja.on).toBe('function');
        expect(typeof baja.off).toBe('function');
        expect(typeof baja.trigger).toBe('function');
        // fn
        expect(typeof baja.promise).toBe('function');
        expect(typeof baja.excuteSplit).toBe('function');
        // math
        expect(typeof baja.num).toBe('function');
        expect(typeof baja.add).toBe('function');
        // object
        expect(typeof baja.copyBean).toBe('function');
        // snowflake
        expect(typeof baja.Snowflake).toBe('function');
        expect(baja.snowflake).toBeDefined();
        // logger / cache
        expect(typeof baja.PrinterLogger).toBe('function');
        expect(typeof baja.excuteWithCache).toBe('function');
    });
});
