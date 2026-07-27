/**
 * 数据库错误类
 * 用于统一数据库操作中的错误处理
 */
export declare class DatabaseError extends Error {
    code: string;
    sql?: string | undefined;
    params?: any | undefined;
    cause?: Error | undefined;
    constructor(message: string, code: string, sql?: string | undefined, params?: any | undefined, cause?: Error | undefined);
    /**
     * 创建连接错误
     */
    static connection(message: string, cause?: Error): DatabaseError;
    /**
     * 创建查询错误
     */
    static query(message: string, sql: string, params?: any, cause?: Error): DatabaseError;
    /**
     * 创建事务错误
     */
    static transaction(message: string, cause?: Error): DatabaseError;
    /**
     * 获取安全的错误信息（不包含敏感数据）
     */
    getSafeMessage(): string;
}
export declare const Throw: {
    if(test: boolean, message: string | Error | any): void;
    ifNot(test: boolean, message: string | Error | any): void;
    now(message: string | Error | any): never;
};
