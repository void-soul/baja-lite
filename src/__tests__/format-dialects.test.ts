import { describe, it, expect } from 'bun:test';
import { DBType } from 'baja-lite-field';
import { format } from 'sql-formatter';
import { formatDialects } from '../../.test-build/db/dao/format-dialects.js';

describe('formatDialects 方言格式化器', () => {
    it('按 DBType 提供方言配置对象', () => {
        expect(typeof formatDialects[DBType.Sqlite]).toBe('object');
        expect(typeof formatDialects[DBType.Mysql]).toBe('object');
        expect(typeof formatDialects[DBType.Postgresql]).toBe('object');
    });
    it('可以格式化 SQL', () => {
        const out = format('SELECT  1  FROM user', { dialect: formatDialects[DBType.Sqlite] } as any);
        expect(typeof out).toBe('string');
        const norm = out.toLowerCase().replace(/\s+/g, ' ');
        expect(norm).toContain('select');
        expect(norm).toContain('from user');
    });
});
