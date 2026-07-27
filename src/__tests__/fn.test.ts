import { describe, it, expect } from 'bun:test';
import { promise, dieTrying, excuteSplit, ExcuteSplitMode } from '../../.test-build/fn.js';

describe('fn', () => {
    it('promise 化回调', async () => {
        const cb = (a: number, b: number, done: (e: any, d: any) => void) => done(null, a + b);
        const p = promise<number>({ fn: cb })(2, 3);
        expect(await p).toBe(5);
        const cbErr = (done: (e: any, d: any) => void) => done(new Error('e'), null);
        await expect(promise({ fn: cbErr })()).rejects.toThrow(/e/);
    });
    it('dieTrying 立即完成 / 超限停止', async () => {
        expect(await dieTrying(() => 'done')).toBe('done');
        const r = await dieTrying(() => undefined, { maxTryTimes: 2, name: 't', sleepAppend: 0 });
        expect(r).toBeUndefined();
        let failedCount = 0;
        const r2 = await dieTrying(
            () => undefined,
            { maxTryTimes: 1, name: 't', sleepAppend: 0, onFail: () => { failedCount++; return false; } },
        );
        expect(r2).toBeUndefined();
        expect(failedCount).toBeGreaterThanOrEqual(1);
    });
    it('excuteSplit SyncTrust / SyncNoTrust', () => {
        const r1 = excuteSplit(ExcuteSplitMode.SyncTrust, [1, 2, 3, 4], (args) => args.length, { everyLength: 2 });
        expect(r1).toEqual([2, 2]);
        const r2 = excuteSplit(ExcuteSplitMode.SyncNoTrust, [1, 2], (args, i) => {
            if (i === 1) throw new Error('bad');
            return args.length;
        }, { everyLength: 1 });
        expect((r2 as any).result.length).toBe(1);
        expect((r2 as any).error.length).toBe(1);
    });
    it('excuteSplit AsyncTrust / AsyncNoTrust', async () => {
        const r1 = await excuteSplit(ExcuteSplitMode.AsyncTrust, [1, 2, 3], async (args) => args.length, { everyLength: 1 });
        expect(r1).toEqual([1, 1, 1]);
        const r2 = await excuteSplit(ExcuteSplitMode.AsyncNoTrust, [1, 2], async (args, i) => {
            if (i === 1) throw new Error('bad');
            return args.length;
        }, { everyLength: 1 });
        expect((r2 as any).result.length).toBe(1);
        expect((r2 as any).error.length).toBe(1);
    });
    it('excuteSplit groupCount + extendParams', () => {
        const r = excuteSplit(ExcuteSplitMode.SyncTrust, [1, 2, 3, 4], (args, i, len, ext) => `${ext}:${args.length}`, {
            groupCount: 2, extendParams: ['a', 'b'],
        });
        expect(r).toEqual(['a:2', 'b:2']);
    });
    it('excuteSplit 缺少分割参数抛错', () => {
        expect(() => excuteSplit(ExcuteSplitMode.SyncTrust, [1], (a) => a, {} as any)).toThrow(/参数错误/);
    });
});
