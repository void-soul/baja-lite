/**
 * 数据库错误类
 * 用于统一数据库操作中的错误处理
 */
export class DatabaseError extends Error {
    constructor(
        message: string,
        public code: string,
        public sql?: string,
        public params?: any,
        public cause?: Error
    ) {
        super(message);
        this.name = 'DatabaseError';
        
        // 保持正确的堆栈跟踪
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DatabaseError);
        }
    }

    /**
     * 创建连接错误
     */
    static connection(message: string, cause?: Error): DatabaseError {
        return new DatabaseError(message, 'CONNECTION_ERROR', undefined, undefined, cause);
    }

    /**
     * 创建查询错误
     */
    static query(message: string, sql: string, params?: any, cause?: Error): DatabaseError {
        return new DatabaseError(message, 'QUERY_ERROR', sql, params, cause);
    }

    /**
     * 创建事务错误
     */
    static transaction(message: string, cause?: Error): DatabaseError {
        return new DatabaseError(message, 'TRANSACTION_ERROR', undefined, undefined, cause);
    }

    /**
     * 获取安全的错误信息（不包含敏感数据）
     */
    getSafeMessage(): string {
        return `${this.name} [${this.code}]: ${this.message}`;
    }
}

export const Throw = {
    if(test: boolean, message: string | Error | any) {
        if (test === true) this.now(message);
    },
    ifNot(test: boolean, message: string | Error | any) {
        if (test !== true) this.now(message);
    },
    now(message: string | Error | any) {
        throw typeof message === 'string' ? new Error(message) : message;
    }
};