import { describe, it, expect } from 'bun:test';
import { DBType } from 'baja-lite-field';
import {
    SyncMode, InsertMode, DeleteMode, SelectMode, MapperIfUndefined, ColumnMode,
} from '../../.test-build/const/index.js';

describe('const', () => {
    it('同步模式枚举', () => {
        expect(SyncMode.Sync).toBe(0);
        expect(SyncMode.Async).toBe(1);
        expect(SyncMode[0]).toBe('Sync');
        expect(SyncMode[1]).toBe('Async');
    });
    it('插入模式枚举', () => {
        expect(InsertMode.Insert).toBe(0);
        expect(InsertMode.InsertWithTempTable).toBe(1);
        expect(InsertMode.InsertIfNotExists).toBe(2);
        expect(InsertMode.Replace).toBe(3);
    });
    it('删除/查询/映射枚举', () => {
        expect(DeleteMode.Common).toBe(0);
        expect(DeleteMode.TempTable).toBe(1);
        expect(SelectMode.Common).toBe(0);
        expect(SelectMode.TempTable).toBe(1);
        expect(MapperIfUndefined.Null).toBe(0);
        expect(MapperIfUndefined.Skip).toBe(1);
        expect(MapperIfUndefined.Zero).toBe(2);
        expect(MapperIfUndefined.EmptyString).toBe(3);
    });
    it('ColumnMode', () => {
        expect(ColumnMode.NONE).toBe(0);
        expect(ColumnMode.HUMP).toBe(1);
    });
    it('DBType（来自 baja-lite-field）', () => {
        for (const k of ['Mysql', 'Postgresql', 'Sqlite', 'SqliteRemote', 'Redis', 'Mongo'] as const) {
            expect(DBType[k]).toBeDefined();
        }
        expect(DBType.Sqlite).toBeTruthy();
    });
});
