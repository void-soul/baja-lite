import { describe, it, expect } from 'bun:test';
import { convert, type XML } from '../../.test-build/convert-xml.js';

describe('convert-xml', () => {
    it('<if> 命中 / 不命中', () => {
        const tree: XML[] = [
            { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'SELECT * FROM t WHERE 1=1 ' },
            { type: 'tag', name: 'if', voidElement: false, attrs: { test: 'id != null' }, children: [
                { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'AND id = #{id}' },
            ] },
        ];
        expect(convert(tree, { id: 5 }, [], {})).toContain("id = '5'");
        expect(convert(tree, { id: null }, [], {})).not.toContain("id = '5'");
    });
    it('<foreach> 展开', () => {
        const tree: XML[] = [
            { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'SELECT * FROM t WHERE id IN ' },
            { type: 'tag', name: 'foreach', voidElement: false, attrs: { collection: 'ids', item: 'item', open: '(', close: ')', separator: ',' }, children: [
                { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: '#{item}' },
            ] },
        ];
        expect(convert(tree, { ids: [1, 2, 3] }, [], {})).toContain("('1','2','3')");
    });
    it('<where> 去除前导 AND/OR', () => {
        const tree: XML[] = [
            { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'SELECT * FROM t ' },
            { type: 'tag', name: 'where', voidElement: false, attrs: {}, children: [
                { type: 'tag', name: 'if', voidElement: false, attrs: { test: 'x != null' }, children: [
                    { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'AND a = #{x}' },
                ] },
            ] },
        ];
        const out = convert(tree, { x: 1 }, [], {});
        expect(out).toContain('WHERE');
        expect(out).toContain("a = '1'");
        expect(/\bAND\b\s+a/.test(out)).toBe(false);
    });
});
