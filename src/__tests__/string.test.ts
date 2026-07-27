import { describe, it, expect } from 'bun:test';
import {
    getPicKey, emptyString, notEmptyString, safeString, trimObject,
    randomNumber, randomString, randomString2, randomString3, buildWxStr,
    replaceChineseCode, replacePlaceholders,
} from '../../.test-build/string.js';

describe('string', () => {
    it('getPicKey 从 uri 提取 key', () => {
        expect(getPicKey('https://x.com/p?key=abc123')).toBe('abc123');
        expect(getPicKey('nokey-here')).toBe('nokey-here');
    });
    it('emptyString / notEmptyString', () => {
        expect(emptyString(null)).toBe(true);
        expect(emptyString(undefined)).toBe(true);
        expect(emptyString('')).toBe(true);
        expect(emptyString('   ')).toBe(true);
        expect(emptyString('   ', false)).toBe(false);
        expect(emptyString('x')).toBe(false);
        expect(notEmptyString('x')).toBe(true);
        expect(notEmptyString('')).toBe(false);
    });
    it('safeString 移除单引号', () => {
        expect(safeString("a'b'c")).toBe('abc');
        expect(safeString(undefined)).toBe('');
    });
    it('trimObject 修剪字符串字段首尾空格（原地修改）', () => {
        const o: any = { a: '  x  ', b: 1, c: ' y ' };
        const r = trimObject(o);
        expect(r.a).toBe('x');
        expect(r.b).toBe(1);
        expect(r.c).toBe('y');
    });
    it('randomNumber 生成指定长度数字串', () => {
        for (let i = 0; i < 20; i++) {
            const s = randomNumber(6);
            expect(s.length).toBe(6);
            expect(/^\d+$/.test(s)).toBe(true);
        }
    });
    it('randomString 变体长度与字符集', () => {
        expect(randomString(8).length).toBe(8);
        expect(/^[A-Za-z0-9]+$/.test(randomString(10))).toBe(true);
        expect(/^[A-Z0-9]+$/.test(randomString2(10))).toBe(true);
        expect(/^[a-z0-9]+$/.test(randomString3(10))).toBe(true);
    });
    it('buildWxStr 过滤空值并对齐 label', () => {
        const s = buildWxStr({ name: '张三', phone: '', age: '18' }, 6, '标题');
        expect(s.startsWith('标题')).toBe(true);
        expect(s).toContain('name');
        expect(s).toContain('张三');
        expect(s).not.toContain('phone');
        expect(s).toContain('age');
        expect(s).toContain('18');
    });
    it('replaceChineseCode 中文标点转英文', () => {
        expect(replaceChineseCode('你好，世界。')).toBe('你好,世界.');
        expect(replaceChineseCode('（测试）')).toBe('(测试)');
        expect(replaceChineseCode('价格：１００')).toBe('价格:１００');
    });
    it('replacePlaceholders ? → $n（跳过字符串字面量）', () => {
        expect(replacePlaceholders('SELECT * FROM t WHERE a = ? AND b = ?'))
            .toBe('SELECT * FROM t WHERE a = $1 AND b = $2');
        expect(replacePlaceholders("SELECT '? ?' FROM t WHERE a = ?"))
            .toBe("SELECT '? ?' FROM t WHERE a = $1");
    });
});
