import { describe, it, expect } from 'bun:test';
import { BootRomote } from '../../.test-build/boot-remote.js';

describe('BootRomote 远程启动', () => {
    it('导出 BootRomote 函数', () => {
        expect(typeof BootRomote).toBe('function');
    });
});
