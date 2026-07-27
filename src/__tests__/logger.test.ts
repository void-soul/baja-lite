import { describe, it, expect } from 'bun:test';
import { PrinterLogger } from '../../.test-build/logger.js';

function captureStdout(fn: () => void): string {
    const orig = process.stdout.write.bind(process.stdout);
    let out = '';
    // @ts-expect-error 临时替换
    process.stdout.write = (chunk: any) => { out += chunk; return true; };
    try { fn(); } finally { process.stdout.write = orig; }
    return out;
}

describe('logger', () => {
    it('PrinterLogger 等级过滤', () => {
        const l = new PrinterLogger();
        l.setLogLevels(['info']);
        expect(captureStdout(() => l.debug('d'))).not.toContain('d');
        expect(captureStdout(() => l.warn('w'))).toContain('WARN');
        expect(captureStdout(() => l.error('e'))).toContain('ERROR');
        l.setLogLevels(['debug']);
        expect(captureStdout(() => l.debug('d2'))).toContain('DEBUG');
    });
    it('PrinterLogger debugCategory 分类过滤', () => {
        const l = new PrinterLogger();
        l.setLogLevels(['sql']);
        expect(captureStdout(() => l.debugCategory('sql', 'SELECT 1'))).toContain('SELECT 1');
        expect(captureStdout(() => l.debugCategory('cache', 'hit'))).not.toContain('hit');
        l.setLogLevels(['debug']);
        expect(captureStdout(() => l.debugCategory('cache', 'hit2'))).toContain('hit2');
    });
});
