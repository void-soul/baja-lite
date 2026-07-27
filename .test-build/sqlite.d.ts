import { SqliteRemoteInterface } from './const/index.js';
export declare abstract class SqliteRemoteClass implements SqliteRemoteInterface {
    private dbList;
    /** 原始存放路径 */
    abstract getStoreName(dbName: string): string;
    /** 导入时，备份源文件路径 */
    abstract getBackName(dbName: string): string;
    abstract BetterSqlite3: any;
    /** 实现复制 */
    abstract cpSync(from: string, to: string, option?: {
        force: true;
    }): void;
    /**
     * 设置可执行权限
     ```
        const fd = openSync(dbPath, 1);
        fchmodSync(fd, 777);
        closeSync(fd);
     ```
     */
    abstract setMod(name: string): void;
    abstract trace: boolean;
    execute(inData: Uint8Array): Promise<Uint8Array>;
    pluck(inData: Uint8Array): Promise<Uint8Array>;
    get(inData: Uint8Array): Promise<Uint8Array>;
    raw(inData: Uint8Array): Promise<Uint8Array>;
    query(inData: Uint8Array): Promise<Uint8Array>;
    initDB(dbName: string): void;
    export(dbName: string, exportPath: string): Promise<void>;
    restore(dbName: string, importPath: string): void;
    close(dbName?: string): void;
}
