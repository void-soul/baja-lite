import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PrinterLogger, LOG_LEVELS, LoggerService } from '../../.test-build/logger.js';

describe('logger 扩展方法', () => {
    let logger: PrinterLogger;

    beforeEach(() => {
        logger = new PrinterLogger();
    });

    describe('PrinterLogger 实例方法', () => {
        it('PrinterLogger 有 log 方法', () => {
            expect(typeof logger.log).toBe('function');
        });
        it('PrinterLogger 有 info 方法', () => {
            expect(typeof logger.info).toBe('function');
        });
        it('PrinterLogger 有 warn 方法', () => {
            expect(typeof logger.warn).toBe('function');
        });
        it('PrinterLogger 有 error 方法', () => {
            expect(typeof logger.error).toBe('function');
        });
        it('PrinterLogger 有 fatal 方法', () => {
            expect(typeof logger.fatal).toBe('function');
        });
        it('PrinterLogger 有 verbose 方法', () => {
            expect(typeof logger.verbose).toBe('function');
        });
        it('PrinterLogger 有 debug 方法', () => {
            expect(typeof logger.debug).toBe('function');
        });
    });

    describe('PrinterLogger 方法调用', () => {
        it('log 方法不抛异常', () => {
            expect(() => logger.log('log message')).not.toThrow();
        });
        it('info 方法不抛异常', () => {
            expect(() => logger.info('info message')).not.toThrow();
        });
        it('warn 方法不抛异常', () => {
            expect(() => logger.warn('warn message')).not.toThrow();
        });
        it('error 方法不抛异常', () => {
            expect(() => logger.error('error message')).not.toThrow();
        });
        it('error 方法接受 Error 对象', () => {
            expect(() => logger.error(new Error('something went wrong'))).not.toThrow();
        });
        it('fatal 方法不抛异常', () => {
            expect(() => logger.fatal('fatal message')).not.toThrow();
        });
        it('verbose 方法不抛异常', () => {
            expect(() => logger.verbose('verbose message')).not.toThrow();
        });
        it('debug 方法不抛异常', () => {
            expect(() => logger.debug('debug message')).not.toThrow();
        });
    });

    describe('PrinterLogger 带参数调用', () => {
        it('info 带多个参数', () => {
            expect(() => logger.info('user {} logged in at {}', 'alice', '10:00')).not.toThrow();
        });
        it('warn 带参数', () => {
            expect(() => logger.warn('disk usage {}%', 90)).not.toThrow();
        });
        it('error 带参数', () => {
            expect(() => logger.error('failed to connect to {}', 'localhost')).not.toThrow();
        });
        it('verbose 带对象参数', () => {
            expect(() => logger.verbose('details: {}', { a: 1 })).not.toThrow();
        });
    });

    describe('LOG_LEVELS 常量', () => {
        it('LOG_LEVELS 是数组', () => {
            expect(Array.isArray(LOG_LEVELS)).toBe(true);
        });
        it('LOG_LEVELS 包含所有级别', () => {
            expect(LOG_LEVELS).toContain('verbose');
            expect(LOG_LEVELS).toContain('sql');
            expect(LOG_LEVELS).toContain('cache');
            expect(LOG_LEVELS).toContain('debug');
            expect(LOG_LEVELS).toContain('info');
            expect(LOG_LEVELS).toContain('log');
            expect(LOG_LEVELS).toContain('warn');
            expect(LOG_LEVELS).toContain('error');
            expect(LOG_LEVELS).toContain('fatal');
            expect(LOG_LEVELS).toContain('event');
        });
        it('LOG_LEVELS 有 10 个级别', () => {
            expect(LOG_LEVELS.length).toBe(10);
        });
    });

    describe('PrinterLogger 构造选项', () => {
        it('创建带 prefix 的 PrinterLogger', () => {
            const prefixed = new PrinterLogger({ prefix: '[MyApp]' });
            expect(prefixed).toBeDefined();
            expect(() => prefixed.info('test')).not.toThrow();
        });
        it('创建带空 prefix 的 PrinterLogger', () => {
            const prefixed = new PrinterLogger({ prefix: '' });
            expect(prefixed).toBeDefined();
            expect(() => prefixed.info('test')).not.toThrow();
        });
        it('创建带 level 的 PrinterLogger', () => {
            const leveled = new PrinterLogger({ level: 'warn' });
            expect(leveled).toBeDefined();
            expect(() => leveled.warn('test')).not.toThrow();
        });
    });
});
