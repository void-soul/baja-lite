import { decode, encode } from "@msgpack/msgpack";
import Sqlstring from 'sqlstring';
import { snowflake } from './snowflake.js';
import { LoggerService, SqliteRemoteInterface, _LoggerService, extensionCodec } from './sql.js';
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
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        try {
            if (!sql) { return encode({ affectedRows: 0, insertId: 0n }, { extensionCodec }); };
            if (this.trace) {
                (globalThis[_LoggerService]! as LoggerService).verbose?.(Sqlstring.format(sql!, params));
            }
            const result = this.dbList[dbName].prepare(sql).run(params ?? {});
            if (this.trace) {
                (globalThis[_LoggerService]! as LoggerService).verbose?.(result);
            }
            const { changes, lastInsertRowid } = result;
            return encode({ affectedRows: changes, insertId: lastInsertRowid ? BigInt(lastInsertRowid) : 0n }, { extensionCodec });
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    async pluck(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        try {
            (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
            if (!sql) { return encode(null) };
            (globalThis[_LoggerService]! as LoggerService).verbose?.(Sqlstring.format(sql!, params));
            return encode(this.dbList[dbName].prepare(sql).pluck().get(params ?? {}), { extensionCodec });
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    async get(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        try {
            if (this.trace) {
                (globalThis[_LoggerService]! as LoggerService).verbose?.(Sqlstring.format(sql!, params));
            }
            return encode(this.dbList[dbName].prepare(sql).get(params ?? {}), { extensionCodec });
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    async raw(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        try {
            if (!sql) { return encode([]); };
            if (this.trace) {
                (globalThis[_LoggerService]! as LoggerService).verbose?.(Sqlstring.format(sql!, params));
            }
            return encode(this.dbList[dbName].prepare(sql).raw().all(params ?? {}), { extensionCodec });
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
                error: ${error},
                sql: ${sql},
                params: ${params}
            `);
            throw error;
        }
    }
    async query(inData: Uint8Array): Promise<Uint8Array> {
        const [dbName, sql, params] = decode(inData) as [dbName: string, sql?: string | undefined, params?: any];
        (globalThis[_LoggerService]! as LoggerService).debug?.(sql, params ?? '');
        try {
            if (!sql) { encode([]); };
            if (this.trace) {
                (globalThis[_LoggerService]! as LoggerService).verbose?.(Sqlstring.format(sql!, params));
            }
            return encode(this.dbList[dbName].prepare(sql).all(params ?? {}), { extensionCodec });
        } catch (error) {
            (globalThis[_LoggerService]! as LoggerService).error(`
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
            this.dbList[dbName].function('UUID_SHORT', { deterministic: false }, () => snowflake.generate());
            this.dbList[dbName].function('UUID', { deterministic: false }, () => snowflake.generate());
            this.dbList[dbName].function('TIME_TO_SEC', { deterministic: true }, (time: string) => time.split(':').map((v, i) => parseInt(v) * (i === 0 ? 360 : i === 1 ? 60 : 0)).reduce((a, b) => a + b, 0));
            this.dbList[dbName].function('IF', { deterministic: true }, (condition: any, v1: any, v2: any) => condition ? v1 : v2);
            this.dbList[dbName].function('RIGHT', { deterministic: true }, (src: string, p: number) => src.slice(p * -1));
            this.dbList[dbName].function('LEFT', { deterministic: true }, (str: string, len: number) => str?.substring(0, len) || null);
            this.dbList[dbName].function('NOW', { deterministic: false }, () => new Date().toISOString().slice(0, 19).replace('T', ' '));
            this.dbList[dbName].function('CURDATE', { deterministic: false }, () => new Date().toISOString().split('T')[0]);
            this.dbList[dbName].function('DATE_FORMAT', { deterministic: true }, (dateStr: string, format: string) => {
                const date = new Date(dateStr);
                return format
                    .replace('%Y', date.getFullYear().toString())
                    .replace('%m', (date.getMonth() + 1).toString().padStart(2, '0'))
                    .replace('%d', date.getDate().toString().padStart(2, '0'))
                    .replace('%H', date.getHours().toString().padStart(2, '0'))
                    .replace('%i', date.getMinutes().toString().padStart(2, '0'))
                    .replace('%s', date.getSeconds().toString().padStart(2, '0'));
            });
            this.dbList[dbName].function('RAND', { deterministic: false }, () => Math.random());
            this.dbList[dbName].function('UNIX_TIMESTAMP', { deterministic: false },
                (dateStr?: string) => dateStr
                    ? Math.floor(new Date(dateStr).getTime() / 1000)
                    : Math.floor(Date.now() / 1000)
            );
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