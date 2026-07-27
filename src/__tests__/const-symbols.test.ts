import { describe, it, expect } from 'bun:test';
import * as symbols from '../../.test-build/const/symbols.js';

describe('const/symbols 内部符号与常量', () => {
    it('导出内部 Symbol / 字符串键', () => {
        expect(typeof symbols._dao).toBe('symbol');
        expect(typeof symbols._GlobalSqlOption).toBe('symbol');
        expect(typeof symbols._sqlCache).toBe('symbol');
        expect(typeof symbols._primaryDB).toBe('string');
    });
    it('导出默认常量', () => {
        expect(symbols.DEFAULT_KEEPALIVE_INTERVAL).toBe(30000);
        expect(symbols.DEFAULT_MAX_DEAL).toBe(500);
    });
});
