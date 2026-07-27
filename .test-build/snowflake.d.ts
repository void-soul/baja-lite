/**
 * 雪花算法 ID 生成器
 * 用于生成分布式唯一 ID
 */
export declare class Snowflake {
    private seq;
    private mid;
    private offset;
    private lastTime;
    constructor(options?: {
        mid?: number;
        offset?: number;
    });
    /**
     * 生成下一个唯一 ID
     * @returns 10 进制字符串形式的 ID，失败返回 null
     */
    generate(): string | null;
}
export declare const snowflake: Snowflake;
