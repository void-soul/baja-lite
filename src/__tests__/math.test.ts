import { describe, it, expect } from 'bun:test';
import {
    num, max, min, div, divDef, add, mul, sub, round, merge, money,
    Bus, calc, getGeo, ten2Any, any2Ten,
} from '../../.test-build/math.js';

describe('math', () => {
    it('num 类型转换与默认值', () => {
        expect(num('5')).toBe(5);
        expect(num(5)).toBe(5);
        expect(num('')).toBe(0);
        expect(num(null)).toBe(0);
        expect(num(undefined)).toBe(0);
        expect(num(NaN)).toBe(0);
        expect(num('5x', 9)).toBe(9);
        expect(num(new Bus(3))).toBe(3);
    });
    it('add/sub/mul/div/min/max', () => {
        expect(add(1, 2, 3)).toBe(6);
        expect(sub(10, 1, 2)).toBe(7);
        expect(mul(2, 3, 4)).toBe(24);
        expect(div(10, 2)).toBe(5);
        expect(div(10)).toBe(10);
        expect(min(3, 1, 2)).toBe(1);
        expect(max(3, 1, 2)).toBe(3);
    });
    it('divDef 除零回退到默认值', () => {
        expect(divDef(0, 10, 2)).toBe(5);
        expect(divDef(999, 10, 0)).toBe(999);
        expect(divDef(5, 10)).toBe(10);
    });
    it('round 多模式', () => {
        expect(round(2.4, 0)).toBe(2);
        expect(round(2.6, 0)).toBe(3);
        expect(round(2.123, 1)).toBe(2.1);
        expect(round(2.1, 0, 1)).toBe(3); // ROUND_UP
        expect(round(2.9, 0, 2)).toBe(2); // ROUND_DOWN
    });
    it('merge 取整数位拼小数部分', () => {
        expect(merge(10, 99)).toBe(10.99);
        expect(merge('abc', 99)).toBe(0);
        expect(merge(5, 'x')).toBe(5);
    });
    it('money 格式化', () => {
        expect(money(1234.5)).toContain('1,234.50');
        expect(money('x', { def: 0 })).toContain('0.00');
    });
    it('Bus 链式运算', () => {
        expect(new Bus(10).add(5).sub(2).mul(2).over()).toBe(26);
        expect(new Bus(10).div(2).div(5).over()).toBe(1);
    });
    it('Bus 比较与条件', () => {
        expect(new Bus(10).gt(5)).toBe(true);
        expect(new Bus(10).lt(5)).toBe(false);
        expect(new Bus(10).eq(10)).toBe(true);
        expect(new Bus(10).ne(5)).toBe(true);
        expect(new Bus(10).le(10)).toBe(true);
        expect(new Bus(10).ge(9)).toBe(true);
        expect(new Bus(10).ac().over()).toBe(-10);
        expect(new Bus(-5).abs().over()).toBe(5);
    });
    it('Bus if 门控与 ifXxx', () => {
        expect(new Bus(10).if(false).add(5).over()).toBe(10);
        expect(new Bus(10).if(true).add(5).over()).toBe(15);
        expect(new Bus(10).ifGt(5).add(1).over()).toBe(11);
        expect(new Bus(10).ifGt(50).add(1).over()).toBe(10);
        expect(new Bus(10).ifEq(10).add(1).over()).toBe(11);
        expect(new Bus(10).ifNe(10).add(1).over()).toBe(10);
    });
    it('Bus round / merge', () => {
        expect(new Bus(2.345).round(2).over()).toBe(2.35);
        expect(new Bus(10).merge(99).over()).toBe(10.99);
    });
    it('calc 便捷构造', () => {
        expect(calc(1).add(2).mul(3).over()).toBe(9);
    });
    it('getGeo 返回有限数值', () => {
        const p1 = { latitude: '39.9', longitude: '116.4', lat: 0, long: 0 };
        const p2 = { latitude: '31.2', longitude: '121.5', lat: 0, long: 0 };
        const d = getGeo(p1, p2);
        expect(Number.isFinite(d) && d > 0).toBe(true);
    });
    it('ten2Any / any2Ten 互转', () => {
        for (const n of [1, 2, 26, 27, 100, 703, 18278]) {
            expect(any2Ten(ten2Any(n))).toBe(n);
        }
        expect(ten2Any(26)).toBe('Z');
        expect(any2Ten('Z')).toBe(26);
    });
});
