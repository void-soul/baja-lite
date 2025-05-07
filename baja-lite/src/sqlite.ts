import { SqliteRemoteInterface, extensionCodec, logger } from './sql.js';
import Sqlstring from 'sqlstring';
import { encode, decode } from "@msgpack/msgpack";
export abstract class SqliteRemoteClass implements SqliteRemoteInterface {
    private dbList: Record<string, any> = {};
    /** 原始存放路径 */
    abstract getStoreName(dbName: string): string;
    /** 导入时，备份源文件路径 */
    abstract getBackName(dbName: string): string;
    abstract BetterSqlite3: any;


    /** 实现复制 */
    abstract cpSync(from: string, to: string, option?: { force: true }): void;
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
    async execute(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        logger.debug(sql, params ?? '');
        try {
            if (!sql) { return encode({ affectedRows: 0, insertId: 0n }, { extensionCodec }); };
            if (this.trace) {
                logger.trace(Sqlstring.format(sql!, params));
            }
            const result = this.dbList[dbName].prepare(sql).run(params ?? {});
            if (this.trace) {
                logger.trace(result);
            }
            const { changes, lastInsertRowid } = result;
            return encode({ affectedRows: changes, insertId: lastInsertRowid ? BigInt(lastInsertRowid) : 0n }, { extensionCodec });
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    async pluck(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        logger.debug(sql, params ?? '');
        try {
            logger.debug(sql, params ?? '');
            if (!sql) { return encode(null) };
            if (this.trace) {
                logger.trace(Sqlstring.format(sql!, params));
            }
            return encode(this.dbList[dbName].prepare(sql).pluck().get(params ?? {}), { extensionCodec });
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    async get(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        logger.debug(sql, params ?? '');
        try {
            if (this.trace) {
                logger.trace(Sqlstring.format(sql!, params));
            }
            return encode(this.dbList[dbName].prepare(sql).get(params ?? {}), { extensionCodec });
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    async raw(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        logger.debug(sql, params ?? '');
        try {
            if (!sql) { return encode([]); };
            if (this.trace) {
                logger.trace(Sqlstring.format(sql!, params));
            }
            return encode(this.dbList[dbName].prepare(sql).raw().all(params ?? {}), { extensionCodec });
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    async query(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        logger.debug(sql, params ?? '');
        try {
            if (!sql) { encode([]); };
            if (this.trace) {
                logger.trace(Sqlstring.format(sql!, params));
            }
            return encode(this.dbList[dbName].prepare(sql).all(params ?? {}), { extensionCodec });
        } catch (error) {
            logger.error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    initDB(dbName: string) {
        if (!this.dbList[dbName]) {
            this.dbList[dbName] = new this.BetterSqlite3(this.getStoreName(dbName), { fileMustExist: false });
            this.dbList[dbName].pragma('journal_mode = WAL');
            this.dbList[dbName].exec(`
                CREATE TABLE IF NOT EXISTS DUAL ( ______id INTEGER NOT NULL, PRIMARY KEY ( ______id ));
                DELETE FROM DUAL;
                INSERT INTO DUAL (______id ) VALUES ( 1 );
                CREATE TABLE IF NOT EXISTS TABLE_VERSION (
                ______tableName text NOT NULL,
                ______version text NOT NULL,
                PRIMARY KEY ( ______tableName )
                );
            `);
        }
    }
    async export(dbName: string, exportPath: string): Promise<void> {
        await this.dbList[dbName].backup(exportPath);
    }
    restore(dbName: string, importPath: string) {
        if (this.dbList[dbName]) {
            this.dbList[dbName].close();
            this.dbList[dbName] = null;
        }
        const nn = this.getStoreName(dbName);
        this.cpSync(nn, this.getBackName(dbName));
        this.cpSync(importPath, nn, { force: true });
        this.setMod(nn);
        this.initDB(dbName);
    }
    close(dbName?: string) {
        if (dbName) {
            this.dbList[dbName]?.close();
            this.dbList[dbName] = null;
        } else {
            for (const db of Object.values(this.dbList)) {
                db?.close();
            }
            this.dbList = {};
        }
    }
}