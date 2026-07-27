import { describe, it, expect, beforeAll } from 'bun:test';
import { excuteWithCache, clearMethodCache } from '../../.test-build/cache.js';
import { setupGlobals } from './helpers.js';

describe('cache', () => {
    beforeAll(() => setupGlobals());

    it('excuteWithCache 首次 miss 执行 fn，再次 hit 命中缓存不重复执行', async () => {
        let calls = 0;
        const fn = async () => { calls++; return { v: 42 }; };
        const r1 = await excuteWithCache({ key: 'ck-test', autoClearTime: 60 }, fn);
        expect(r1).toEqual({ v: 42 });
        expect(calls).toBe(1);
        const r2 = await excuteWithCache({ key: 'ck-test', autoClearTime: 60 }, fn);
        expect(r2).toEqual({ v: 42 });
        expect(calls).toBe(1);
    });

    it('clearMethodCache 后再次执行 fn', async () => {
        let calls = 0;
        const fn = async () => { calls++; return 'x'; };
        await excuteWithCache({ key: 'ck-clear' }, fn);
        expect(calls).toBe(1);
        await clearMethodCache('ck-clear');
        await excuteWithCache({ key: 'ck-clear' }, fn);
        expect(calls).toBe(2);
    });

    it('cacheOnly 只读缓存，无缓存返回 null 且不执行 fn', async () => {
        let calls = 0;
        const fn = async () => { calls++; return 'y'; };
        const r = await excuteWithCache({ key: 'ck-only', cacheOnly: true }, fn);
        expect(r).toBeNull();
        expect(calls).toBe(0);
    });
});
