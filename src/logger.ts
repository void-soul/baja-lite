import pino, { Logger } from 'pino';

export declare const LOG_LEVELS: ["verbose", "debug", "info", "log", "warn", "error", "fatal"];
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LoggerService {
    /**
     * Write a 'log' level log.
     */
    log(message: any, ...optionalParams: any[]): any;
    info(message: any, ...optionalParams: any[]): any;
    /**
     * Write an 'error' level log.
     */
    error(message: any, ...optionalParams: any[]): any;
    /**
     * Write a 'warn' level log.
     */
    warn(message: any, ...optionalParams: any[]): any;
    /**
     * Write a 'debug' level log.
     */
    debug?(message: any, ...optionalParams: any[]): any;
    /**
     * Write a 'verbose' level log.
     */
    verbose?(message: any, ...optionalParams: any[]): any;
    /**
     * Write a 'fatal' level log.
     */
    fatal?(message: any, ...optionalParams: any[]): any;
    /**
     * Set log levels.
     * @param levels log levels
     */
    setLogLevels(levels: LogLevel[]): any;
}

export class PrinterLogger implements LoggerService {
    private logger: Logger;
    constructor() {
        this.logger = pino({
            name: 'app',
            transport: {
                target: 'pino-pretty',
            },
        });
    }
    log(message: any, ...optionalParams: any[]) {
        this.logger.info(message, ...optionalParams);
    }
    info(message: any, ...optionalParams: any[]) {
        this.logger.info(message, ...optionalParams);
    }
    fatal(message: any, ...optionalParams: any[]) {
        this.logger.fatal(message, ...optionalParams);
    }
    error(message: any, ...optionalParams: any[]) {
        this.logger.error(message, ...optionalParams);
    }
    warn(message: any, ...optionalParams: any[]) {
        this.logger.warn(message, ...optionalParams);
    }
    debug?(message: any, ...optionalParams: any[]) {
        this.logger.debug(message, ...optionalParams);
    }
    verbose?(message: any, ...optionalParams: any[]) {
        this.logger.trace(message, ...optionalParams);
    }
    setLogLevels(levels: LogLevel[]) {
        this.logger.level = levels.join(',');
    }
}
