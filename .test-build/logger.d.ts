/**
 * 扩展日志等级（在标准 debug/info/warn/error/fatal 之外增加分类 debug）。
 *
 * 启用方式：
 * - log: ['sql']       只看 SQL 语句（info/warn/error 照常输出）
 * - log: ['cache']     只看缓存 debug
 * - log: ['sql','cache'] 同时看 SQL 和缓存
 * - log: ['debug']     看所有 debug（包括 sql/cache）
 * - log: ['info']      标准行为，只看 info+
 */
export declare const LOG_LEVELS: readonly ["verbose", "sql", "cache", "debug", "info", "log", "warn", "error", "fatal", "event"];
export type LogLevel = (typeof LOG_LEVELS)[number];
export interface LoggerService {
    log(message: any, ...optionalParams: any[]): any;
    info(message: any, ...optionalParams: any[]): any;
    error(message: any, ...optionalParams: any[]): any;
    warn(message: any, ...optionalParams: any[]): any;
    /** 分类调试日志：debugCategory('sql', 'SELECT ...') / debugCategory('cache', 'hit key') / debugCategory('event', '...') */
    debugCategory?(category: 'sql' | 'cache' | 'event', message: any, ...optionalParams: any[]): any;
    debug?(message: any, ...optionalParams: any[]): any;
    verbose?(message: any, ...optionalParams: any[]): any;
    fatal?(message: any, ...optionalParams: any[]): any;
    setLogLevels(levels: LogLevel[]): any;
}
/**
 * baja-lite 专用 Logger。接口兼容 NestJS LoggerService，可直接在 NestJS 项目中替换使用。
 *
 * 特性：
 * 1. 完全兼容 NestJS LoggerService 接口（log/info/error/warn/debug/verbose/setLogLevels）
 * 2. 新增 debugCategory(category, message) 支持分类过滤（sql / cache）
 * 3. 日志通过 process.stdout 写出，PM2 / Docker 等外部日志收集器可正常捕获
 * 4. 不依赖 pino/pino-pretty，无 worker thread 序列化问题
 *
 * @example
 * ```ts
 * // 直接替换 NestJS Logger
 * import { PrinterLogger } from 'baja-lite';
 *
 * @Global()
 * @Module({ providers: [PrinterLogger] as any, exports: [PrinterLogger] })
 * export class LoggerModule {}
 *
 * // boot.ts
 * import { Boot } from 'baja-lite';
 * Boot({ log: ['cache'], logger: new PrinterLogger({ prefix: 'app' }) });
 * ```
 */
export declare class PrinterLogger implements LoggerService {
    private options?;
    private activeLevels;
    constructor(options?: {
        prefix?: string;
    } | undefined);
    /** @internal 设置日志等级（同级别多次调用以兼容 NestJS ConsoleLogger 行为） */
    setLogLevels(levels: LogLevel[]): void;
    private _shouldLog;
    private _format;
    log(message: any, ...optionalParams: any[]): void;
    info(message: any, ...optionalParams: any[]): void;
    fatal(message: any, ...optionalParams: any[]): void;
    error(message: any, ...optionalParams: any[]): void;
    warn(message: any, ...optionalParams: any[]): void;
    debug(message: any, ...optionalParams: any[]): void;
    verbose(message: any, ...optionalParams: any[]): void;
    /**
     * 分类调试日志。当 setLogLevels 中启用对应分类时才输出。
     *
     * @example
     *   this.debugCategory('sql', 'SELECT * FROM user WHERE id = ?', params);
     *   this.debugCategory('cache', 'memcache hit (device001)');
     */
    debugCategory(category: 'sql' | 'cache' | 'event', message: any, ...optionalParams: any[]): void;
}
