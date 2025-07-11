#!/usr/bin/env node
import fs from 'fs';
import mustache from 'mustache';
import { createPool } from 'mysql2/promise';
import path from 'path';
import { start } from 'repl';
import pkg from 'shelljs';
const { mkdir } = pkg;
const lxMap = {
    tinyint: "number",
    smallint: "number",
    mediumint: "number",
    int: "number",
    integer: "number",
    bigint: "number",
    bit: "boolean",
    double: "number",
    real: "number",
    float: "number",
    decimal: "number",
    numeric: "number",
    char: "string",
    varchar: "string",
    date: "Date",
    time: "string",
    year: "string",
    timestamp: "number",
    datetime: "Date",
    tinyblob: "string",
    blob: "string",
    mediumblob: "string",
    longblob: "string",
    tinytext: "string",
    text: "string",
    mediumtext: "string",
    longtext: "string",
    enum: "string",
    set: "string",
    binary: "string",
    varbinary: "string",
    point: "Object",
    linestring: "Object",
    polygon: "Object",
    geometry: "string",
    multipoint: "Object",
    multilinestring: "Object",
    multipolygon: "Object",
    geometrycollection: "Object"
};
let force = false;
let basepath = path.join(import.meta.dirname, '..', '..');
try {
    fs.statSync(`${basepath}/baja.code.json`);
} catch (error) {
    basepath = path.join(import.meta.dirname, '..', '..', '..', '..', '..');
}
const config = path.join(basepath, 'baja.code.json');
const templatePath = path.join(basepath, 'code-template');
console.log(`
    **********************-----------
    配置文件：
    请在项目根目录添加文件:baja.code.json!配置示例:
    {
        "host": "",
        "port": "",
        "user": "",
        "password": "",
        "database": "",

        "command": {
			"entity": "src/{vueName}/{vueName}.entity.ts",
			"controller": "src/{vueName}/{vueName}.controller.ts",
			"service": "src/{vueName}/{vueName}.service.ts",
			"sql": "src/sql/{vueName}.mu",
			"module": "src/{vueName}/{vueName}.module.ts"
		},
        "commands": {
            "s": ["entity", "controller", "service", "sql", "module"]
        }
        "commands": {
            "s": ["entity", "controller", "service", "sql", "module"]
        },
        "output": "{ClassName}Module",
        "id"? : "uuidShort: true, notNull: true, uuid: true",
        "logicDeleteK"?: "逻辑删除字段名",
        "logicDeleteV"?: "逻辑删除值",如果是字符串需要这样 logicDeleteV: "'0'"
        "NotlogicDeleteV"?: "未逻辑删除值",如果是字符串需要这样 NotlogicDeleteV: "'0'",
        "skipColumns"?: ["跳过的列名1", "跳过的列名2"],
        "custom"?: (列名:string) => string; 该属性支持为每个数据库列自定义一个名称，例如 字段名为 ci_name 可通过custom改造为 Ci Name
    }
    command是生成命令，这里声明命令同时定义文件生成路径:可用下面的变量替换.同时必须有同名模板.
    路径是相对于项目根目录的
    commands是组合命令,上面表示输入s，同时生成："entity", "controller", "service", "sql", "module"
    output 是生成后打印出的内容
    模板转义：<%& 变量 %>
    **********************-----------
    **********************-----------
    **********************-----------
    模板文件
    请在项目根目录的code-template添加模板文件， 按照mustache(标签定义成了[ '<%', '%>' ])进行格式化,支持使用的变量：
    ************* 以下假设表名为event_main_info,列名为sku_id，sku_name
    title						// 字符串,表的注释
	
    tableName					// 字符串,event_main_info
    className					// 字符串,eventMainInfo
    ClassName					// 字符串,EventMainInfo
    vueName						// 字符串,event-main-info
    splitVueName				// 字符串,event/main-info
    splitName					// 字符串,event/main/info
    SplitName					// 字符串,event/mainInfo
	
    columns						// 数组, 元素格式为{comment:注释,name: sku_id,Name: skuId,NAME: SkuId,Field:表示字段的注解,JSField_name、JSFieldName 分别表示JS的注解,Type:表示JS类型,custom:自定义列名}
    column_names				// 数组, 元素是列名字符串，格式是 sku_id,sku_name
    ColumnNames					// 数组, 元素是列名字符串，格式是 skuId,skuName
    column_names_join 			// 字符串,列名join的字符串，格式是 "sku_id,sku_name"
    ColumnNames_join			// 字符串,列名join的字符串，格式是 "skuId,skuName"
	
    column_names_joinT			// 字符串,列名join的字符串，格式是 "t.sku_id,t.sku_name"
    ColumnNames_joinT 			// 字符串,列名join的字符串，格式是 "t.skuId,t.skuName"
	
    columns_no_id 				// 数组, 不含主键, 元素格式为{comment:注释,name: sku_id,Name: skuId,NAME: SkuId,Field:表示字段的注解,JSField_name, JSFieldName 分别表示JS的注解,Type:表示JS类型}
    column_names_no_id			// 数组, 不含主键, 元素是列名字符串，格式是 sku_id,sku_name
    ColumnNames_no_id			// 数组, 不含主键, 元素是列名字符串，格式是 skuId,skuName
    column_names_no_id_join		// 字符串, 不含主键, 列名join的字符串，格式是 "sku_id,sku_name"
    ColumnNames_no_id_join		// 字符串, 不含主键, 列名join的字符串，格式是 "skuId,skuName"


    columns_no_skip         	// 数组, 不含跳过的列，元素格式为{comment:注释,name: sku_id,Name: skuId,NAME: SkuId,Field:表示字段的注解,JSField_name, JSFieldName 分别表示JS的注解,Type:表示JS类型}
    column_names_no_skip    	// 数组, 不含跳过的列, 元素是列名字符串，格式是 sku_id,sku_name
    ColumnNames_no_skip     	// 数组, 不含跳过的列, 元素是列名字符串，格式是 skuId,skuName
    column_names_no_skip_join	// 数组, 不含跳过的列, 元素是列名字符串，格式是 "sku_id,sku_name"
    ColumnNames_no_skip_join	// 数组, 不含跳过的列, 元素是列名字符串，格式是 "skuId,skuName"

    ids							// 数组, 只有主键, 元素格式为{comment:注释,name: sku_id,Name: skuId,NAME: SkuId,Field:表示字段的注解,JSField_name, JSFieldName 分别表示JS的注解,Type:表示JS类型}
    id_names					// 数组, 只有主键, 元素是列名字符串，格式是 sku_id,sku_name
    IdNames						// 数组, 只有主键, 元素是列名字符串，格式是 skuId,skuName
    id_names_join				// 字符串,列名join的字符串，格式是 "sku_id,sku_name"
    IdNames_join				// 字符串,列名join的字符串，格式是 "skuId,skuName"
	
    modelName					// 推断出的模块名称，可能为空字符串, 如果表名为event_main_info, 则模块为  event
    modelPath					// 模块名称实际就影响访问路径，所以这里会直接拼好controller的模块访问路径，如果模块为空，则该属性就是空字符串,否则是 /模块名称/
	
    logicDelete					// 逻辑删除的查询条件，可以附加在sql条件的末尾，可能是空的
    ---------------------------------------------------------------------------------------------------------------
    .命令 table1,table2,table3:模块名称
    table=. 表示扫描全库表
    :模块名称 可以省略
    -----
    .force: 切换是否覆盖
`);

try {
    const outputs = new Set<string>();
    const _configData = fs.readFileSync(config, { encoding: 'utf-8' }).toString();
    const configData = JSON.parse(_configData) as {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
        command: Record<string, string>;
        commands: Record<string, string[]>;
        output: string;
        id: string;
        logicDeleteK: string;
        logicDeleteV: number;
        NotlogicDeleteV: number;
        tables: string;
        skipColumns: string[];
        custom?: (c: string) => string;
    };
    configData.skipColumns ??= [];
    configData.command ??= {};
    configData.commands ??= {};
    configData.output ??= '';
    configData.id ??= 'uuidShort: true, notNull: true, uuid: true';
    configData.logicDeleteK ??= '';
    configData.logicDeleteV ??= 0;
    configData.NotlogicDeleteV ??= 0;
    if (!configData.host || !configData.port || !configData.user || !configData.password || !configData.database) {
        console.error(`[错误]配置文件缺少必要的参数: host, port, user, password, database`);
    }
    if (!fs.existsSync(templatePath)) {
        console.error(`[错误]模板文件夹不存在，请在项目根目录创建code-template文件夹`);
    }

    const templates = Object.fromEntries(fs.readdirSync(templatePath).map(r => [path.basename(r, '.mu'), fs.readFileSync(path.join(templatePath, r), { encoding: 'utf-8' }).toString()]));
    const pool = createPool({
        host: configData.host,
        port: configData.port,
        user: configData.user,
        password: configData.password,
        database: configData.database
    });
    async function getTables(tableName: string) {
        const conn = await pool.getConnection();
        const params: (string | string[])[] = [configData.database];
        let sql = `
        SELECT TABLE_NAME tableName, IFNULL(TABLE_COMMENT, TABLE_NAME) title FROM information_schema.TABLES
        WHERE TABLE_SCHEMA= ? AND TABLE_TYPE = 'BASE TABLE'`;
        if (tableName !== '.') {
            sql += ` AND TABLE_NAME IN (?)`;
            params.push(tableName.split(/,|\s/).map(r => r.trim()));
        }
        const [result] = await conn.query<any[]>(sql, params);
        conn.release();
        return result;
    }
    async function getColumns(tableName: string) {
        const conn = await pool.getConnection();
        const [result] = await conn.query<any[]>(`
            SELECT
                DATA_TYPE type,
                COLUMN_NAME \`name\`,
                IFNULL(IFNULL(CHARACTER_MAXIMUM_LENGTH,NUMERIC_PRECISION),DATETIME_PRECISION) \`length\`,
                NUMERIC_SCALE scale,
                COLUMN_DEFAULT def,
                IF(COLUMN_KEY = 'PRI', 1, 0) id,
                IF(IS_NULLABLE = 'NO', 1, 0) notNull,
                COLUMN_COMMENT \`comment\`
            FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME = ?;
        `, [configData.database, tableName]);
        let logicDelete = '';
        const columns = result.map(r => {
            if (r.id === 1) { r.id = true; }
            else delete r.id;
            if (r.notNull === 1) { r.notNull = true; }
            else delete r.notNull;
            const fields = new Array<string>(`type:SqlType.${r.type}`);
            r.Type = lxMap[r.type];
            if (r.length !== null) { fields.push(`length:${r.length}`); }
            if (r.scale !== null) { fields.push(`scale:${r.scale}`); }
            if (r.def !== null) {
                r.def ??= '';
                if (r.def !== '') {
                    if (isNaN(r.def)) {
                        fields.push(`def:'${r.def}'`);
                    } else {
                        fields.push(`def:${r.def}`);
                    }
                }
            }
            if (r.Type === 'string') {
                if (r.def === '' || r.def === null) {
                    r.def = "''";
                } else {
                    r.def = `'${r.def}'`;
                }
            } else if (r.Type === 'number') {
                r.def = 0;
            } else if (r.Type === 'Date') {
                r.def = 'new Date()';
            } else {
                r.def = 'null';
            }
            if (r.id === true) {
                fields.push(`id:true`);
            }
            if (r.notNull === true) { fields.push(`notNull:true`); }
            if (r.id === true && configData.id) {
                fields.push(configData.id);
            }
            if (r.name === configData.logicDeleteK) {
                fields.push(`logicDelete: ${configData.logicDeleteV}`);
                logicDelete = `AND ${r.name} = ${configData.NotlogicDeleteV}`;
            }
            if (r.comment) { fields.push(`comment: '${r.comment}'`); }
            r.comment = r.comment ?? '';

            r.Name = r.name.replace(/_(\w)/g, (a: string, b: string) => b.toUpperCase());
            r.NAME = r.Name.replace(/\w/, (v: string) => v.toUpperCase());
            r.Field = `@Field({${fields.join(',')}})`;
            r.JSField_name = `{${fields.join(',')}, P: '${r.name}'}`;
            r.JSFieldName = `{${fields.join(',')}, P: '${r.Name}'}`;
            if(configData.custom){
                r.custom = configData.custom(r.name);
            }
            return r;
        });
        conn.release();
        return { columns, logicDelete };
    }
    async function excute(command: string, input: string, modelName: string) {
        const tables = await getTables(input);
        if (input !== '.') {
            const checkTable = input.split(/,|\s/).map(r => r.trim())
            if (checkTable.length !== tables.length) {
                console.error(`[错误] 输入的表与数据库查询返回表不符，数据库返回${tables.length}个:${tables.map(i => i.tableName).join(',')}`);
                return;
            }
        }
        modelName ??= '';
        const modelPath = modelName ? `/${modelName}/` : '';
        for (const { tableName, title } of tables) {
            const { columns, logicDelete } = await getColumns(tableName);
            const className = tableName.replace(/_(\w)/g, (a: string, b: string) => b.toUpperCase());
            const ClassName = className.replace(/\w/, (v: string) => v.toUpperCase());
            const vueName = tableName.replace(/_/g, '-');
            const splitVueName = tableName.replace(/_/, '/').replace(/_/g, '-');
            const modelName = tableName.substring(0, tableName.indexOf('_'));
            const splitName = tableName.replace(/_/g, '/');
            const SplitName = tableName.replace(/_/, '/').replace(/_(\w)/g, (a: string, b: string) => b.toUpperCase());
            const data = {
                title,

                tableName,
                className,
                ClassName,
                vueName,
                splitVueName,
                splitName,
                SplitName,

                columns,

                column_names: columns?.map(i => i.name),
                ColumnNames: columns?.map(i => i.Name),

                column_names_join: columns?.map(i => i.name).join(','),
                ColumnNames_join: columns?.map(i => `${i.name} ${i.Name}`).join(','),

                column_names_joinT: columns?.map(i => `t.${i.name}`).join(','),
                ColumnNames_joinT: columns?.map(i => `t.${i.name} ${i.Name}`).join(','),

                columns_no_id: columns?.filter(i => !i.id),

                column_names_no_id: columns?.filter(i => !i.id).map(i => i.name),
                ColumnNames_no_id: columns?.filter(i => !i.id).map(i => i.Name),

                column_names_no_id_join: columns?.filter(i => !i.id).map(i => i.name).join(','),
                ColumnNames_no_id_join: columns?.filter(i => !i.id).map(i => i.Name).join(','),

                columns_no_skip: columns?.filter(i => !configData.skipColumns.includes(i.name) && !i.id),

                column_names_no_skip: columns?.filter(i => !configData.skipColumns.includes(i.name) && !i.id).map(i => i.name),
                ColumnNames_no_skip: columns?.filter(i => !configData.skipColumns.includes(i.name) && !i.id).map(i => i.Name),

                column_names_no_skip_join: columns?.filter(i => !configData.skipColumns.includes(i.name) && !i.id).map(i => i.name).join(','),
                ColumnNames_no_skip_join: columns?.filter(i => !configData.skipColumns.includes(i.name) && !i.id).map(i => i.Name).join(','),

                ids: columns?.filter(i => i.id),

                id_names: columns?.filter(i => i.id).map(i => i.name),
                IdNames: columns?.filter(i => i.id).map(i => i.Name),

                id_names_join: columns?.filter(i => i.id).map(i => i.name).join(','),
                IdNames_join: columns?.filter(i => i.id).map(i => i.Name).join(','),

                modelName,
                modelPath,

                logicDelete
            };
            const template = templates[command];
            if (!template) {
                console.error(`[错误] ${command} 未定义模板!`);
                return;
            }
            const txt = mustache.render(template, data, {}, ['<%', '%>']);
            const _fileName = configData.command[command]!.replace(/{([a-zA-Z]+)}/g, (a: string, b: string) => data[b]);
            const fileNames = _fileName.split(',');
            for (const fileName of fileNames) {
                const filePath = path.join(basepath, fileName);
                const dirname = path.dirname(filePath);
                mkdir('-p', dirname);
                // try {
                //     fs.statSync(dirname);
                // } catch (error) {
                //     fs.mkdirSync(dirname);
                //     console.info(`[生成] ${dirname}`);
                // }
                try {
                    fs.statSync(filePath);
                    if (force === false) {
                        console.warn(`[跳过] ${filePath}`);
                        return;
                    } else {
                        console.warn(`[覆盖] ${filePath}`);
                    }
                } catch (error) {
                    console.info(`[生成] ${filePath}`);
                }
                if (configData.output) {
                    outputs.add(configData.output.replace(/{([a-zA-Z]+)}/g, (a: string, b: string) => data[b]));
                }
                fs.writeFileSync(path.join(basepath, fileName), txt);
            }
        }
    }
    const replServer = start();
    function defineCommand(command: string, comands?: string[]) {
        if (comands) {
            console.log(`[组合]${command}>${comands.join(',')}注册成功`);
        } else {
            console.log(`[命令]${command}注册成功`);
        }
        if (comands) {
            replServer.defineCommand(command, async input => {
                outputs.clear();
                const inputs = input.match(/([^:]+):{0,1}([a-zA-Z0-9]*)/);
                if (inputs?.length !== 3) {
                    return console.error(`[错误]命令格式应为: table1,table2[:模块名]`);
                }
                const [_, tables, modelName] = inputs;
                for (const c of comands) {
                    await excute(c, tables!, modelName ?? '');
                }
                console.info('执行完毕！下面打印生成的输出');
                console.info(Array.from(outputs).join(','));
            });
        } else {
            replServer.defineCommand(command, async input => {
                outputs.clear();
                const inputs = input.match(/([^:]+):{0,1}([a-zA-Z0-9]*)/);
                if (inputs?.length !== 3) {
                    return console.error(`[错误]命令格式应为: table1,table2[:模块名]`);
                }
                const [_, tables, modelName] = inputs;
                await excute(command, tables!, modelName ?? '');
                console.info('执行完毕！下面打印生成的输出');
                console.info(Array.from(outputs).join(','));
            });
        }
    }
    replServer.defineCommand('force', () => {
        force = !force;
        console.log(force ? '覆盖生成' : '不覆盖生成!');
    });
    if (configData.command) {
        for (const command of Object.keys(configData.command)) {
            if (!templates[command]) {
                console.error(`命令:${command}没有定义模板，该命令不会生效`);
            } else {
                defineCommand(command);
            }
        }
    }
    if (configData.commands) {
        for (const [command, commands] of Object.entries(configData.commands)) {
            const keys = commands as string[];
            const error = keys.filter(k => !templates[k]).join(',');
            if (error) {
                console.error(`组合命令:${command}定义了${commands},但是${error}没有定义模板，该命令不会生效`);
            } else {
                defineCommand(command, keys);
            }
        }
    }
} catch (error) {
    console.error(error);
}
