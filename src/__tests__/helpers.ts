import { Field, SqlType, DBType, _Hump } from 'baja-lite-field';
import { ColumnMode, _GlobalSqlOption, _dao, _LoggerService, _sqlCache, _primaryDB } from '../../.test-build/const/index.js';
import { SqlCache } from '../../.test-build/db/sql-template.js';
import { PrinterLogger } from '../../.test-build/logger.js';

export { SqlType, DBType, ColumnMode, _Hump };

/**
 * 不依赖任何原生模块的“假 DAO”，用于在没有 better-sqlite3 / mysql 真实驱动的情况下
 * 验证 SqlService / StreamQuery 生成的 SQL。它会把所有执行的 SQL 与参数记录下来，
 * 以便断言（追加法：allSqls 保留全部 SQL，lastSql / lastParams 为最近一次）。
 */
export class FakeDao {
    lastSql = '';
    allSqls: string[] = [];
    lastParams: any[] = [];

    createConnection(_sync?: any) {
        return makeFakeConn(this);
    }
    release(_sync?: any) {}
    transaction(_sync?: any, fn?: any, conn?: any) {
        return fn(conn ?? this.createConnection(_sync));
    }
    close(_sync?: any) {}
    execute(_sync?: any, sql?: string, params?: any) {
        this._rec(sql, params);
        return { affectedRows: 1, insertId: 1 };
    }
    query(_sync?: any, sql?: string, params?: any) {
        this._rec(sql, params);
        return [];
    }
    pluck(_sync?: any, sql?: string, params?: any) {
        this._rec(sql, params);
        return null;
    }
    get(_sync?: any, sql?: string, params?: any) {
        this._rec(sql, params);
        return null;
    }
    raw(_sync?: any, sql?: string, params?: any) {
        this._rec(sql, params);
        return [];
    }
    _rec(sql?: string, params?: any) {
        if (sql) {
            this.lastSql = sql;
            this.allSqls.push(sql);
        }
        if (params != null) {
            this.lastParams.push(...(Array.isArray(params) ? params : [params]));
        }
    }
}

function makeFakeConn(dao: FakeDao) {
    return {
        execute: (s: any, sql?: string, p?: any) => dao.execute(s, sql, p),
        query: (s: any, sql?: string, p?: any) => dao.query(s, sql, p),
        pluck: (s: any, sql?: string, p?: any) => dao.pluck(s, sql, p),
        get: (s: any, sql?: string, p?: any) => dao.get(s, sql, p),
        raw: (s: any, sql?: string, p?: any) => dao.raw(s, sql, p),
        release: (_s?: any) => {},
    };
}

export function makeFakeRedis() {
    const store = new Map<string, any>();
    return {
        get: async (k: string) => (store.has(k) ? store.get(k) : null),
        set: async (k: string, v: any) => {
            store.set(k, v);
            return 'OK';
        },
        setex: async (k: string, _t: number, v: any) => {
            store.set(k, v);
            return 'OK';
        },
        del: async (k: string) => {
            store.delete(k);
            return 1;
        },
        sadd: async (k: string, ...m: any[]) => {
            const s = store.get(k) ?? new Set();
            m.forEach((x) => s.add(x));
            store.set(k, s);
            return m.length;
        },
        smembers: async (k: string) => {
            const s = store.get(k);
            return s ? Array.from(s) : [];
        },
        srem: async (k: string, ...m: any[]) => {
            const s = store.get(k);
            if (s) m.forEach((x) => s.delete(x));
            return m.length;
        },
        type: async (k: string) => (store.has(k) ? 'string' : 'none'),
        ttl: async (_k: string) => -1,
        incr: async (k: string) => {
            const n = (store.get(k) ?? 0) + 1;
            store.set(k, n);
            return n;
        },
        decr: async (k: string) => {
            const n = (store.get(k) ?? 0) - 1;
            store.set(k, n);
            return n;
        },
        psubscribe: async () => ({}),
        publish: async () => 1,
        eval: async () => [0, 0],
        pexpire: async (_k: string, _ms: number) => 1,
        expire: async (_k: string, _s: number) => 1,
    };
}

/**
 * 通过 @Field 装饰器在类原型上声明字段，使其被 Reflect.getMetadata 记录
 * （DB 装饰器正是通过 Reflect.getMetadata 读取 _ids/_fields/_columns 等）。
 * 这是与 DeclareClass 不同的“正确”声明方式，能让 SqlService 正常生成 SQL。
 */
export function declareModel(clz: any, defs: Array<{ prop: string; type?: any; id?: boolean; [k: string]: any }>) {
    for (const d of defs) {
        Field(d)(clz.prototype, d.prop);
    }
}

/** 把测试所需的全局符号、假 DAO 与假 Redis 安装到 globalThis 上。 */
export function setupGlobals() {
    const g = globalThis as any;
    g[_GlobalSqlOption] = Object.assign(g[_GlobalSqlOption] ?? {}, {
        columnMode: ColumnMode.HUMP,
        dbType: DBType.Sqlite,
        dbName: 'test_db',
        skipEmptyString: true,
        skipNull: true,
    });
    g[_Hump] = true;
    if (!g[_LoggerService]) g[_LoggerService] = new PrinterLogger();
    if (!g[_sqlCache]) g[_sqlCache] = new SqlCache();
    g[_dao] = g[_dao] ?? {};
    for (const t of [DBType.Mysql, DBType.Postgresql, DBType.Sqlite, DBType.SqliteRemote, DBType.Redis]) {
        g[_dao][t] = g[_dao][t] ?? {};
    }
    const fake = new FakeDao();
    g[_dao][DBType.Sqlite]['test_db'] = fake;
    g[_dao][DBType.Sqlite][_primaryDB] = fake;
    if (!g[_dao][DBType.Redis][_primaryDB]) {
        g[_dao][DBType.Redis][_primaryDB] = makeFakeRedis();
    }
    return { _GlobalSqlOption, _dao, _LoggerService, _Hump, _sqlCache, _primaryDB, dao: fake };
}
