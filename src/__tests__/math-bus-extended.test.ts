import { describe, it, expect } from 'bun:test';
import { Bus } from '../../.test-build/math.js';

describe('Bus 扩展比较/条件/工具方法', () => {
    // === 边界比较方法 (返回 boolean) ===
    describe('nlt (not less than)', () => {
        it('值 >= 边界时返回 true', () => {
            expect(new Bus(5).nlt(3)).toBe(true);
            expect(new Bus(5).nlt(5)).toBe(true);
        });
        it('值 < 边界时返回 false', () => {
            expect(new Bus(2).nlt(5)).toBe(false);
        });
        it('负数边界', () => {
            expect(new Bus(-1).nlt(-5)).toBe(true);
            expect(new Bus(-10).nlt(-5)).toBe(false);
        });
    });

    describe('nle (not less or equal)', () => {
        it('值 > 边界时返回 true', () => {
            expect(new Bus(5).nle(3)).toBe(true);
            expect(new Bus(5).nle(4)).toBe(true);
        });
        it('值 <= 边界时返回 false', () => {
            expect(new Bus(3).nle(5)).toBe(false);
            expect(new Bus(5).nle(5)).toBe(false);
        });
    });

    describe('ngt (not greater than)', () => {
        it('值 <= 边界时返回 true', () => {
            expect(new Bus(3).ngt(5)).toBe(true);
            expect(new Bus(5).ngt(5)).toBe(true);
        });
        it('值 > 边界时返回 false', () => {
            expect(new Bus(8).ngt(5)).toBe(false);
        });
    });

    describe('nge (not greater or equal)', () => {
        it('值 < 边界时返回 true', () => {
            expect(new Bus(3).nge(5)).toBe(true);
            expect(new Bus(4).nge(5)).toBe(true);
        });
        it('值 >= 边界时返回 false', () => {
            expect(new Bus(5).nge(5)).toBe(false);
            expect(new Bus(8).nge(5)).toBe(false);
        });
    });

    // === 条件比较方法 (设置 ifit 标志，用于链式调用) ===
    describe('ifLt (if less than)', () => {
        it('值 < 边界时 ifit 为 true', () => {
            const bus = new Bus(2);
            bus.ifLt(5);
            // ifit 为 true，后续操作会执行
            bus.add(10);
            expect(bus.over()).toBe(12); // 2 + 10
        });
        it('值 >= 边界时 ifit 为 false', () => {
            const bus = new Bus(5);
            bus.ifLt(5);
            // ifit 为 false，后续操作不会执行
            bus.add(10);
            expect(bus.over()).toBe(5); // 不变
        });
    });

    describe('ifLe (if less or equal)', () => {
        it('值 <= 边界时 ifit 为 true', () => {
            const bus = new Bus(3);
            bus.ifLe(5);
            bus.add(10);
            expect(bus.over()).toBe(13);
        });
        it('值 > 边界时 ifit 为 false', () => {
            const bus = new Bus(6);
            bus.ifLe(5);
            bus.add(10);
            expect(bus.over()).toBe(6);
        });
    });

    describe('ifGe (if greater or equal)', () => {
        it('值 >= 边界时 ifit 为 true', () => {
            const bus = new Bus(5);
            bus.ifGe(5);
            bus.add(10);
            expect(bus.over()).toBe(15);
        });
        it('值 < 边界时 ifit 为 false', () => {
            const bus = new Bus(3);
            bus.ifGe(5);
            bus.add(10);
            expect(bus.over()).toBe(3);
        });
    });

    describe('ifNlt (if not less than)', () => {
        it('值 >= 边界时 ifit 为 true', () => {
            const bus = new Bus(5);
            bus.ifNlt(5);
            bus.add(10);
            expect(bus.over()).toBe(15);
        });
        it('值 < 边界时 ifit 为 false', () => {
            const bus = new Bus(3);
            bus.ifNlt(5);
            bus.add(10);
            expect(bus.over()).toBe(3);
        });
    });

    describe('ifNle (if not less or equal)', () => {
        it('值 > 边界时 ifit 为 true', () => {
            const bus = new Bus(6);
            bus.ifNle(5);
            bus.add(10);
            expect(bus.over()).toBe(16);
        });
        it('值 <= 边界时 ifit 为 false', () => {
            const bus = new Bus(5);
            bus.ifNle(5);
            bus.add(10);
            expect(bus.over()).toBe(5);
        });
    });

    describe('ifNgt (if not greater than)', () => {
        it('值 <= 边界时 ifit 为 true', () => {
            const bus = new Bus(5);
            bus.ifNgt(5);
            bus.add(10);
            expect(bus.over()).toBe(15);
        });
        it('值 > 边界时 ifit 为 false', () => {
            const bus = new Bus(8);
            bus.ifNgt(5);
            bus.add(10);
            expect(bus.over()).toBe(8);
        });
    });

    describe('ifNge (if not greater or equal)', () => {
        it('值 < 边界时 ifit 为 true', () => {
            const bus = new Bus(3);
            bus.ifNge(5);
            bus.add(10);
            expect(bus.over()).toBe(13);
        });
        it('值 >= 边界时 ifit 为 false', () => {
            const bus = new Bus(5);
            bus.ifNge(5);
            bus.add(10);
            expect(bus.over()).toBe(5);
        });
    });

    // === 工具方法 ===
    describe('max', () => {
        it('返回较大值', () => {
            expect(new Bus(3).max(5).over()).toBe(5);
            expect(new Bus(5).max(3).over()).toBe(5);
            expect(new Bus(5).max(5).over()).toBe(5);
        });
        it('负数比较', () => {
            expect(new Bus(-10).max(-5).over()).toBe(-5);
        });
    });

    describe('min', () => {
        it('返回较小值', () => {
            expect(new Bus(3).min(5).over()).toBe(3);
            expect(new Bus(5).min(3).over()).toBe(3);
            expect(new Bus(5).min(5).over()).toBe(5);
        });
        it('负数比较', () => {
            expect(new Bus(-10).min(-5).over()).toBe(-10);
        });
    });

    describe('divDef (安全除法)', () => {
        it('正常除法', () => {
            expect(new Bus(10).divDef(0, 2).over()).toBe(5);
        });
        it('除数为0时返回默认值', () => {
            expect(new Bus(10).divDef(999, 0).over()).toBe(999);
        });
        it('除数为0且默认值为0', () => {
            expect(new Bus(10).divDef(0, 0).over()).toBe(0);
        });
    });

    describe('money (金额格式化)', () => {
        it('返回格式化字符串', () => {
            const result = new Bus(10.5).money();
            expect(typeof result).toBe('string');
            expect(result).toContain('10');
        });
        it('整数格式化', () => {
            const result = new Bus(100).money();
            expect(typeof result).toBe('string');
        });
        it('负数金额', () => {
            const result = new Bus(-10.5).money();
            expect(typeof result).toBe('string');
        });
    });
});
