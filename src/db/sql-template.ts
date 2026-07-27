import HTML from 'html-parse-stringify';
import mustache, { PartialsOrLookupFn } from 'mustache';
import { convert, XML } from '../convert-xml.js';
import { Throw } from '../error.js';
import {
    _enum,
    _fs,
    _LoggerService,
    _path,
    _resultMap,
    _resultMap_SQLID,
} from '../const/symbols.js';
// import { LoggerService } from '../logger.js';
import {
    MapperIfUndefined,
    SqlMapper,
    SqlMappers,
    _SqlModel,
} from '../const/types.js';

class Build {
    private static page = 'COUNT(1) zccw1986 ';
    private isCount: boolean;
    private isSum: boolean;
    private orderBy: string;
    private orderSeted: boolean = false;
    /**
     *
     * @param count 是否是count查询
     * @param isSum  是否是sum查询
     * @param param
     */
    constructor(
        isCount: boolean,
        isSum: boolean,
        param: {
            ctx?: any;
            isCount?: boolean;
            isSum?: boolean;
            limitStart?: number;
            limitEnd?: number;
            sortName?: string;
            sortType?: string;
            [k: string]: any;
        } = {}
    ) {
        this.isCount = isCount;
        this.isSum = isSum;
        this.orderBy = param.sortName ? `${param.sortName} ${param.sortType ?? 'ASC'}` : '';
        Object.assign(this, param);
    }
    /**
     *
     * 当分页时将函数内包含的内容替换为COUNT(1)
     * @returns
     * @memberof Build
     */
    page() {
        return (text: string, render: (text: string) => string) => {
            if (this.isCount) {
                return Build.page;
            } else if (this.isSum !== true) {
                return render(text);
            }
        };
    }
    /**
   *
   * 包含的内容只在汇总查询时有效，否则是空白
   * @returns
   * @memberof Build
   */
    sum() {
        return (text: string, render: (text: string) => string) => {
            if (this.isSum !== true) {
                return '';
            } else {
                return render(text);
            }
        };
    }

    /**
     *
     * 当分页时、汇总时忽略函数内包含的内容
     * @returns
     * @memberof Build
     */
    notPage() {
        return (text: string, render: (text: string) => string) => {
            if (this.isCount || this.isSum) {
                return '';
            } else {
                return render(text);
            }
        };
    }
    /**
     *
     * 将查询条件包起来，如果条件内容不为空，则自动添加WHERE,同时将第一个条件的and、or替换为空
     * 例如:
     * {{#whereTag}}
     * and name = 1
     * and page = 2
     * {{/whereTag}}
     * 输出
     * where name = 1 and page = 2
     * @returns
     * @memberof Build
     */
    where() {
        return (text: string, render: (text: string) => string) => {
            let data = render(text).trim();
            if (data) {
                data = data.replace(/and|or/i, '');
                return ` WHERE ${data} `;
            } else {
                return '';
            }
        };
    }
    /**
     * ```
     * SELECT
     * {{#hump}}
     * a.event_id, a.event_name eventName
     * {{/hump}}
     * FROM...
     * ```
     * 编译后:
     * ```
     * SELECT
     * a.event_id eventId, a.event_name eventName
     * FROM...
     * ```
     */
    hump() {
        return (text: string, render: (text: string) => string) => {
            let data = render(text).trim();
            const datas = data.split(',');
            for (let i = 0; i < datas.length; i++) {
                if (datas[i]?.match(/\s|\t/) === null) {
                    datas[i] = `${datas[i]} ${datas[i]!.replace(/[a-zA-Z0-9]+\./, '').replace(/_([a-z])/g, (a, b, c) => b.toUpperCase())}`;
                }
            }
            return ` ${datas.join(',')} `;
        };
    }
    /**
     * 删除第一个and、or
     * 删除最后一个,
     * 删除最后一个;
     * @memberof Build
     */
    trim() {
        return (text: string, render: (text: string) => string) => {
            let data = render(text);
            data = data.trim();
            if (data) {
                data = data.replace(/(^and\s)|(^or\s)|(,$)|(;$)/i, '');
                return data;
            } else {
                return '';
            }
        };
    }
    /**
     * 分页时将排序部分代码用此函数包起来，可以自动拼接order by
     * 查询条数时，自动忽略此部分
     * etc
     * {{#order}} name desc, age asc {{/order}}
     * ===
     * ORDER BY name desc, age asc
     * @returns
     * @memberof Build
     */
    order() {
        return (text: string, render: (text: string) => string) => {
            if (this.isCount || this.isSum) {
                return '';
            } else {
                this.orderSeted = true;
                const orderBy = new Array<string>();
                if (this.orderBy) {
                    orderBy.push(this.orderBy);
                }
                const renderOrder = render(text);
                if (/\S/.test(renderOrder)) {
                    orderBy.push(renderOrder);
                }
                let data = orderBy.length > 0 ? ` ORDER BY ${orderBy.join(',')} ` : '';
                data = data.trim();
                if (data) {
                    data = data.replace(/(^and\s)|(^or\s)|(,$)|(;$)/i, '');
                    return data;
                } else {
                    return '';
                }
            }
        };
    }

    /**
     *
     * 分页时将分组部分代码用此函数包起来，可以自动拼接GROUP BY
     * 当分页时、汇总时，自动忽略此部分
     * etc
     * {{#between}} name, age {{/between}}
     * ===
     * group by name.age
     * @returns
     * @memberof Build
     */
    group() {
        return (text: string, render: (text: string) => string) => {
            if (this.isCount || this.isSum) {
                return '';
            } else {
                const groupBy = render(text) || '';
                return /\S/.test(groupBy) ? ` GROUP BY ${groupBy} ` : '';
            }
        };
    }

    /**
     *
     * # beetween and
     * ## etc.
     * ```
     * {{#between}} AND t.createtime ({{createtime}}) {{/between}}
     * // 其中：
     * createtime = '1,2'
     * // 或者
     * createtime = ['1', '2']
     * // 将生成：
     * AND t.createtime BETWEEN '1' AND '2'
     * ```
     * @returns
     * @memberof Build
     */
    between() {
        return (text: string, render: (text: string) => string) => {
            const result = render(text);
            if (/\(([\w\W]+)\)/.exec(result)) {
                return render(text).replace(/\(([\w\W]+)\)/, (a, b) => {
                    if (a && b) {
                        if (typeof b === 'string') {
                            const xx = b.split(',');
                            return ` BETWEEN '${xx[0]}' AND '${xx[1]}'`;
                        } else {
                            return ` BETWEEN '${b[0]}' AND '${b[1]}'`;
                        }
                    } else {
                        return '';
                    }
                }).replace(/\|/, ' BETWEEN ');
            } else {
                return '';
            }
        };
    }

    /**
     *
     * 距离计算,单位米
     * etc
     * {{#distance}} (t.longitude, t.latitude), ({{longitude}}, {{latitude}}) {{/distance}}
     * ===
     * ROUND(ST_DISTANCE(POINT(longitude1, latitude1), POINT({{longitude}}, {{latitude}}))*111195, 2)
     * 可根据需求自行将数据转换为千米，例如
     * {{#distance}} (t.longitude, t.latitude), ({{longitude}}, {{latitude}}) {{/distance}} / 1000
     * @returns
     * @memberof Build
     */
    distance() {
        return (text: string, render: (text: string) => string) => {
            const result = render(text);
            if (/\(([^()]+)\)/.exec(result)) {
                let index = 0;
                return render(text).replace(/\(([^()]+)\)/g, (a, b) => {
                    if (a && b) {
                        const xx = b.split(',');
                        if (index === 0) {
                            index++;
                            return ` ROUND(ST_DISTANCE(POINT(${xx[0]}, ${xx[1]}) `;
                        } else {
                            return ` POINT(${xx[0]}, ${xx[1]}))*111195, 2)`;
                        }
                    } else {
                        return '';
                    }
                });
            } else {
                return '';
            }
        };
    }
    /**
     * * PROBLEM_TYPE = 枚举名
     * * t.problemtype = 列名
     *
     * ```
     * {{#enumTag}} PROBLEM_TYPE(t.problemtype) {{/enumTag}}
     * ```
     */
    enum() {
        return (text: string) => {
            const matchs = text.match(/([a-zA-Z_]+)\(([^()]+)\)/);
            if (matchs) {
                const [_a, MapName, Column] = matchs;
                if (MapName && Column) {
                    const map = globalThis[_enum].EnumMap(MapName.trim());
                    if (map) {
                        return ` CASE
    ${Object.entries(map).map(([k, v]) => `WHEN ${Column} = '${k}' THEN '${v}'`).join(' ')}
    END `;
                    }
                }
            }
            return "''";
        };
    }

    get OrderSeted() {
        return this.orderSeted;
    }
    get OrderBy() {
        return this.orderBy;
    }
}

function replaceCdata(rawText: string) {
    var cdataRegex = new RegExp('(<!\\[CDATA\\[)([\\s\\S]*?)(\\]\\]>)', 'g');
    var matches = rawText.match(cdataRegex);

    if (matches != null && matches.length > 0) {
        for (var z = 0; z < matches.length; z++) {
            var regex = new RegExp('(<!\\[CDATA\\[)([\\s\\S]*?)(\\]\\]>)', 'g');
            var m = regex.exec(matches[z]!);

            var cdataText = m![2];
            cdataText = cdataText!.replace(/\&/g, '&amp;');
            cdataText = cdataText!.replace(/\</g, '&lt;');
            cdataText = cdataText!.replace(/\>/g, '&gt;');
            cdataText = cdataText!.replace(/\"/g, '&quot;');

            rawText = rawText.replace(m![0], cdataText);
        }
    }
    return rawText;
}
function _flatData(result: any, i: number, length: number, keys: string[], V: any, convert?: (data: any) => any) {
    const key = keys[i];
    if (i < length) {
        result[key!] ??= {};
        i++;
        _flatData(result[key!], i, length, keys, V);
    } else {
        if (convert) {
            result[key!] = convert(V);
        }
        else {
            result[key!] = V;
        }
    }
}
/**
 * ifUndefined默认是MapperIfUndefined.Skip
 */
export function flatData<M>(options: { data: any; mapper: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; }): M {
    if (typeof options.mapper === 'string') {
        const name = options.mapper;
        options.mapper = globalThis[_resultMap][name];
        Throw.if(!options.mapper, `not found mapper!${name}`);
    }
    options.mapperIfUndefined ??= MapperIfUndefined.Skip;
    options.mapper = options.mapper as SqlMapper;
    const result: any = {};
    for (const { columnName, mapNames, def, convert } of options.mapper) {
        let V = options.data[columnName];
        if (V === undefined) {
            if (options.mapperIfUndefined === MapperIfUndefined.Null) {
                V = null;
            } else if (options.mapperIfUndefined === MapperIfUndefined.Zero) {
                V = 0;
            } else if (options.mapperIfUndefined === MapperIfUndefined.EmptyString) {
                V = '';
            } else if (def !== undefined) {
                V = def;
            } else {
                continue;
            }
        }
        _flatData(result, 0, mapNames.length - 1, mapNames, V, convert);
    }
    return result;
}

export class SqlCache {
    private sqlMap: _SqlModel = {};
    private sqlFNMap: PartialsOrLookupFn = {};
    private async _read(jsMode: boolean, sqlDir: string, queryTypes: string[], rootName: string) {
        const sqlFis = globalThis[_fs].readdirSync(sqlDir);
        for (const modeName of sqlFis) {
            const file = globalThis[_path].join(sqlDir, modeName);
            const stat = globalThis[_fs].statSync(file);
            if (stat.isDirectory()) {
                await this._read(jsMode, file, queryTypes, modeName);
            } else {
                const extname = globalThis[_path].extname(modeName);
                const name = globalThis[_path].basename(modeName, extname);
                let ct = 0;
                if (extname === '.mu') {
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: ${file} start explain!`);
                    const parser = new MUParser(rootName || name, globalThis[_fs].readFileSync(file, { encoding: 'utf-8' }).toString());
                    let source = parser.next();
                    while (source != null) {
                        ct++;
                        this.sqlMap[source[0]] = source[1];
                        (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: ${source[0]} found!`);
                        source = parser.next();
                    }
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: ${file} explain over[${ct}]!`);
                } else if (jsMode && extname === '.js') {
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: ${file} start explain!`);
                    const obj = (await import(globalThis[_path].join(sqlDir, modeName))).default as _SqlModel;
                    for (const [key, fn] of Object.entries(obj)) {
                        ct++;

                        this.sqlMap[`${rootName || name}.${String(key)}`] = fn;
                    }
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: ${file} explain over[${ct}]!`);
                } else if (extname === '.xml') {
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: ${file} start explain!`);
                    const root = (HTML.parse(replaceCdata(globalThis[_fs].readFileSync(file, { encoding: 'utf-8' }).toString())) as XML[])[0];
                    if (root) {
                        const mappers = root.children;
                        for (const mapper of mappers) {
                            if (mapper.type === 'tag' && mapper.name === 'mapper') {
                                for (const am of mapper.children) {
                                    if (am.type === 'tag') {
                                        Throw.if(!queryTypes.includes(am.name), `${rootName} ${name}错误,${am.name}不支持!`);
                                        am.id = am.attrs['id'];
                                        Throw.if(!am.id, `${rootName} ${name}错误,没有为此块设置id:${am}`);
                                        if (am.name === 'resultMap') {
                                            ct++;
                                            globalThis[_resultMap] ??= {};
                                            const keys: SqlMapper = [];
                                            this.readResultMap(am.children, keys, []);
                                            globalThis[_resultMap][`${rootName || name}.${am.id}`] = keys;
                                            (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql_resultMap: ${`${rootName || name}.${am.id}`} found!`);
                                        } else {
                                            this.sqlMap[`${rootName || name}.${am.id!}`] = am.children;
                                            if (am.attrs['resultMap']) {
                                                globalThis[_resultMap_SQLID][`${rootName || name}.${am.id!}`] = am.attrs['resultMap'];
                                                (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: autoMapper: ${rootName || name}.${am.id!}-${am.attrs['resultMap']}`);
                                            }
                                            (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: ${rootName || name}.${am.id!} found!`);
                                            ct++;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    (globalThis[_LoggerService]! as any).debugCategory?.('sql', `sql: ${file} explain over[${ct}]!`);
                }

            }
        }
    }
    /**
     *
     * ```
    // 第一个元素=列名，第二个元素是属性路径，
    [
        ['dit_id', ['id']], // 列名ditid,对应属性id
        ['event_id', ['eventMainInfo', 'id']] // 列名event_id对应属性eventMainInfo.id
    ]
     * ```
     * @param am
     * @param keys
     */
    private readResultMap(ams: XML[], keys: SqlMapper, key: string[]) {
        for (const am of ams) {
            if (am.type === 'tag') {
                if (am.name === 'result' || am.name === 'id') {
                    keys.push({
                        columnName: am.attrs['column']!,
                        mapNames: [...key!, am.attrs['property']!]
                    });
                } else {
                    this.readResultMap(am.children, keys, [...key, am.attrs['property']!])
                }
            }
        }
    }
    async init(options: {
        sqlMap?: _SqlModel; sqlDir?: string;
        sqlFNMap?: Record<string, string>; sqlFNDir?: string;
        sqlMapperMap?: SqlMappers; sqlMapperDir?: string;
        jsMode?: boolean;
    }) {
        if (options.sqlMap) {
            this.sqlMap = options.sqlMap;
        }
        const queryTypes = ['sql', 'select', 'insert', 'update', 'delete', 'resultMap'];
        if (options.sqlDir) {
            await this._read(options.jsMode === true, options.sqlDir, queryTypes, '');
        }
        if (options.sqlFNMap) {
            this.sqlFNMap = options.sqlFNMap;
        }
        if (options.sqlFNDir) {
            const sqlFis = globalThis[_fs].readdirSync(options.sqlFNDir);
            for (const modeName of sqlFis) {
                const extname = globalThis[_path].extname(modeName);
                const name = globalThis[_path].basename(modeName, extname);
                const file = globalThis[_path].join(options.sqlFNDir, modeName);
                if (extname === '.mu') {
                    this.sqlFNMap[name] = globalThis[_fs].readFileSync(file, { encoding: 'utf-8' }).toString();
                }
            }
        }
        if (options.sqlMapperMap) {
            globalThis[_resultMap] = options.sqlMapperMap;
        }
        if (options.sqlMapperDir) {
            const sqlFis = globalThis[_fs].readdirSync(options.sqlMapperDir);
            globalThis[_resultMap] ??= {};
            for (const modeName of sqlFis) {
                const extname = globalThis[_path].extname(modeName);
                const name = globalThis[_path].basename(modeName, extname);
                const file = globalThis[_path].join(options.sqlMapperDir, modeName);
                if (extname === '.json') {
                    globalThis[_resultMap][name] = JSON.parse(globalThis[_fs].readFileSync(file, { encoding: 'utf-8' }).toString());
                }
            }
        }
    }
    load(sqlids: string[], options: {
        ctx?: any;
        isCount?: boolean;
        isSum?: boolean;
        limitStart?: number;
        limitEnd?: number;
        sortName?: string;
        sortType?: string;
        [k: string]: any;
    }): string {
        let sqlSource: any;
        for (const sqlid of sqlids) {
            sqlSource = this.sqlMap[sqlid];
            if (sqlSource) {
                break;
            }
        }
        const matchSqlid = sqlids.map(i => i.split('.')[0]!);
        Throw.if(!sqlSource, `指定的语句${sqlids.join('|')}不存在!`);
        const buildParam = new Build(options.isCount === true, options.isSum === true, options);
        if (typeof sqlSource === 'function') {
            const _sql = sqlSource(options);
            let sql = mustache.render(_sql, buildParam, this.sqlFNMap);
            if (buildParam.OrderSeted === false && buildParam.OrderBy && options.isCount !== true && options.isSum !== true) {
                sql += ` ORDER BY ${buildParam.OrderBy}`;
            }
            return sql;
        } else if (typeof sqlSource === 'string') {
            let sql = mustache.render(sqlSource, buildParam, this.sqlFNMap);
            if (buildParam.OrderSeted === false && buildParam.OrderBy && options.isCount !== true && options.isSum !== true) {
                sql += ` ORDER BY ${buildParam.OrderBy}`;
            }
            return sql;
        } else if (typeof sqlSource === 'object') {
            const _sql = convert(sqlSource, options, matchSqlid, this.sqlMap as Record<string, XML[]>);
            let sql = mustache.render(_sql, buildParam, this.sqlFNMap);
            if (buildParam.OrderSeted === false && buildParam.OrderBy && options.isCount !== true && options.isSum !== true) {
                sql += ` ORDER BY ${buildParam.OrderBy}`;
            }
            return sql;
        }
        return '';
    }
}

class MUParser {
    static END = 1;
    private modelName: string;
    private linNumber = 0;
    private lastLine: string = '';
    private lastlastLine: string = '';
    private status = 0;
    private lineSeparator = '\n';
    private files: string[];
    constructor(modelName: string, file: string) {
        this.modelName = modelName;
        this.files = file.replace(/\r/g, '').split(this.lineSeparator);
        this.skipHeader();
    }
    next(): [string, string] | null {
        let sqlId: string = this.readSqlId();
        if (this.status === MUParser.END) {
            return null;
        }
        // 去掉可能的尾部空格
        sqlId = sqlId.trim();
        this.skipComment();
        if (this.status === MUParser.END) {
            return null;
        }
        const sql: string = this.readSql();
        return [`${this.modelName}.${sqlId}`, sql];
    }
    private skipHeader(): void {
        while (true) {
            const line: string = this.nextLine();
            if (this.status === MUParser.END) {
                return;
            }
            if (line.startsWith('===')) {
                return;
            }
        }
    }
    private nextLine(): string {
        const line: string = this.files[this.linNumber]!;
        this.linNumber++;
        if (line === undefined) {
            this.status = MUParser.END;
        }
        // 保存最后读的俩行
        this.lastlastLine = this.lastLine;
        this.lastLine = line;
        return line;
    }
    private readSqlId(): string {
        return this.lastlastLine;
    }
    private skipComment(): void {
        let findComment = false;
        while (true) {
            let line: string = this.nextLine();
            if (this.status === MUParser.END) {
                return;
            }
            line = line.trim();
            if (!findComment && line.length === 0) {
                continue;
            }
            if (line.startsWith('*')) {
                // 注释符号
                findComment = true;
                continue;
            } else {
                if (line.length === 0) {
                    continue;
                } else if (line.startsWith('```') || line.startsWith('~~~')) {
                    // 忽略以code block开头的符号
                    continue;
                } else {
                    // 注释结束
                    return;
                }
            }
        }
    }
    private readSql(): string {
        const list: string[] = [];
        list.push(this.lastLine);
        while (true) {
            const line: string = this.nextLine();

            if (this.status === MUParser.END) {
                return this.getBuildSql(list);
            }

            if (line.startsWith('===')) {
                // 删除下一个sqlId表示
                list.pop();
                return this.getBuildSql(list);
            }
            list.push(line);
        }
    }
    private getBuildSql(list: string[]): string {
        const sb: string[] = [];
        for (const str of list) {
            const s: string = str.trim();
            if (s.startsWith('```') || s.startsWith('~~~')) {
                // 忽略以code block开头的符号
                continue;
            }
            sb.push(str);
        }
        return sb.join(this.lineSeparator);
    }
}
