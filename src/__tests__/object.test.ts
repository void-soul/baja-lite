import { describe, it, expect } from 'bun:test';
import {
    copyBean, convertBean, convertBeans, emptyBean, createBeanFromArray,
    coverComplexBean, fixEmptyPrototy, mixArray, mixList, assignArray,
    array2map, arraySplit, assginObject, distinctArray, P2C, C2P, C2P2, P2C2, fillArrayToMinLength,
} from '../../.test-build/object.js';

describe('object', () => {
    it('copyBean / convertBean 仅保留 classType 的键', () => {
        const r = copyBean({ a: 1, b: 2, c: 3 }, { a: null, b: null });
        expect(r).toEqual({ a: 1, b: 2 });
        expect(convertBean).toBe(copyBean);
    });
    it('emptyBean 生成全 null 结构', () => {
        expect(emptyBean({ a: 1, b: 2 })).toEqual({ a: null, b: null });
    });
    it('convertBeans 批量转换 + 回调', () => {
        const r = convertBeans([{ a: 1, c: 9 }, { a: 2, c: 9 }], { a: null }, (t: any) => { t.a = t.a * 10; });
        expect(r).toEqual([{ a: 10 }, { a: 20 }]);
    });
    it('createBeanFromArray', () => {
        const src = [{ id: 'k1', v: 1 }, { id: 'k2', v: 2 }];
        expect(createBeanFromArray(src, 'id', 'v')).toEqual({ k1: 1, k2: 2 });
        expect(createBeanFromArray(src, 'id')).toEqual({ k1: src[0], k2: src[1] });
    });
    it('coverComplexBean 拆分对象/数组', () => {
        const r = coverComplexBean({ a: 1, sub: { x: 1 }, arr: [1, 2] }, { a: null, x: null });
        expect(r.data).toEqual({ a: 1, x: 1 });
        expect(r.array).toEqual({ arr: [1, 2] });
    });
    it('fixEmptyPrototy 填充空字段', async () => {
        const t: any = { a: '', b: undefined };
        await fixEmptyPrototy(t, { a: 'filled', b: () => 'fromFn' });
        expect(t.a).toBe('filled');
        expect(t.b).toBe('fromFn');
    });
    it('mixArray 统计字段计数', () => {
        const r = mixArray([{ k: 'x' }, { k: 'x' }, { k: 'y' }], 'k' as any);
        expect(r).toEqual({ x: 2, y: 1 });
        const r2 = mixArray([{}, { k: 'y' }], 'k' as any, 'def');
        expect(r2).toEqual({ def: 1, y: 1 });
    });
    it('mixList 分组', () => {
        const arr = [{ k: 'x', v: 1 }, { k: 'x', v: 2 }, { k: 'y', v: 3 }];
        const r = mixList(arr, 'k' as any, 'v' as any);
        expect(r).toEqual({ x: [1, 2], y: [3] });
    });
    it('assignArray 覆盖合并（key/数组/函数）', () => {
        const a1 = [{ id: 1, n: 'a' }, { id: 2, n: 'b' }];
        const a2 = [{ id: 1, n: 'A' }, { id: 3, n: 'c' }];
        const r = assignArray('id' as any, a1, a2);
        expect(r).toEqual([{ id: 1, n: 'A' }, { id: 2, n: 'b' }, { id: 3, n: 'c' }]);
        const b1 = [{ a: 1, b: 1, n: 'x' }];
        const b2 = [{ a: 1, b: 1, n: 'X' }];
        const r2 = assignArray((t1: any, t2: any) => t1.a === t2.a && t1.b === t2.b, b1, b2);
        expect(r2[0].n).toBe('X');
    });
    it('array2map', () => {
        expect(array2map(['a', 'b'], 1)).toEqual({ a: 1, b: 1 });
    });
    it('arraySplit everyLength / groupCount / 错误参数', () => {
        expect(arraySplit([1, 2, 3, 4, 5], { everyLength: 2 })).toEqual([[1, 2], [3, 4], [5]]);
        expect(arraySplit([1, 2, 3, 4, 5], { groupCount: 2 })).toEqual([[1, 2, 3], [4, 5]]);
        expect(() => arraySplit([1], {})).toThrow(/参数错误/);
    });
    it('assginObject 浅合并忽略空值', () => {
        const s: any = { a: 1, b: 2 };
        assginObject(s, { a: 9 } as any, { b: null, c: '' } as any, { d: 3 } as any);
        expect(s).toEqual({ a: 9, b: 2, d: 3 });
    });
    it('distinctArray 按多键去重 + each', () => {
        const seen: any[] = [];
        const r = distinctArray([{ k: 1, g: 'a' }, { k: 1, g: 'a' }, { k: 1, g: 'b' }], ['k', 'g'] as any, (d) => seen.push(d));
        expect(r.length).toBe(2);
        expect(seen.length).toBe(3);
    });
    it('P2C / C2P 命名转换', () => {
        expect(P2C('userName')).toBe('user_name');
        expect(P2C('userName', false)).toBe('userName');
        expect(C2P('user_name')).toBe('userName');
        expect(C2P('user_name', false)).toBe('user_name');
    });
    it('C2P2 / P2C2 对象/数组互转', () => {
        expect(C2P2({ user_name: 1 }, true)).toEqual({ userName: 1 });
        expect(C2P2([{ user_name: 1 }], true)).toEqual([{ userName: 1 }]);
        expect(C2P2({ a: 1 }, true, { a: (v) => v + 1 })).toEqual({ a: 2 });
        expect(P2C2({ userName: 1 })).toEqual({ user_name: 1 });
        expect(P2C2([{ userName: 1 }])).toEqual([{ user_name: 1 }]);
    });
    it('fillArrayToMinLength 补足长度', () => {
        expect(fillArrayToMinLength([1], 3, 0)).toEqual([1, 0, 0]);
        expect(fillArrayToMinLength([1, 2, 3], 3, 0)).toEqual([1, 2, 3]);
    });
});
