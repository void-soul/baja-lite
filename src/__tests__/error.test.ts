import { describe, it, expect } from 'bun:test';
import { DatabaseError, Throw } from '../../.test-build/error.js';

describe('error', () => {
    it('DatabaseError 属性与 getSafeMessage', () => {
        const e = new DatabaseError('boom', 'QUERY_ERROR', 'SELECT 1', [1]);
        expect(e.name).toBe('DatabaseError');
        expect(e.code).toBe('QUERY_ERROR');
        expect(e.sql).toBe('SELECT 1');
        expect(e.getSafeMessage()).toContain('QUERY_ERROR');
        expect(e).toBeInstanceOf(Error);
    });
    it('DatabaseError 静态工厂', () => {
        expect(DatabaseError.connection('c').code).toBe('CONNECTION_ERROR');
        expect(DatabaseError.query('q', 'SQL').code).toBe('QUERY_ERROR');
        expect(DatabaseError.transaction('t').code).toBe('TRANSACTION_ERROR');
    });
    it('Throw.if / ifNot / now', () => {
        expect(() => Throw.if(true, 'msg')).toThrow(/msg/);
        expect(() => Throw.if(false, 'msg')).not.toThrow();
        expect(() => Throw.ifNot(false, 'msg2')).toThrow(/msg2/);
        expect(() => Throw.ifNot(true, 'msg2')).not.toThrow();
        const err = new Error('custom');
        expect(() => Throw.now(err)).toThrowError(err);
    });
});
