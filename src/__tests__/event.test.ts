import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { EventEmitter } from 'events';
import { _EventBus, _LoggerService } from '../../.test-build/const/index.js';
import { PrinterLogger } from '../../.test-build/logger.js';
import { on, off, trigger } from '../../.test-build/event.js';

beforeEach(() => {
    const g = globalThis as any;
    g[_EventBus] = new EventEmitter();
    g[_LoggerService] = new PrinterLogger();
});
afterEach(() => {
    const g = globalThis as any;
    (g[_EventBus] as EventEmitter).removeAllListeners();
});

describe('event', () => {
    it('on 注册后 trigger 触发 listener', () => {
        let got: any;
        on('e1', (v: any) => { got = v; });
        const r = trigger('e1', ['hello'], { remote: false });
        expect(r).toBe(true);
        expect(got).toBe('hello');
    });
    it('unique 去重：已有监听器则跳过', () => {
        let count = 0;
        const h = () => { count++; };
        on('e2', h, { unique: true });
        on('e2', h, { unique: true });
        on('e2', h, { unique: true });
        trigger('e2', [], { remote: false });
        expect(count).toBe(1);
    });
    it('once 触发一次后自动移除', () => {
        let count = 0;
        on('e3', () => { count++; }, { once: true });
        trigger('e3', [], { remote: false });
        trigger('e3', [], { remote: false });
        expect(count).toBe(1);
    });
    it('off(event, listener) 移除指定监听器', () => {
        let count = 0;
        const h = () => { count++; };
        on('e4', h);
        off('e4', h);
        trigger('e4', [], { remote: false });
        expect(count).toBe(0);
    });
    it('off(event) 移除全部监听器', () => {
        let count = 0;
        on('e5', () => { count++; });
        on('e5', () => { count++; });
        off('e5');
        trigger('e5', [], { remote: false });
        expect(count).toBe(0);
    });
    it('off 可移除 once 监听器（按原始引用）', () => {
        let count = 0;
        const h = () => { count++; };
        on('e6', h, { once: true });
        off('e6', h);
        trigger('e6', [], { remote: false });
        expect(count).toBe(0);
    });
    it('trigger 非数组 args 抛 TypeError', () => {
        expect(() => trigger('e7', 'not-array' as any)).toThrow(TypeError);
    });
    it('监听器异常被隔离，不影响其他监听器', () => {
        const order: string[] = [];
        on('e8', () => { throw new Error('boom'); });
        on('e8', () => { order.push('ok'); });
        expect(() => trigger('e8', [], { remote: false })).not.toThrow();
        expect(order).toEqual(['ok']);
    });
    it('trigger 默认无 Redis 时静默跳过 remote', () => {
        // 不应抛错（redis 未配置）
        expect(() => trigger('e9', [1, 2])).not.toThrow();
    });
});
