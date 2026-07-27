import { describe, it, expect } from 'bun:test';
import * as types from '../const/types.js';

describe('probe3 const/types', () => {
    it('loads and exposes SyncMode/InsertMode enums', () => {
        expect(typeof types.SyncMode).toBe('object');
        expect(typeof types.InsertMode).toBe('object');
    });
});
