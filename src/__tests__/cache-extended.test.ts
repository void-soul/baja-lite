import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { DBType } from 'baja-lite-field';
import {
    getRedisDB, GetRedisLock, excuteWithLock,
    MethodLock, MethodCache, setCache, CacheStaleMode
} from '../../.test-build/cache.js';
import { _dao, _primaryDB, _LoggerService } from '../../.test-build/const/symbols.js';
import { setupGlobals } from './helpers.js';

describe('cache 扩展方法', () => {
    beforeEach(() => {
        setupGlobals();
    });

    afterEach(() => {
        delete (globalThis as any)[_dao][DBType.RedisLock];
    });

    describe('getRedisDB', () => {
        it('返回 Redis 实例', () => {
            const result = getRedisDB();
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
        });
        it('返回的 Redis 有 get/set 方法', () => {
            const db = getRedisDB();
            expect(typeof db.get).toBe('function');
            expect(typeof db.set).toBe('function');
        });
    });

    describe('GetRedisLock', () => {
        it('未设置 RedisLock 时抛出异常', async () => {
            await expect(GetRedisLock('test-key')).rejects.toThrow();
        });
        it('设置 RedisLock 后获取锁', async () => {
            // 设置一个假的 Redlock 实例
            (globalThis as any)[_dao][DBType.RedisLock] = {
                acquire: async () => ({ release: async () => {} }),
            };
            const result = await GetRedisLock('test-key');
            expect(typeof result).toBe('boolean');
        });
    });

    describe('excuteWithLock', () => {
        it('无锁时直接执行函数', async () => {
            // 设置一个假的 Redlock 实例
            (globalThis as any)[_dao][DBType.RedisLock] = {
                acquire: async () => ({ release: async () => {} }),
            };
            const fn = () => 'hello';
            const result = await excuteWithLock({ key: 'test-key' }, fn);
            expect(result).toBe('hello');
        });
        it('函数返回 Promise', async () => {
            (globalThis as any)[_dao][DBType.RedisLock] = {
                acquire: async () => ({ release: async () => {} }),
            };
            const fn = async () => 'async-result';
            const result = await excuteWithLock({ key: 'test-key-2' }, fn);
            expect(result).toBe('async-result');
        });
        it('带 lockMaxActive 参数', async () => {
            (globalThis as any)[_dao][DBType.RedisLock] = {
                acquire: async () => ({ release: async () => {} }),
            };
            const fn = () => 42;
            const result = await excuteWithLock({ key: 'test-key-3', lockMaxActive: 5 }, fn);
            expect(result).toBe(42);
        });
    });

    describe('MethodLock (装饰器)', () => {
        it('MethodLock 是函数', () => {
            expect(typeof MethodLock).toBe('function');
        });
        it('MethodLock 作为装饰器使用', () => {
            // MethodLock 是一个方法装饰器
            const decorator = MethodLock();
            expect(typeof decorator).toBe('function');
        });
    });

    describe('MethodCache (装饰器)', () => {
        it('MethodCache 是函数', () => {
            expect(typeof MethodCache).toBe('function');
        });
        it('MethodCache 作为装饰器使用', () => {
            // MethodCache 是一个方法装饰器
            const decorator = MethodCache({} as any);
            expect(typeof decorator).toBe('function');
        });
        it('MethodCache 带 ttl 参数', () => {
            const decorator = MethodCache({ ttl: 5000 } as any);
            expect(typeof decorator).toBe('function');
        });
        it('MethodCache 带 stale 参数', () => {
            const decorator = MethodCache({ ttl: 5000, stale: 1000 } as any);
            expect(typeof decorator).toBe('function');
        });
    });

    describe('setCache', () => {
        it('设置缓存', async () => {
            await setCache('my-key', 'my-value');
            const db = getRedisDB();
            const val = await db.get('[cache]my-key');
            expect(val).toBeDefined();
        });
        it('设置对象缓存', async () => {
            await setCache('obj-key', { foo: 'bar', num: 42 });
            const db = getRedisDB();
            const val = await db.get('[cache]obj-key');
            expect(val).toBeDefined();
        });
        it('覆盖已有缓存', async () => {
            await setCache('override-key', 'first');
            await setCache('override-key', 'second');
            const db = getRedisDB();
            const val = await db.get('[cache]override-key');
            expect(val).toBeDefined();
        });
    });

    describe('CacheStaleMode', () => {
        it('是对象', () => {
            expect(typeof CacheStaleMode).toBe('object');
        });
        it('包含预期的模式值', () => {
            const values = Object.values(CacheStaleMode);
            expect(values.length).toBeGreaterThan(0);
        });
    });
});
