import { describe, it, expect } from 'bun:test';
import {
    SelectResult, TemplateResult, SyncMode, InsertMode, DeleteMode,
    SelectMode, ColumnMode, MapperIfUndefined, StorageType,
    SqliteMemory, _defOption
} from '../../.test-build/const/index.js';
import {
    _memInflight, _path, _fs, _EventBus, _DataConvert, _Context,
    _MysqlKeepAliveTime, _resultMap, _resultMap_SQLID, _enum,
    _GlobalSqlOption, _LoggerService, _daoConnection, _daoDB,
    _inTransaction, _sqliteRemoteName, _SqlOption, _dbType, _sqlite_version,
    _primaryDB
} from '../../.test-build/const/symbols.js';

describe('const/index 枚举和类型', () => {
    describe('SelectResult 枚举', () => {
        it('SelectResult 是对象', () => {
            expect(typeof SelectResult).toBe('object');
        });
        it('SelectResult 有 6 个值', () => {
            expect(SelectResult.R_C_Assert).toBeDefined();
            expect(SelectResult.R_C_NotSure).toBeDefined();
            expect(SelectResult.R_CS_Assert).toBeDefined();
            expect(SelectResult.R_CS_NotSure).toBeDefined();
            expect(SelectResult.RS_C).toBeDefined();
            expect(SelectResult.RS_CS).toBeDefined();
        });
    });

    describe('TemplateResult 枚举', () => {
        it('TemplateResult 是对象', () => {
            expect(typeof TemplateResult).toBe('object');
        });
        it('TemplateResult 有 4 个值', () => {
            expect(TemplateResult.AssertOne).toBeDefined();
            expect(TemplateResult.NotSureOne).toBeDefined();
            expect(TemplateResult.Many).toBeDefined();
            expect(TemplateResult.Count).toBeDefined();
        });
    });

    describe('SyncMode 枚举', () => {
        it('SyncMode.Sync = 0', () => {
            expect(SyncMode.Sync).toBe(0);
        });
        it('SyncMode.Async = 1', () => {
            expect(SyncMode.Async).toBe(1);
        });
    });

    describe('InsertMode 枚举', () => {
        it('InsertMode 有 4 个值', () => {
            expect(InsertMode.Insert).toBeDefined();
            expect(InsertMode.InsertWithTempTable).toBeDefined();
            expect(InsertMode.InsertIfNotExists).toBeDefined();
            expect(InsertMode.Replace).toBeDefined();
        });
    });

    describe('DeleteMode 枚举', () => {
        it('DeleteMode 有 2 个值', () => {
            expect(DeleteMode.Common).toBeDefined();
            expect(DeleteMode.TempTable).toBeDefined();
        });
    });

    describe('SelectMode 枚举', () => {
        it('SelectMode 有 2 个值', () => {
            expect(SelectMode.Common).toBeDefined();
            expect(SelectMode.TempTable).toBeDefined();
        });
    });

    describe('ColumnMode 枚举', () => {
        it('ColumnMode.NONE = 0', () => {
            expect(ColumnMode.NONE).toBe(0);
        });
        it('ColumnMode.HUMP = 1', () => {
            expect(ColumnMode.HUMP).toBe(1);
        });
    });

    describe('MapperIfUndefined 枚举', () => {
        it('MapperIfUndefined 有 4 个值', () => {
            expect(MapperIfUndefined.Null).toBeDefined();
            expect(MapperIfUndefined.Skip).toBeDefined();
            expect(MapperIfUndefined.Zero).toBeDefined();
            expect(MapperIfUndefined.EmptyString).toBeDefined();
        });
    });

    describe('StorageType 枚举', () => {
        it('StorageType.Redis = 0', () => {
            expect(StorageType.Redis).toBe(0);
        });
        it('StorageType.Memory = 1', () => {
            expect(StorageType.Memory).toBe(1);
        });
    });

    describe('SqliteMemory 常量', () => {
        it('SqliteMemory = ":memory:"', () => {
            expect(SqliteMemory).toBe(':memory:');
        });
    });

    describe('_defOption 常量', () => {
        it('_defOption 有默认值', () => {
            expect(_defOption).toBeDefined();
            expect(typeof _defOption).toBe('object');
        });
    });
});

describe('const/symbols 符号', () => {
    it('_memInflight 是 symbol', () => { expect(typeof _memInflight).toBe('symbol'); });
    it('_path 是 symbol', () => { expect(typeof _path).toBe('symbol'); });
    it('_fs 是 symbol', () => { expect(typeof _fs).toBe('symbol'); });
    it('_EventBus 是 symbol', () => { expect(typeof _EventBus).toBe('symbol'); });
    it('_DataConvert 是 symbol', () => { expect(typeof _DataConvert).toBe('symbol'); });
    it('_Context 是 symbol', () => { expect(typeof _Context).toBe('symbol'); });
    it('_MysqlKeepAliveTime 是 symbol', () => { expect(typeof _MysqlKeepAliveTime).toBe('symbol'); });
    it('_resultMap 是 symbol', () => { expect(typeof _resultMap).toBe('symbol'); });
    it('_resultMap_SQLID 是 symbol', () => { expect(typeof _resultMap_SQLID).toBe('symbol'); });
    it('_enum 是 symbol', () => { expect(typeof _enum).toBe('symbol'); });
    it('_GlobalSqlOption 是 symbol', () => { expect(typeof _GlobalSqlOption).toBe('symbol'); });
    it('_LoggerService 是 symbol', () => { expect(typeof _LoggerService).toBe('symbol'); });
    it('_daoConnection 是 symbol', () => { expect(typeof _daoConnection).toBe('symbol'); });
    it('_daoDB 是 symbol', () => { expect(typeof _daoDB).toBe('symbol'); });
    it('_inTransaction 是 symbol', () => { expect(typeof _inTransaction).toBe('symbol'); });
    it('_sqliteRemoteName 是 symbol', () => { expect(typeof _sqliteRemoteName).toBe('symbol'); });
    it('_SqlOption 是 symbol', () => { expect(typeof _SqlOption).toBe('symbol'); });
    it('_dbType 是 symbol', () => { expect(typeof _dbType).toBe('symbol'); });
    it('_sqlite_version 是 symbol', () => { expect(typeof _sqlite_version).toBe('symbol'); });
    it('_primaryDB 是 string', () => { expect(typeof _primaryDB).toBe('string'); });

    it('所有 symbol 唯一', () => {
        const symbols = [
            _memInflight, _path, _fs, _EventBus, _DataConvert, _Context,
            _MysqlKeepAliveTime, _resultMap, _resultMap_SQLID, _enum,
            _GlobalSqlOption, _LoggerService, _daoConnection, _daoDB,
            _inTransaction, _sqliteRemoteName, _SqlOption, _dbType, _sqlite_version
        ];
        const unique = new Set(symbols.map(s => s.toString()));
        expect(unique.size).toBe(symbols.length);
    });
});
