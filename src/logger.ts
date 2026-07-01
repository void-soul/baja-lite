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
export const LOG_LEVELS = ["verbose", "sql", "cache", "debug", "info", "log", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LoggerService {
    log(message: any, ...optionalParams: any[]): any;
    info(message: any, ...optionalParams: any[]): any;
    error(message: any, ...optionalParams: any[]): any;
    warn(message: any, ...optionalParams: any[]): any;
    /** 分类调试日志：debugCategory('sql', 'SELECT ...') / debugCategory('cache', 'hit key') */
    debugCategory?(category: 'sql' | 'cache', message: any, ...optionalParams: any[]): any;
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
export class PrinterLogger implements LoggerService {
    private activeLevels: LogLevel[] = ['info'];

    constructor(private options?: { prefix?: string }) {}

    /** @internal 设置日志等级（同级别多次调用以兼容 NestJS ConsoleLogger 行为） */
    setLogLevels(levels: LogLevel[]) {
        this.activeLevels = levels;
    }

    private _shouldLog(level: 'debug' | 'verbose' | 'log' | 'warn' | 'error' | 'fatal'): boolean {
        if (this.activeLevels.includes('debug')) {
            // debug 包含所有子等级（sql/cache）
            return level === 'debug' || level === 'verbose' || level === 'log' || level === 'warn' || level === 'error' || level === 'fatal';
        }
        if (this.activeLevels.includes('sql') || this.activeLevels.includes('cache')) {
            // 只看分类日志 + warn/error/fatal
            return level === 'warn' || level === 'error' || level === 'fatal';
        }
        // 标准等级
        const STANDARD_LEVELS = ['verbose', 'debug', 'info', 'log', 'warn', 'error', 'fatal'] as const;
        const idx = STANDARD_LEVELS.findIndex(l => l === this.activeLevels[0]);
        const activeIdx = idx === -1 ? 4 : idx;  // 默认 info
        const levelIdx = STANDARD_LEVELS.findIndex(l => l === level);
        return levelIdx >= activeIdx;
    }

    private _format(level: string, message: any, ...optionalParams: any[]): string {
        const ts = new Date().toISOString().replace('T', ' ').slice(0, 23);  // 2026-07-02 17:27:27.013
        const prefix = this.options?.prefix ? `[${this.options.prefix}]` : '';
        const params = optionalParams.length
            ? ' ' + optionalParams.map(p => typeof p === 'object' ? JSON.stringify(p) : String(p)).join(' ')
            : '';
        return `[${ts}] [${level.toUpperCase()}] ${prefix} ${message}${params}`;
    }

    log(message: any, ...optionalParams: any[]) {
        if (!this._shouldLog('log')) return;
        process.stdout.write(this._format('info', message, ...optionalParams) + '\n');
    }
    info(message: any, ...optionalParams: any[]) { this.log(message, ...optionalParams); }
    fatal(message: any, ...optionalParams: any[]) {
        if (!this._shouldLog('fatal')) return;
        process.stdout.write(this._format('fatal', message, ...optionalParams) + '\n');
    }
    error(message: any, ...optionalParams: any[]) {
        if (!this._shouldLog('error')) return;
        process.stdout.write(this._format('error', message, ...optionalParams) + '\n');
    }
    warn(message: any, ...optionalParams: any[]) {
        if (!this._shouldLog('warn')) return;
        process.stdout.write(this._format('warn', message, ...optionalParams) + '\n');
    }
    debug(message: any, ...optionalParams: any[]) {
        if (!this._shouldLog('debug')) return;
        process.stdout.write(this._format('debug', message, ...optionalParams) + '\n');
    }
    verbose(message: any, ...optionalParams: any[]) {
        if (!this._shouldLog('verbose')) return;
        process.stdout.write(this._format('trace', message, ...optionalParams) + '\n');
    }

    /**
     * 分类调试日志。当 setLogLevels 中启用对应分类时才输出。
     *
     * @example
     *   this.debugCategory('sql', 'SELECT * FROM user WHERE id = ?', params);
     *   this.debugCategory('cache', 'memcache hit (device001)');
     */
    debugCategory(category: 'sql' | 'cache', message: any, ...optionalParams: any[]) {
        if (!this.activeLevels.includes(category) && !this.activeLevels.includes('debug')) return;
        const ts = new Date().toISOString().replace('T', ' ').slice(0, 23);  // 2026-07-02 17:27:27.013
        const params = optionalParams.length
            ? ' ' + optionalParams.map(p => typeof p === 'object' ? JSON.stringify(p) : String(p)).join(' ')
            : '';
        const line = `[${ts}] [${category.toUpperCase()}] ${this.options?.prefix ? '[' + this.options.prefix + '] ' : ''}${message}${params}`;
        process.stdout.write(line + '\n');
    }
}
