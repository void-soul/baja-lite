import { describe, it, expect } from 'bun:test';
import { convert, type XML } from '../../.test-build/convert-xml.js';

/**
 * Helper: build a simple XML tree with a single child element.
 * Uses content that won't conflict with single-letter assertions.
 */
function tree(child: XML): XML[] {
    return [
        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'WHERE 1=1 ' },
        child,
    ];
}

describe('convert-xml 扩展标签', () => {
    describe('choose / when / otherwise', () => {
        it('choose 第一个 when 命中', () => {
            const t: XML[] = tree({
                type: 'tag', name: 'choose', voidElement: false, attrs: {}, children: [
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'type == 1' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'FIRST' },
                    ] },
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'type == 2' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'SECOND' },
                    ] },
                    { type: 'tag', name: 'otherwise', voidElement: false, attrs: {}, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'DEFAULT' },
                    ] },
                ],
            });
            const result = convert(t, { type: 1 }, [], {});
            expect(result).toContain('FIRST');
            expect(result).not.toContain('SECOND');
            expect(result).not.toContain('DEFAULT');
        });

        it('choose 第二个 when 命中', () => {
            const t: XML[] = tree({
                type: 'tag', name: 'choose', voidElement: false, attrs: {}, children: [
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'type == 1' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'FIRST' },
                    ] },
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'type == 2' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'SECOND' },
                    ] },
                    { type: 'tag', name: 'otherwise', voidElement: false, attrs: {}, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'DEFAULT' },
                    ] },
                ],
            });
            const result = convert(t, { type: 2 }, [], {});
            expect(result).toContain('SECOND');
            expect(result).not.toContain('FIRST');
        });

        it('choose 全部未命中走 otherwise', () => {
            const t: XML[] = tree({
                type: 'tag', name: 'choose', voidElement: false, attrs: {}, children: [
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'type == 1' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'FIRST' },
                    ] },
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'type == 2' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'SECOND' },
                    ] },
                    { type: 'tag', name: 'otherwise', voidElement: false, attrs: {}, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'DEFAULT' },
                    ] },
                ],
            });
            const result = convert(t, { type: 3 }, [], {});
            expect(result).toContain('DEFAULT');
        });

        it('choose 无 otherwise 时全部未命中无输出', () => {
            const t: XML[] = tree({
                type: 'tag', name: 'choose', voidElement: false, attrs: {}, children: [
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'type == 1' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'FIRST' },
                    ] },
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'type == 2' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'SECOND' },
                    ] },
                ],
            });
            const result = convert(t, { type: 3 }, [], {});
            expect(result).not.toContain('FIRST');
            expect(result).not.toContain('SECOND');
        });

        it('when 测试复杂表达式 (>=)', () => {
            const t: XML[] = tree({
                type: 'tag', name: 'choose', voidElement: false, attrs: {}, children: [
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'score >= 90' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'EXCELLENT' },
                    ] },
                    { type: 'tag', name: 'when', voidElement: false, attrs: { test: 'score >= 60' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'PASS' },
                    ] },
                    { type: 'tag', name: 'otherwise', voidElement: false, attrs: {}, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'FAIL' },
                    ] },
                ],
            });
            expect(convert(t, { score: 95 }, [], {})).toContain('EXCELLENT');
            expect(convert(t, { score: 75 }, [], {})).toContain('PASS');
            expect(convert(t, { score: 30 }, [], {})).toContain('FAIL');
        });
    });

    describe('trim', () => {
        it('trim 添加 prefix/suffix', () => {
            const t: XML[] = [{
                type: 'tag', name: 'trim', voidElement: false, attrs: { prefix: 'AND (', suffix: ')', prefixOverrides: 'AND|OR' }, children: [
                    { type: 'tag', name: 'if', voidElement: false, attrs: { test: 'name != null' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'AND name = #{name}' },
                    ] },
                ],
            }];
            const result = convert(t, { name: 'test' }, [], {});
            expect(result).toContain('AND (');
            expect(result).toContain(')');
        });

        it('trim 去除 prefixOverrides', () => {
            const t: XML[] = [{
                type: 'tag', name: 'trim', voidElement: false, attrs: { prefixOverrides: 'AND' }, children: [
                    { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: "AND name = 'test'" },
                ],
            }];
            const result = convert(t, {}, [], {});
            expect(result).toContain("name = 'test'");
        });

        it('trim 去除 suffixOverrides', () => {
            const t: XML[] = [{
                type: 'tag', name: 'trim', voidElement: false, attrs: { suffixOverrides: ',' }, children: [
                    { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: "name = 'test'," },
                ],
            }];
            const result = convert(t, {}, [], {});
            expect(result).not.toMatch(/,\s*$/);
        });
    });

    describe('set', () => {
        it('set 生成 SET 子句并去除末尾逗号', () => {
            const t: XML[] = [{
                type: 'tag', name: 'set', voidElement: false, attrs: {}, children: [
                    { type: 'tag', name: 'if', voidElement: false, attrs: { test: 'name != null' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'name = #{name},' },
                    ] },
                    { type: 'tag', name: 'if', voidElement: false, attrs: { test: 'age != null' }, children: [
                        { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'age = #{age},' },
                    ] },
                ],
            }];
            const result = convert(t, { name: 'test', age: 18 }, [], {});
            expect(result).toContain('SET');
            expect(result).toContain('name =');
            expect(result).toContain('age =');
            expect(result).not.toMatch(/,\s*$/);
        });
    });

    describe('bind', () => {
        it('bind 定义变量供后续使用', () => {
            const t: XML[] = [
                { type: 'tag', name: 'bind', voidElement: false, attrs: { name: 'pattern', value: "'%' + name + '%'" }, children: [] },
                { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'WHERE name LIKE #{pattern}' },
            ];
            const result = convert(t, { name: 'test' }, [], {});
            expect(result).toContain('LIKE');
        });
    });

    describe('foreach 扩展', () => {
        it('foreach 空集合不输出', () => {
            const t: XML[] = [{
                type: 'tag', name: 'foreach', voidElement: false, attrs: { collection: 'items', item: 'item', open: '(', close: ')', separator: ',' }, children: [
                    { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: '#{item}' },
                ],
            }];
            const result = convert(t, { items: [] }, [], {});
            expect(result).toBe('()');
        });

        it('foreach 单元素', () => {
            const t: XML[] = [{
                type: 'tag', name: 'foreach', voidElement: false, attrs: { collection: 'items', item: 'item', open: '(', close: ')', separator: ',' }, children: [
                    { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: '#{item}' },
                ],
            }];
            const result = convert(t, { items: [1] }, [], {});
            // 数值被转为字符串并加引号
            expect(result).toBe("('1')");
        });
    });

    describe('错误处理', () => {
        it('空数据对象不抛异常', () => {
            const t: XML[] = tree({
                type: 'tag', name: 'if', voidElement: false, attrs: { test: 'name != null' }, children: [
                    { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'content' },
                ],
            });
            const result = convert(t, {}, [], {});
            expect(result).toBeDefined();
        });

        it('if 命中时输出内容', () => {
            const t: XML[] = tree({
                type: 'tag', name: 'if', voidElement: false, attrs: { test: 'active == true' }, children: [
                    { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'ACTIVE_CONTENT' },
                ],
            });
            const result = convert(t, { active: true }, [], {});
            expect(result).toContain('ACTIVE_CONTENT');
        });

        it('if 未命中时不输出内容', () => {
            const t: XML[] = tree({
                type: 'tag', name: 'if', voidElement: false, attrs: { test: 'active == true' }, children: [
                    { type: 'text', name: '', voidElement: false, attrs: {}, children: [], content: 'ACTIVE_CONTENT' },
                ],
            });
            const result = convert(t, { active: false }, [], {});
            expect(result).not.toContain('ACTIVE_CONTENT');
        });
    });
});
