import { describe, it, expect } from 'bun:test';
import { Snowflake } from '../../.test-build/snowflake.js';

describe('snowflake', () => {
    it('generate 生成唯一数字串', () => {
        const sf = new Snowflake({ mid: 1, offset: 0 });
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            const id = sf.generate();
            expect(id).toBeTruthy();
            expect(/^\d+$/.test(id!)).toBe(true);
            ids.add(id!);
        }
        expect(ids.size).toBeGreaterThan(1);
    });
    it('mid 取模 1023', () => {
        const sf = new Snowflake({ mid: 5000, offset: 0 });
        expect(/^\d+$/.test(sf.generate()!)).toBe(true);
    });
    it('时钟回拨超过 5s 返回 null', () => {
        const sf = new Snowflake({ mid: 1, offset: 0 });
        // @ts-expect-error 强制制造时钟回拨
        sf.lastTime = Date.now() + 6000;
        expect(sf.generate()).toBeNull();
    });
});
