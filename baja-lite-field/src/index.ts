import iterate from 'iterare';
import LGet from 'lodash.get';
import 'reflect-metadata';

export enum SqlType {
  tinyint,
  smallint,
  mediumint,
  int,
  bigint,

  float,
  double,
  decimal,

  date,
  time,
  year,
  datetime,
  timestamp,

  char,
  varchar,
  tinyblob,
  tinytext,
  blob,
  text,
  mediumblob,
  mediumtext,
  longblob,
  longtext,

  json,
}
export interface FieldOption extends Object {
  type?: SqlType;
  /** @deprecated 属性名称:TS注解不需要，JS手动注入需要 */
  P?: string;
  length?: number;
  scale?: number;
  def?: any;
  index?: boolean;
  id?: boolean;
  logicDelete?: string | number;
  /** 是否逻辑唯一，用于导入时检测数据是否存在 */
  logicId?: boolean;
  /** 仅在生成 表时有效 */
  notNull?: boolean;
  /** 注释，影响到默认导出导入标题 */
  comment?: string;
  /** 可以导入的字段,默认TRUE,ID默认FALSE */
  importable?: boolean;
  /** 可以导出的字段,默认TRUE,ID默认FALSE */
  exportable?: boolean;
  /** sqlite 无效,与UUID只能有一个 */
  uuidShort?: boolean;
  /** 与uuidShort只能有一个 */
  uuid?: boolean;
}
export const _columns = Symbol('columns');
export const _ids = Symbol('ids');
export const _logicIds = Symbol('logicIds');
export const _columnsNoId = Symbol('columnsNoId');
export const _fields = Symbol('fields');
export const _stateFileName = Symbol('stateFileName');
export const _deleteState = Symbol('deleteState');
export const _index = Symbol('index');
export const _def = Symbol('def');
export const _Hump = Symbol('Hump');
export enum DBType {
  Mysql,
  Postgresql,
  Sqlite,
  Mongo,
  SqliteRemote,
  Redis,
  RedisLock,
}
const P2CEX = /[A-Z]/g;
export const P2C = (pro: string, IF = true) =>
  IF ? pro.replace(P2CEX, (a: string) => `_${a.toLowerCase()}`) : pro;
const C2PEX = /_([a-z])/g;
export const C2P = (pro: string, IF = true) =>
  IF ? pro.replace(C2PEX, (a: string, b: string) => `${b.toUpperCase()}`) : pro;
export interface AField extends FieldOption {
  /** 安全列名 */
  C2: () => string;
  /** @deprecated 数据列名称 */
  C?: () => string;
  /** 查询用：b_id bId */
  C3: () => string;

  [DBType.Postgresql]: () => string;
  [DBType.Mysql]: () => string;
  [DBType.Sqlite]: () => string;
  [DBType.SqliteRemote]: () => string;
  Data2SQL: (data: any) => any;
}
const MYSQLCHARSET = `CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`;
const POSTGRESCHARSET = `COLLATE 'pg_catalog'.'default'`;
export const Field = (config: FieldOption) => {
  config.type ??= SqlType.varchar;
  return (object: object, propertyName: string) => {
    const field = config as AField;
    field.P = propertyName;
    field.C = () => P2C(propertyName, globalThis[_Hump]);
    field.C2 = () => P2C(propertyName, globalThis[_Hump]);
    field.C3 = () => `${P2C(propertyName, globalThis[_Hump])} ${propertyName}`;
    const hasDef = field.hasOwnProperty('def') === true;
    switch (field.type) {
      case SqlType.tinyint: {
        field[DBType.Mysql] = () =>
          `${field.C2()} tinyint ${config.notNull === true ? 'NOT NULL' : ''} ${hasDef ? `DEFAULT ${field.def}` : ''
          }`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} int2 ${config.notNull === true ? 'NOT NULL' : ''} ${hasDef ? `DEFAULT ${field.def}` : ''
          }`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} integer`;
        break;
      }
      case SqlType.smallint: {
        field[DBType.Mysql] = () =>
          `${field.C2()} smallint ${config.notNull === true ? 'NOT NULL' : ''
          } ${hasDef ? `DEFAULT ${field.def}` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} int2 ${config.notNull === true ? 'NOT NULL' : ''} ${hasDef ? `DEFAULT ${field.def}` : ''
          }`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} integer`;
        break;
      }
      case SqlType.mediumint: {
        field[DBType.Mysql] = () =>
          `${field.C2()} smallint ${config.notNull === true ? 'NOT NULL' : ''
          } ${hasDef ? `DEFAULT ${field.def}` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} int4 ${config.notNull === true ? 'NOT NULL' : ''} ${hasDef ? `DEFAULT ${field.def}` : ''
          }`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} integer`;
        break;
      }
      case SqlType.int: {
        field[DBType.Mysql] = () =>
          `${field.C2()} int ${config.notNull === true ? 'NOT NULL' : ''} ${hasDef ? `DEFAULT ${field.def}` : ''
          }`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} int4 ${config.notNull === true ? 'NOT NULL' : ''} ${hasDef ? `DEFAULT ${field.def}` : ''
          }`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} integer`;
        break;
      }
      case SqlType.bigint: {
        field[DBType.Mysql] = () =>
          `${field.C2()} bigint ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} int8 ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} integer`;
        field.Data2SQL = (data: any) => BigInt(data ?? 0);
        break;
      }
      case SqlType.float: {
        field[DBType.Mysql] = () =>
          `${field.C2()} float4(${config.length ?? 1}, ${config.scale ?? 2}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${hasDef ? `DEFAULT '${field.def}'` : ''} `;
        field[DBType.Postgresql] = () =>
          `${field.C2()} float4(${config.length ?? 1}, ${config.scale ?? 2}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${hasDef ? `DEFAULT '${field.def}'` : ''} `;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} real`;
        break;
      }
      case SqlType.double: {
        field[DBType.Mysql] = () =>
          `${field.C2()} double(${config.length ?? 1}, ${config.scale ?? 2}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${hasDef ? `DEFAULT '${field.def}'` : ''} `;
        field[DBType.Postgresql] = () =>
          `${field.C2()} float8(${config.length ?? 1}, ${config.scale ?? 2}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${hasDef ? `DEFAULT '${field.def}'` : ''} `;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} real`;
        break;
      }
      case SqlType.decimal: {
        field[DBType.Mysql] = () =>
          `${field.C2()} decimal(${config.length ?? 1}, ${config.scale ?? 2}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${hasDef ? `DEFAULT '${field.def}'` : ''} `;
        field[DBType.Postgresql] = () =>
          `${field.C2()} numeric(${config.length ?? 1}, ${config.scale ?? 2}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${hasDef ? `DEFAULT '${field.def}'` : ''} `;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} real`;
        break;
      }

      case SqlType.longtext: {
        field[DBType.Mysql] = () =>
          `${field.C2()} longtext ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.mediumtext: {
        field[DBType.Mysql] = () =>
          `${field.C2()} mediumtext ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.text: {
        field[DBType.Mysql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.date: {
        field[DBType.Mysql] = () =>
          `${field.C2()} date ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} date ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        field.Data2SQL = (data: any) =>
          typeof data === 'string' ? new Date(data) : data;
        break;
      }
      case SqlType.time: {
        field[DBType.Mysql] = () =>
          `${field.C2()} time ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} time ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        field.Data2SQL = (data: any) =>
          typeof data === 'string' ? new Date(data) : data;
        break;
      }
      case SqlType.year: {
        field[DBType.Mysql] = () =>
          `${field.C2()} year ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} int4 ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        field.Data2SQL = (data: any) =>
          typeof data === 'string' ? new Date(data) : data;
        break;
      }
      case SqlType.datetime: {
        field[DBType.Mysql] = () =>
          `${field.C2()} datetime ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} timestamp ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        field.Data2SQL = (data: any) =>
          typeof data === 'string' ? new Date(data) : data;
        break;
      }
      case SqlType.timestamp: {
        field[DBType.Mysql] = () =>
          `${field.C2()} timestamp ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} timestamp ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} integer`;
        field.Data2SQL = (data: any) =>
          typeof data === 'string' ? +new Date(data) : data;
        break;
      }
      case SqlType.char: {
        field[DBType.Mysql] = () =>
          `${field.C2()} char(${config.length ?? 1}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} char(${config.length ?? 1}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.varchar: {
        field[DBType.Mysql] = () =>
          `${field.C2()} varchar(${config.length ?? 1}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} varchar(${config.length ?? 1}) ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.tinyblob: {
        field[DBType.Mysql] = () =>
          `${field.C2()} tinyblob ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} bytea ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.tinytext: {
        field[DBType.Mysql] = () =>
          `${field.C2()} tinytext ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.blob: {
        field[DBType.Mysql] = () =>
          `${field.C2()} binary ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} bytea ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.text: {
        field[DBType.Mysql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.mediumblob: {
        field[DBType.Mysql] = () =>
          `${field.C2()} mediumblob ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} bytea ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.mediumtext: {
        field[DBType.Mysql] = () =>
          `${field.C2()} mediumtext ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.longblob: {
        field[DBType.Mysql] = () =>
          `${field.C2()} longblob ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} bytea ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.longtext: {
        field[DBType.Mysql] = () =>
          `${field.C2()} longtext ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} text ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
      case SqlType.json: {
        field[DBType.Mysql] = () =>
          `${field.C2()} json ${config.notNull === true ? 'NOT NULL' : ''
          } ${MYSQLCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.Postgresql] = () =>
          `${field.C2()} jsonb ${config.notNull === true ? 'NOT NULL' : ''
          } ${POSTGRESCHARSET} ${hasDef ? `DEFAULT '${field.def}'` : ''}`;
        field[DBType.SqliteRemote] = field[DBType.Sqlite] = () =>
          `${field.C2()} text`;
        break;
      }
    }
    let __fields = Reflect.getMetadata(_fields, object);
    let __columns = Reflect.getMetadata(_columns, object);
    let __columnsNoId = Reflect.getMetadata(_columnsNoId, object);
    let __ids = Reflect.getMetadata(_ids, object);
    let __logicIds = Reflect.getMetadata(_logicIds, object);
    let __index = Reflect.getMetadata(_index, object);
    let __def = Reflect.getMetadata(_def, object);

    if (!__fields) {
      __fields = {};
      __columns = [];
      __columnsNoId = [];
      __ids = [];
      __index = [];
      __def = {};
    }
    __fields[propertyName] = field;
    __columns.push(propertyName);
    if (field.id === true) {
      __ids.push(propertyName);
    } else {
      __columnsNoId.push(propertyName);
    }
    if (field.logicId === true) {
      __logicIds.push(propertyName);
    }
    if (field.index === true) {
      __index.push(propertyName);
    }
    if (hasDef) {
      __def[propertyName] = field.def;
    }
    Reflect.defineMetadata(_fields, __fields, object);
    Reflect.defineMetadata(_columns, __columns, object);
    Reflect.defineMetadata(_columnsNoId, __columnsNoId, object);
    Reflect.defineMetadata(_ids, __ids, object);
    Reflect.defineMetadata(_logicIds, __logicIds, object);
    Reflect.defineMetadata(_index, __index, object);
    Reflect.defineMetadata(_def, __def, object);
    if (field.hasOwnProperty('logicDelete')) {
      Reflect.defineMetadata(_deleteState, field.logicDelete, object);
      Reflect.defineMetadata(_stateFileName, propertyName, object);
    }
  };
};

export class SetEx<T> extends Set {
  protected _key: keyof T;
  protected _onExist1?: (oldData: T, newData: T) => void | null;
  protected _onNotExist1?: (newData: T) => void | null;
  protected _replaceIfExits1: boolean;
  protected _onExist2?: (oldData: T, newData: T) => void | null;
  protected _onNotExist2?: (newData: T) => void | null;
  protected _replaceIfExits2: boolean;
  protected _map: Map<string, T> = new Map();
  /**
   * @param key 识别是否存在的对象的属性名
   * @param onExist 当存在时作何操作? oldData/newData 哪个将添加到set,由replaceItemWhenExits决定,默认是oldData生效
   * @param onNotExist 当不存在时作何操作?
   * @param replaceWhenExits 当存在时是否覆盖？
   * @param values 初始数组
   */
  constructor(option: {
    key: keyof T;
    /** add&addAll触发 */
    onExist1?: (oldData: T, newData: T) => void;
    /** add&addAll触发 */
    onNotExist1?: (newData: T) => void;
    /** add&addAll触发 */
    replaceIfExits1?: boolean;
    /** add2&addAll2触发 */
    onExist2?: (oldData: T, newData: T) => void;
    /** add2&addAll2触发 */
    onNotExist2?: (newData: T) => void;
    /** add2&addAll2触发 */
    replaceIfExits2?: boolean;
    values?: ReadonlyArray<T> | null;
  }) {
    super();
    this._key = option.key;
    this._onExist1 = option.onExist1;
    this._onNotExist1 = option.onNotExist1;
    this._replaceIfExits1 = option.replaceIfExits1 === true;
    this._onExist2 = option.onExist2;
    this._onNotExist2 = option.onNotExist2;
    this._replaceIfExits2 = option.replaceIfExits2 === true;
    if (option.values) {
      this.addAll(...option.values);
    }
  }

  /**
   *
   * 添加返回
   * @param {T} value
   * @returns {this} 当前对象
   */
  override add(value: T): this {
    let flag = false;
    const key = value[this._key] as string;
    const item = this._map.get(key);
    if (item) {
      flag = true;
      if (this._onExist1) {
        this._onExist1(item, value);
      }
      if (this._replaceIfExits1 === true) {
        super.delete(item);
        this._map.delete(key);
        flag = false;
      }
    }
    if (flag === false) {
      super.add(value);
      this._map.set(key, value);
      if (this._onNotExist1) {
        this._onNotExist1(value);
      }
    }
    return this;
  }
  /**
   * 批量添加
   * @param values
   * @returns 当前对象
   */
  addAll(...values: T[]): this {
    for (const value of values) {
      this.add(value);
    }
    return this;
  }
  /**
   *
   * 添加
   * @param {T} value
   * @returns {T} 添加成功的对象:可能是新加入集合的，也可能是原本存在的
   */
  add2(value: T): T {
    let flag = false;
    const key = value[this._key] as string;
    const item = this._map.get(key);
    let tmp = value;
    if (item) {
      flag = true;
      if (this._onExist2) {
        this._onExist2(item, value);
      }
      if (this._replaceIfExits2 === true) {
        super.delete(value);
        this._map.delete(key);
        flag = false;
      } else {
        tmp = item;
      }
    }
    if (flag === false) {
      super.add(value);
      this._map.set(key, value);
      if (this._onNotExist2) {
        this._onNotExist2(value);
      }
    }
    return tmp;
  }
  /**
   *
   * 添加并返回添加成功的对象:可能是新加入集合的，也可能是原本存在的
   * @param {T} values
   * @returns {T}
   */
  addAll2(values: T[]): T[] {
    const result: T[] = [];
    for (const value of values) {
      result.push(this.add2(value));
    }
    return result;
  }
  /**
   * 用key找到匹配的第一个对象
   * @param {*} key 这是对象的关键属性,而非对象
   * @returns {(T | null)}
   */
  find(key: T[keyof T]): T | null {
    return this._map.get(key as string) ?? null;
  }
  /**
   * 用key找到匹配的所有对象
   * @param {*} key 这是对象的关键属性,而非对象
   * @returns {T[]}
   */
  findAll(key: T[keyof T]): T[] {
    return iterate(key as string[])
      .map((k) => this._map.get(k))
      .filter((v) => v !== undefined)
      .toArray() as T[];
  }
  /**
   *
   * 用函数回调找到匹配的第一个对象
   * @param {(item: T) => boolean} fn
   * @returns {T[]}
   */
  filter(fn: (item: T) => boolean): T | null {
    for (const item of this) {
      if (fn(item) === true) {
        return item;
      }
    }
    return null;
  }
  /**
   *
   * 用函数回调找到匹配的所有对象
   * @param {(item: T) => boolean} fn
   * @returns {T[]}
   */
  filterAll(fn: (item: T) => boolean): T[] {
    const res = new Array<T>();
    this.forEach((item) => {
      if (fn(item) === true) {
        res.push(item);
      }
    });
    return res;
  }
  /**
   *
   * 是否存在key对应的对象
   * @param {*} value 这是对象的关键属性,而非对象
   * @returns {boolean}
   */
  override has(key: T[keyof T]): boolean {
    return this._map.has(key as string);
  }
  /**
   * 转为数组
   * @param param0
   * @returns
   */
  toArray({
    sort,
    each,
    filter,
    map,
  }: {
    sort?: (a: T, b: T) => number;
    each?: (a: T) => void;
    filter?: (a: T) => boolean;
    map?: (a: T) => T;
  } = {}): T[] {
    let list = Array.from(this);
    if (filter) {
      list = list.filter(filter);
    }
    if (sort) {
      list.sort(sort);
    }
    if (each) {
      list.forEach(each);
    }
    if (map) {
      list = list.map(map);
    }
    return list;
  }
  /**
   * 转为JSON对象
   * @param key
   * @param value
   * @param param2
   * @returns
   */
  toJSON<L = T>(
    key: keyof T,
    value?: keyof T,
    {
      sort,
      each,
      filter,
      map,
    }: {
      sort?: (a: T, b: T) => number;
      each?: (a: T) => void;
      filter?: (a: T) => boolean;
      map?: (a: T) => T;
    } = {}
  ): { [k: string]: L } {
    return Object.fromEntries(
      this.toArray({ sort, each, filter, map }).map((i) => [
        i[key],
        value ? i[value] : i,
      ])
    );
  }
  /**
   *
   * 删除key对应的对象
   * @param {*} _key 这是对象的关键属性,而非对象
   * @returns {boolean}
   */
  override delete(_key: T[keyof T]): boolean {
    const key = _key as string;
    const item = this._map.get(key);
    if (item) {
      super.delete(item);
      this._map.delete(key);
      return true;
    }
    return false;
  }
  /**
   *
   * 重置
   * @param {keyof T} key
   * @param {(oldData: T, newData: T) => void} [onExist]
   * @param {boolean} [replaceWhenExits=false]
   */
  reset(option: {
    key?: keyof T;
    /** add&addAll触发 */
    onExist1?: (oldData: T, newData: T) => void;
    /** add&addAll触发 */
    onNotExist1?: (newData: T) => void;
    /** add&addAll触发 */
    replaceIfExits1?: boolean;
    /** add2&addAll2触发 */
    onExist2?: (oldData: T, newData: T) => void;
    /** add2&addAll2触发 */
    onNotExist2?: (newData: T) => void;
    /** add2&addAll2触发 */
    replaceIfExits2?: boolean;
    values?: ReadonlyArray<T> | null;
  }): this {
    this.clear();
    this._map.clear();
    if (option.key) {
      this._key = option.key;
    }
    if (option.onExist1) {
      this._onExist1 = option.onExist1;
    }
    if (option.onNotExist1) {
      this._onNotExist1 = option.onNotExist1;
    }
    if (option.replaceIfExits1) {
      this._replaceIfExits1 = option.replaceIfExits1;
    }
    if (option.onExist2) {
      this._onExist2 = option.onExist2;
    }
    if (option.onNotExist2) {
      this._onNotExist2 = option.onNotExist2;
    }
    if (option.replaceIfExits2) {
      this._replaceIfExits2 = option.replaceIfExits2;
    }
    if (option.values) {
      this.addAll(...option.values);
    }
    return this;
  }
  /**
   *
   * @param param0 转为JSON对象，value可能是数组
   * @returns
   */
  toJSONArray({
    sort,
    each,
    filter,
    map,
  }: {
    sort?: (a: T, b: T) => number;
    each?: (a: T) => void;
    filter?: (a: T) => boolean;
    map?: (a: T) => T;
  } = {}) {
    const result: { [k: string]: T[keyof T][] } = {};
    const list = this.toArray({ sort, each, filter, map });
    for (const item of list) {
      for (const key in item) {
        if (!result[key]) {
          result[key] = [];
        }
        result[key]!.push(item[key]);
      }
    }
    return result;
  }
  /**
   * 转为hot-table支持的数组
   * @param param0
   * @param keys
   * @returns
   */
  toDataGrid(
    {
      sort,
      each,
      filter,
      map,
    }: {
      sort?: (a: T, b: T) => number;
      each?: (a: T) => void;
      filter?: (a: T) => boolean;
      map?: (a: T) => T;
    } = {},
    ...keys: (keyof T)[]
  ) {
    if (this.size === 0) {
      return [];
    }
    if (keys.length === 0) {
      keys = Object.keys(this.values().next().value) as any;
    }
    const result: (T[keyof T] | keyof T)[][] = [keys];
    const list = this.toArray({ sort, each, filter, map });
    for (const item of list) {
      const one: T[keyof T][] = [];
      for (const key of keys) {
        one.push(item[key]);
      }
      result.push(one);
    }
    return result;
  }
  /**
   * 转为饼图支持的数组
   * @param param0
   * @param keys
   * @returns
   */
  toPieGrid(
    {
      sort,
      each,
      filter,
      map,
    }: {
      sort?: (a: T, b: T) => number;
      each?: (a: T) => void;
      filter?: (a: T) => boolean;
      map?: (a: T) => T;
    } = {},
    ...keys: (keyof T)[]
  ): { [k: string]: { value: T[keyof T]; name: T[keyof T] }[] } {
    if (this.size === 0) {
      return {};
    }
    if (keys.length === 0) {
      keys = Object.keys(this.values().next().value) as any;
    }
    const result: { [k: string]: { value: T[keyof T]; name: T[keyof T] }[] } =
      {};
    const list = this.toArray({ sort, each, filter, map });
    for (const item of list) {
      const name = item[this._key];
      for (const key in item) {
        if (!result[key]) {
          result[key] = [];
        }
        result[key]!.push({ name, value: item[key] });
      }
    }
    return result;
  }

  set onExist1(onExist1: ((oldData: T, newData: T) => void) | undefined) {
    this._onExist1 = onExist1;
  }
  set onExist2(onExist2: ((oldData: T, newData: T) => void) | undefined) {
    this._onExist2 = onExist2;
  }
  set onNotExist1(onNotExist1: ((newData: T) => void) | undefined) {
    this._onNotExist1 = onNotExist1;
  }
  set onNotExist2(onNotExist2: ((newData: T) => void) | undefined) {
    this._onNotExist2 = onNotExist2;
  }
  set replaceIfExits1(replaceIfExits1: boolean) {
    this._replaceIfExits1 = replaceIfExits1;
  }
  set replaceIfExits2(replaceIfExits2: boolean) {
    this._replaceIfExits2 = replaceIfExits2;
  }
  set key(key: keyof T) {
    this._key = key;
  }
}

type Patter = {
  'upper-letter': patter;
  'lower-letter': patter;
  letter: patter;
  'letter-2': patter;
  chinese: patter;
  zonecode: patter;
  qq: patter;
  wechat: patter;
  email: patter;
  mobile: patter;
  tel: patter;
  allphone: patter;
  license: patter;
  organ: patter;
  bank: patter;
  float: patter;
  string: patter;
  plus: patter;
  'plus-int': patter;
  'plus-float': patter;
  minus: patter;
  'minus-int': patter;
  'minus-float': patter;
  'un-plus': patter;
  'un-plus-int': patter;
  'un-plus-float': patter;
  'un-minus': patter;
  'un-minus-int': patter;
  'un-minus-float': patter;
  number: patter;
  number2: patter;
  int: patter;
  price: patter;
  'price-2': patter;
  'price-3': patter;
  'price-4': patter;
  'price-5': patter;
  'rebate-1': patter;
  'rebate-10': patter;
  'rebate-100': patter;
  url: patter;
  post: patter;
  hk: patter;
  tw: patter;
};
const patterns: Patter = {
  'upper-letter': ['只能输入大写字母', /^[A-Z]+$/],
  'lower-letter': ['只能输入小写字母', /^[a-z]+$/],
  letter: ['只能输入字母', /^[a-zA-Z]+$/],
  'letter-2': ['只能是两位字母', /^[a-zA-Z]{2}$/],
  chinese: ['只能输入中文', /^[\u0391-\uFFE5]+$/],
  zonecode: ['邮编格式错误', /^\d{6}$/],
  qq: ['QQ格式错误', /^[1-9]\d{4,}$/],
  wechat: ['微信号码错误', /^[a-zA-Z]{1}[-_a-zA-Z0-9]{5,19}$/],
  email: ['邮箱格式错误', /^([0-9A-Za-z\-_.]+)@([0-9a-z]+\.[a-z]{2,3}(\.[a-z]{2})?)$/],
  mobile: ['手机号码格式错误', /^1(3|4|5|6|7|8)\d{9}$/],
  tel: ['电话号码格式错误', /^0\d{2,3}-?\d{7,8}$/],
  allphone: ['电话号码格式错误', /^1(3|4|5|6|7|8)\d{9}$|(^0\d{2,3}-?\d{7,8}$)/],
  license: ['营业执照格式错误', /^[A-Za-z0-9]{15}$|^[A-Za-z0-9]{18}$/],
  organ: ['组织机构代码格式错误', /^[0-9A-Za-z]{8}\-[0-9A-Za-z]$/],
  bank: ['银行卡号格式错误', /^(\d{15}|\d{16}|\d{17}|\d{18}|\d{19})$/],
  float: ['只能输入小数', /^-?(\d+\.\d+)$/],
  string: ['不可输入回车、tab', /^[^\n\r\t]$/],
  plus: ['只能输入正数', /^\d*[1-9]\d*$|^\d+\.\d*[0-9]\d*$/],
  'plus-int': ['只能输入正整数', /^\d*[1-9]\d*$/],
  'plus-float': ['只能输入正小数', /^\d+\.\d*[0-9]\d*$/],
  minus: ['只能输入负数', /^-\d*[1-9]\d*$|^-\d+\.\d*[0-9]\d*$/],
  'minus-int': ['只能输入负整数', /^-\d*[1-9]\d*$/],
  'minus-float': ['只能输入负小数', /^-\d+\.\d*[0-9]\d*$/],
  'un-plus': ['只能输入0或负数', /^(-[0-9]\d*|-\d+\.\d+|0[0]*|0\.[0]+)$/],
  'un-plus-int': ['只能输入0或负整数', /^(-[0-9]\d*|0[0]*)$/],
  'un-plus-float': ['只能输入0或负小数', /^(-\d+\.\d+|0[0]*|0\.[0]+)$/],
  'un-minus': ['只能输入0或者正数', /^([0-9]\d*|\d+\.\d+|0[0]*)$/],
  'un-minus-int': ['只能输入0或者正整数', /^([0-9]\d*)$/],
  'un-minus-float': ['只能输入0或正小数', /^(\d+\.\d+|0[0]*|0\.[0]+)$/],

  number: ['只能输入数字', /^[1-9]\d*$|^0\.\d*[0-9]\d*$|^[1-9]\d*\.\d*[0-9]\d*$|^-[1-9]\d*$|^-0\.\d*[0-9]\d*$|^-[1-9]\d*\.\d*[0-9]\d*$/],
  number2: ['只能输入数字(正负数和0)', /^[1-9]\d*$|^0$|^0\.\d*[0-9]\d*$|^[1-9]\d*\.\d*[0-9]\d*$|^-[1-9]\d*$|^-0\.\d*[0-9]\d*$|^-[1-9]\d*\.\d*[0-9]\d*$/],
  int: ['只能输入整数', /^[1-9]\d*$|^-[1-9]\d*$/],
  price: ['只能是正数且最多两位小数', /^([0-9]\d*|\d+\.\d{1,2}|0[0]*)$/],
  'price-2': ['金额大于0且最多两位小数', /^([1-9]\d*(\.\d{1,2})?)$|(0\.\d{1,2})$/],
  'price-3': ['只能是正数且最多3位小数', /^([0-9]\d*|\d+\.\d{1,3}|0[0]*)$/],
  'price-4': ['只能是正数且最多4位小数', /^([0-9]\d*|\d+\.\d{1,4}|0[0]*)$/],
  'price-5': ['只能是正数且最多5位小数', /^([0-9]\d*|\d+\.\d{1,5}|0[0]*)$/],
  'rebate-1': ['只能在0到1之间且最多两位小数', /^(0|1|(0\.([0-9]){1,2}))$/],
  'rebate-10': ['只能在0到10之间且最多两位小数', /^((([0-9])\.([0-9]){1,2})$)|(^([1-9]|10)$)/],
  'rebate-100': ['只能在0到100之间且最多两位小数', /^((([0-9]){1,2}\.([0-9]){1,2})$)|(^([1-9]{1,2}|10|100)$)/],
  url: ['网址格式错误', /http(s)*:\/\/[A-Za-z0-9]+\.[A-Za-z0-9]+[\/=\?%\-&_~`@[\]\':+!#]*([^<>\"\"])*$/],
  post: ['邮编格式错误', /^\d{6}$/],
  hk: ['港澳居民通行证格式错误', /^[HMhm]\d{8}$/],
  tw: ['台湾居民通行证格式错误', /(^[A-Za-z]\d{9}$)|(^\d{8}$)|(^\d{10}$)/]
};
const ms = {
  required: (realLabel: string) => `必须输入${realLabel}`,
  mkEq: (vl: string | number, realLabel: string) => `${realLabel}必须等于${vl}`,
  mkNe: (vl: string | number, realLabel: string) => `${realLabel}不能等于${vl}`,
  mkLt: (vl: string | number, realLabel: string) => `${realLabel}必须小于${vl}`,
  mkLe: (vl: string | number, realLabel: string) => `${realLabel}必须小于或等于${vl}`,
  mkGt: (vl: string | number, realLabel: string) => `${realLabel}必须大于${vl}`,
  mkGe: (vl: string | number, realLabel: string) => `${realLabel}必须大于或等于${vl}`,
  mkEqLength: (vl: number, realLabel: string) => `${realLabel}必须等于${vl}个字`,
  mkNeLength: (vl: number, realLabel: string) => `${realLabel}不能等于${vl}个字`,
  mkLtLength: (vl: number, realLabel: string) => `${realLabel}必须少于${vl}个字`,
  mkLeLength: (vl: number, realLabel: string) => `${realLabel}最多${vl}个字`,
  mkGtLength: (vl: number, realLabel: string) => `${realLabel}必须多于${vl}个字`,
  mkGeLength: (vl: number, realLabel: string) => `${realLabel}最少${vl}个字`,
  mkEnum: (vl: string[], realLabel: string) => `${realLabel}只能输入${vl.join(',')}中的一个`,
  mkPattern: (realLabel: string) => `${realLabel}格式错误`,
  mkCustom: (realLabel: string) => `${realLabel}格式错误`,
};
export interface ValidItemType<FormType> {
  label?: string;
  prop?: string;
  ms?: Partial<Record<keyof typeof ms | 'mkInlay' | 'mkIdCard' | 'mkBusinessLicense', string>>;
  required?: boolean | ((form: FormType) => boolean);
  mkType?: 'string' | 'number' | 'boolean';
  mkRealProp?: string | ((form: FormType) => string);
  mkLabel?: string | ((form: FormType) => string);
  mkTrigger?: 'blur' | 'change';

  mkEq?: string | number | ((form: FormType) => string | number | undefined);
  mkNe?: string | number | ((form: FormType) => string | number | undefined);
  mkLt?: string | number | ((form: FormType) => string | number | undefined);
  mkLe?: string | number | ((form: FormType) => string | number | undefined);
  mkGe?: string | number | ((form: FormType) => string | number | undefined);
  mkGt?: string | number | ((form: FormType) => string | number | undefined);

  mkEqProp?: string | ((form: FormType) => string | undefined);
  mkNeProp?: string | ((form: FormType) => string | undefined);
  mkLtProp?: string | ((form: FormType) => string | undefined);
  mkLeProp?: string | ((form: FormType) => string | undefined);
  mkGeProp?: string | ((form: FormType) => string | undefined);
  mkGtProp?: string | ((form: FormType) => string | undefined);

  mkEqLength?: number | ((form: FormType) => number | undefined);
  mkNeLength?: number | ((form: FormType) => number | undefined);
  mkLtLength?: number | ((form: FormType) => number | undefined);
  mkLeLength?: number | ((form: FormType) => number | undefined);
  mkGeLength?: number | ((form: FormType) => number | undefined);
  mkGtLength?: number | ((form: FormType) => number | undefined);

  mkEqLengthProp?: string | ((form: FormType) => string | undefined);
  mkNeLengthProp?: string | ((form: FormType) => string | undefined);
  mkLtLengthProp?: string | ((form: FormType) => string | undefined);
  mkLeLengthProp?: string | ((form: FormType) => string | undefined);
  mkGeLengthProp?: string | ((form: FormType) => string | undefined);
  mkGtLengthProp?: string | ((form: FormType) => string | undefined);

  mkEnum?: string[] | ((form: FormType) => string[] | undefined);
  mkInlay?: keyof Patter | ((form: FormType) => keyof Patter | undefined);
  mkPattern?: RegExp | ((form: FormType) => RegExp | undefined);
  mkCustom?: (form: FormType, value: any, prop: string) => Promise<Error | null>;
  mkTrim?: boolean;
  mkIdCard?: boolean | ((form: FormType) => boolean | undefined);
  mkBusinessLicense?: boolean | ((form: FormType) => boolean | undefined);
}
const defProps: ValidItemType<any> = {
  mkType: 'string',
  mkTrigger: 'blur',
  mkTrim: true,
};
async function runSequentially<T>(
  promiseFactories: (() => Promise<T>)[]
): Promise<T[]> {
  const results: T[] = [];
  try {
    for (const createPromise of promiseFactories) {
      const result = await createPromise();
      results.push(result);
    }
    return results;
  } catch (error) {
    throw error;
  }
}
/**
 * 营业执照编号验证（兼容15位旧版和18位新版）
 * @param {string} code 营业执照编号
 * @returns {boolean} 是否合法
 */
function validateBusinessLicense(code: string): boolean {
  // 统一转换为大写并去除空格
  code = code.toUpperCase().replace(/\s/g, '');

  // 15位验证（纯数字+校验码验证）
  if (code.length === 15) {
    return validate15DigitLicense(code);
  }

  // 18位验证（格式+校验码）
  if (code.length === 18) {
    return validate18DigitLicense(code);
  }

  return false;
}

/**
 * 15位营业执照验证（工商注册号）
 * @param {string} code 15位数字
 * @returns {boolean} 是否合法
 */
function validate15DigitLicense(code: string): boolean {
  // 基础正则校验
  if (!/^\d{15}$/.test(code)) return false;

  // 校验码计算逻辑（基于GS15-2006标准）
  const pre14 = code.substring(0, 14);
  const checkCode = code[14];
  const weights = [10, 1, 3, 5, 7, 9, 11, 2, 4, 6, 8, 10, 12, 14];

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    sum += parseInt(pre14[i]!, 10) * weights[i]!;
  }

  const computedCode = (31 - (sum % 31)) % 31;
  return checkCode === (computedCode === 0 ? '0' : String(computedCode));
}

/**
 * 18位统一社会信用代码验证
 * @param {string} code 18位代码
 * @returns {boolean} 是否合法
 */
function validate18DigitLicense(code: string): boolean {
  // 格式正则校验（排除I/O/Z/S/V等字符）
  if (!/^[1-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(code)) {
    return false;
  }

  // 校验码计算逻辑（基于GB 32100-2015标准）
  const chars = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
  const checkCode = code[17];
  let sum = 0;

  // 计算前17位的加权和
  for (let i = 0; i < 17; i++) {
    const charValue = chars.indexOf(code[i]!);
    if (charValue === -1) return false;
    sum += charValue * weights[i]!;
  }

  // 计算校验码
  const remainder = sum % 31;
  const computedCodeIndex = (31 - remainder) % 31;
  const computedCode = chars[computedCodeIndex];

  return checkCode === computedCode;
}
export class ValidItem<FormType> {
  protected props: ValidItemType<FormType>;
  protected data: FormType;
  protected value: any;
  constructor(validItem: ValidItemType<FormType>, data: FormType) {
    this.props = Object.assign({}, defProps, validItem);
    this.data = data;
  }
  get length() {
    const v = this.value;
    return this.isEmptyValue(v) ? 0 : `${v}`.length;
  }
  get realLabel() {
    return this.props.mkLabel ? typeof this.props.mkLabel === 'function' ? this.props.mkLabel(this.data) : this.props.mkLabel : (this.props.label || '');
  }
  get emptyValue() {
    return this.isEmptyValue(this.value);
  }
  get valueMe() {
    const path = this.props.mkRealProp ? typeof this.props.mkRealProp === 'function' ? this.props.mkRealProp(this.data) : this.props.mkRealProp : (this.props.prop || '');
    const v = LGet(this.data, path);
    return this.valueConvert(v);
  }
  isEmptyValue(vl: any) {
    return vl === '' || vl === undefined || vl === null;
  }
  valueConvert(value: any) {
    switch (this.props.mkType) {
      case 'string':
        return this.isEmptyValue(value)
          ? ''
          : this.props.mkTrim
            ? `${value}`.trim()
            : `${value}`;
      case 'number':
        return this.isEmptyValue(value) ? null : value - 0;
      case 'boolean':
        return this.isEmptyValue(value)
          ? null
          : value === 'true' || value === true;
      default:
        return value;
    }
  }
  async required() {
    const required = typeof this.props.required === 'function' ? this.props.required(this.data) : this.props.required;
    if (required === true && this.emptyValue === true) {
      throw new Error(this.props.ms?.required || ms.required(this.realLabel));
    }
  }
  async mkEnum() {
    const target = typeof this.props.mkEnum === 'function' ? this.props.mkEnum(this.data) : this.props.mkEnum;
    if (target && target.includes(this.value) === false) {
      throw new Error(this.props.ms?.mkEnum || ms.mkEnum(target, this.realLabel));
    }
  }
  async mkInlay() {
    const target = typeof this.props.mkInlay === 'function' ? this.props.mkInlay(this.data) : this.props.mkInlay;
    if (target && this.emptyValue === false && patterns.hasOwnProperty(target) === true && (patterns[target][1]).test(this.value) === false) {
      throw new Error(this.props.ms?.mkInlay || patterns[target][0]);
    }
  }
  async mkPattern() {
    const target = typeof this.props.mkPattern === 'function' ? this.props.mkPattern(this.data) : this.props.mkPattern;
    if (target && this.emptyValue === false && target.test(this.value) === false) {
      throw new Error(this.props.ms?.mkPattern || ms.mkPattern(this.realLabel));
    }
  }
  async mkCustom() {
    return await this.props.mkCustom!(this.data, this.value, this.props.prop!);
  }
  async mkEq() {
    const target = (typeof this.props.mkEq === 'function' ? this.props.mkEq(this.data) : this.props.mkEq);
    if (target && this.value !== target) {
      throw new Error(this.props.ms?.mkEq || ms.mkEq(target, this.realLabel));
    }
  }
  async mkNe() {
    const target = (typeof this.props.mkNe === 'function' ? this.props.mkNe(this.data) : this.props.mkNe);
    if (target && this.value === target) {
      throw new Error(this.props.ms?.mkNe || ms.mkNe(target, this.realLabel));
    }
  }
  async mkLt() {
    const target = (typeof this.props.mkLt === 'function' ? this.props.mkLt(this.data) : this.props.mkLt);
    if (target && this.value >= target) {
      throw new Error(this.props.ms?.mkLt || ms.mkLt(target, this.realLabel));
    }
  }
  async mkLe() {
    const target = (typeof this.props.mkLe === 'function' ? this.props.mkLe(this.data) : this.props.mkLe);
    if (target && this.value > target) {
      throw new Error(this.props.ms?.mkLe || ms.mkLe(target, this.realLabel));
    }
  }
  async mkGt() {
    const target = (typeof this.props.mkGt === 'function' ? this.props.mkGt(this.data) : this.props.mkGt);
    if (target && this.value <= target) {
      throw new Error(this.props.ms?.mkGt || ms.mkGt(target, this.realLabel));
    }
  }
  async mkGe() {
    const target = (typeof this.props.mkGe === 'function' ? this.props.mkGe(this.data) : this.props.mkGe);
    if (target && this.value < target) {
      throw new Error(this.props.ms?.mkGe || ms.mkGe(target, this.realLabel));
    }
  }
  async mkEqProp() {
    const path = (typeof this.props.mkEqProp === 'function' ? this.props.mkEqProp(this.data) : this.props.mkEqProp);
    if (path) {
      const target = LGet(this.data, path);
      if (this.value !== target) {
        throw new Error(this.props.ms?.mkEq || ms.mkEq(target, this.realLabel));
      }
    }
  }
  async mkNeProp() {
    const path = (typeof this.props.mkNeProp === 'function' ? this.props.mkNeProp(this.data) : this.props.mkNeProp);
    if (path) {
      const target = LGet(this.data, path);
      if (this.value === target) {
        throw new Error(this.props.ms?.mkNe || ms.mkNe(target, this.realLabel));
      }
    }
  }
  async mkLtProp() {
    const path = (typeof this.props.mkLtProp === 'function' ? this.props.mkLtProp(this.data) : this.props.mkLtProp);
    if (path) {
      const target = LGet(this.data, path);
      if (this.value >= target) {
        throw new Error(this.props.ms?.mkLt || ms.mkLt(target, this.realLabel));
      }
    }
  }
  async mkLeProp() {
    const path = (typeof this.props.mkLeProp === 'function' ? this.props.mkLeProp(this.data) : this.props.mkLeProp);
    if (path) {
      const target = LGet(this.data, path);
      if (this.value > target) {
        throw new Error(this.props.ms?.mkLe || ms.mkLe(target, this.realLabel));
      }
    }
  }
  async mkGtProp() {
    const path = (typeof this.props.mkGtProp === 'function' ? this.props.mkGtProp(this.data) : this.props.mkGtProp);
    if (path) {
      const target = LGet(this.data, path);
      if (this.value <= target) {
        throw new Error(this.props.ms?.mkGt || ms.mkGt(target, this.realLabel));
      }
    }
  }
  async mkGeProp() {
    const path = (typeof this.props.mkGeProp === 'function' ? this.props.mkGeProp(this.data) : this.props.mkGeProp);
    if (path) {
      const target = LGet(this.data, path);
      if (this.value < target) {
        throw new Error(this.props.ms?.mkGe || ms.mkGe(target, this.realLabel));
      }
    }
  }
  async mkEqLength() {
    const target = (typeof this.props.mkEqLength === 'function' ? this.props.mkEqLength(this.data) : this.props.mkEqLength);
    if (target !== undefined && this.length !== target) {
      throw new Error(this.props.ms?.mkEqLength || ms.mkEqLength(target, this.realLabel));
    }
  }
  async mkNeLength() {
    const target = (typeof this.props.mkNeLength === 'function' ? this.props.mkNeLength(this.data) : this.props.mkNeLength);
    if (target !== undefined && this.length === target) {
      throw new Error(this.props.ms?.mkNeLength || ms.mkNeLength(target, this.realLabel));
    }
  }
  async mkLtLength() {
    const target = (typeof this.props.mkLtLength === 'function' ? this.props.mkLtLength(this.data) : this.props.mkLtLength);
    if (target !== undefined && this.length >= target) {
      throw new Error(this.props.ms?.mkLtLength || ms.mkLtLength(target, this.realLabel));
    }
  }
  async mkLeLength() {
    const target = (typeof this.props.mkLeLength === 'function' ? this.props.mkLeLength(this.data) : this.props.mkLeLength);
    if (target !== undefined && this.length > target) {
      throw new Error(this.props.ms?.mkLeLength || ms.mkLeLength(target, this.realLabel));
    }
  }
  async mkGtLength() {
    const target = (typeof this.props.mkGtLength === 'function' ? this.props.mkGtLength(this.data) : this.props.mkGtLength);
    if (target !== undefined && this.length <= target) {
      throw new Error(this.props.ms?.mkGtLength || ms.mkGtLength(target, this.realLabel));
    }
  }
  async mkGeLength() {
    const target = (typeof this.props.mkGeLength === 'function' ? this.props.mkGeLength(this.data) : this.props.mkGeLength);
    if (target !== undefined && this.length < target) {
      throw new Error(this.props.ms?.mkGeLength || ms.mkGeLength(target, this.realLabel));
    }
  }
  async mkEqLengthProp() {
    const path = (typeof this.props.mkEqLengthProp === 'function' ? this.props.mkEqLengthProp(this.data) : this.props.mkEqLengthProp);
    if (path) {
      const value = LGet(this.data, path);
      const target = this.isEmptyValue(value) ? 0 : `${value}`.length;
      if (this.value !== target) {
        throw new Error(this.props.ms?.mkEqLength || ms.mkEqLength(target, this.realLabel));
      }
    }
  }
  async mkNeLengthProp() {
    const path = (typeof this.props.mkNeLengthProp === 'function' ? this.props.mkNeLengthProp(this.data) : this.props.mkNeLengthProp);
    if (path) {
      const value = LGet(this.data, path);
      const target = this.isEmptyValue(value) ? 0 : `${value}`.length;
      if (this.value === target) {
        throw new Error(this.props.ms?.mkNeLength || ms.mkNeLength(target, this.realLabel));
      }
    }
  }
  async mkLtLengthProp() {
    const path = (typeof this.props.mkLtLengthProp === 'function' ? this.props.mkLtLengthProp(this.data) : this.props.mkLtLengthProp);
    if (path) {
      const value = LGet(this.data, path);
      const target = this.isEmptyValue(value) ? 0 : `${value}`.length;
      if (this.value >= target) {
        throw new Error(this.props.ms?.mkLtLength || ms.mkLtLength(target, this.realLabel));
      }
    }
  }
  async mkLeLengthProp() {
    const path = (typeof this.props.mkLeLengthProp === 'function' ? this.props.mkLeLengthProp(this.data) : this.props.mkLeLengthProp);
    if (path) {
      const value = LGet(this.data, path);
      const target = this.isEmptyValue(value) ? 0 : `${value}`.length;
      if (this.value > target) {
        throw new Error(this.props.ms?.mkLeLength || ms.mkLeLength(target, this.realLabel));
      }
    }
  }
  async mkGtLengthProp() {
    const path = (typeof this.props.mkGtLengthProp === 'function' ? this.props.mkGtLengthProp(this.data) : this.props.mkGtLengthProp);
    if (path) {
      const value = LGet(this.data, path);
      const target = this.isEmptyValue(value) ? 0 : `${value}`.length;
      if (this.value <= target) {
        throw new Error(this.props.ms?.mkGtLength || ms.mkGtLength(target, this.realLabel));
      }
    }
  }
  async mkGeLengthProp() {
    const path = (typeof this.props.mkGeLengthProp === 'function' ? this.props.mkGeLengthProp(this.data) : this.props.mkGeLengthProp);
    if (path) {
      const value = LGet(this.data, path);
      const target = this.isEmptyValue(value) ? 0 : `${value}`.length;
      if (this.value < target) {
        throw new Error(this.props.ms?.mkGeLength || ms.mkGeLength(target, this.realLabel));
      }
    }
  }
  async mkIdCard() {
    const mkIdCard = typeof this.props.mkIdCard === 'function' ? this.props.mkIdCard(this.data) : this.props.mkIdCard
    if (mkIdCard === true) {
      // 15位身份证号码正则表达式
      const regex15 =
        /^[1-9]\d{5}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}$/;
      // 18位身份证号码正则表达式
      const regex18 =
        /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/;
      const value = this.value;
      // 首先检查是否符合15位或18位的正则表达式
      if (regex15.test(value)) {
        return;
      } else if (regex18.test(value)) {
        // 18位身份证号码需要进一步校验校验位
        const factor = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
        const parity = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
        let sum = 0;
        for (let i = 0; i < 17; i++) {
          sum += parseInt(value[i]) * factor[i]!;
        }
        const mod = sum % 11;
        const checkDigit = value[17].toUpperCase();
        if (checkDigit !== parity[mod]) {
          throw new Error(this.props.ms?.mkIdCard || '身份证号码错误');
        } else {
          return;
        }
      }
      throw new Error(this.props.ms?.mkIdCard || '身份证号码错误');
    }
  }
  async mkBusinessLicense() {
    const mkBusinessLicense = typeof this.props.mkBusinessLicense === 'function' ? this.props.mkBusinessLicense(this.data) : this.props.mkBusinessLicense
    if (mkBusinessLicense === true) {
      if (!validateBusinessLicense(this.value)) {
        throw new Error(this.props.ms?.mkBusinessLicense || '营业执照号码错误');
      }
    }
  }
  element(data?: FormType) {
    if (data) {
      this.data = data;
    }
    return [
      {
        validator: (_rule: any, value: any, callback: (e?: Error) => void, _source: any, _op: any) => {
          this.value = value;
          runSequentially(Object.keys(this.props).filter((key: any) =>
            (this.props as any)[key] !== undefined
            && (this as any)[key]
            && typeof (this as any)[key] === 'function'
          ).map((key) => () => (this as any)[key]())).catch((error) => callback(error)).then(() => callback());
        },
        trigger: this.props.mkTrigger,
        required: typeof this.props.required === 'function' ? this.props.required(this.data) : this.props.required
      }
    ];
  }
  wot(data?: FormType) {
    if (data) {
      this.data = data;
    }
    return [
      {
        required:
          typeof this.props.required === 'function'
            ? this.props.required(this.data)
            : this.props.required,
        message: this.props.ms?.required || ms.required(this.realLabel),
        validator: (val: any) => {
          this.value = val;
          return runSequentially(
            Object.keys(this.props)
              .filter(
                (key: any) =>
                  (this.props as any)[key] !== undefined &&
                  (this as any)[key] &&
                  typeof (this as any)[key] === 'function',
              )
              .map((key) => () => (this as any)[key]()),
          )
        }
      }
    ];
  }
  async service(data?: FormType) {
    if (data) {
      this.data = data;
    }
    this.value = this.valueMe;
    for (const key in this.props) {
      if (
        (this.props as any)[key] !== undefined
        && (this as any)[key]
        && typeof (this as any)[key] === 'function'
      ) {
        await (this as any)[key]();
      }
    }
  }
}
export class ValidForm<FormType> {
  protected valids: Record<string, ValidItem<FormType>>;
  protected mkCustoms: ((data: FormType) => Promise<void>)[];
  protected data: FormType;
  constructor(data: FormType, ...valids: ValidFormType<FormType>[]) {
    this.valids = {};
    this.data = data;
    this.mkCustoms = [];
    for (const valid of valids) {
      Object.entries(valid.items).forEach(([k, v]) => {
        const vv = v as ValidItemType<FormType>;
        vv.prop = k;
        this.valids[k] = new ValidItem(vv, data);
      });
      if (valid.mkCustom) {
        this.mkCustoms.push(valid.mkCustom);
      }
    }
  }
  async mkCustom() {
    for (const mkCustom of this.mkCustoms) {
      await mkCustom(this.data);
    }
  }
  /**
   * 获取验证规则 for Element
   * 还需要手动调用valid方法做全局验证
   * @returns
   */
  element(data?: FormType) {
    return Object.fromEntries(
      Object.entries(this.valids).map(([k, v]) => [k, v.element(data)])
    );
  }
  /**
   * 获取验证规则 for WOT
   * 还需要手动调用valid方法做全局验证
   * @returns
   */
  wot(data?: FormType) {
    return Object.fromEntries(
      Object.entries(this.valids).map(([k, v]) => [k, v.wot(data)])
    );
  }
  /**
   * 获取验证规则 for Service
   * [不]需要手动调用valid方法做全局验证
   * @returns
   */
  async service(data?: FormType) {
    for (const key in this.valids) {
      await this.valids[key]?.service(data);
    }
    await this.valid();
  }
  async valid() {
    await this.mkCustom();
  }
}

//#region 类型定义
type Paths<T, ParentPath extends string = ''> = {
  [K in keyof T]: T[K] extends Record<string, any> | Array<any>
  ? ParentPath extends ''
  ? Paths<T[K], `${K & string}`>
  : `${ParentPath}.${Paths<T[K], K & string>}`
  : ParentPath extends ''
  ? K & string
  : `${ParentPath}.${K & string}`;
}[keyof T];
type ArrayPaths<T, ParentPath extends string> = T extends Array<infer U>
  ? U extends Record<string, any>
  ? `${ParentPath}.${number}` | `${ParentPath}.${number}.${Paths<U>}`
  : `${ParentPath}.${number}`
  : never;
type AllPaths<T> = T extends Record<string, any>
  ? {
    [K in keyof T]: T[K] extends Array<infer U>
    ? `${K & string}` | ArrayPaths<T[K], K & string>
    : T[K] extends Record<string, any>
    ? `${K & string}` | `${K & string}.${Paths<T[K]>}`
    : `${K & string}`;
  }[keyof T]
  : never;
export type ValidFormType<FormType> = {
  items: Partial<{
    [K in AllPaths<FormType>]: ValidItemType<FormType>;
  }>;
  mkCustom?: (data: FormType) => Promise<void>;
};
type patter = [string, RegExp];
// #endregion


export class Enum {
  private _value: string;
  private _desc: string;
  private _config: string[];
  constructor(value: string, desc: string, ...config: string[]) {
    this._value = value;
    this._desc = desc;
    this._config = config;
  }
  eq(value: string | number | undefined | null): boolean {
    if (value === undefined) {
      return false;
    }
    if (value === null) {
      return false;
    }
    if (typeof value === 'number') {
      return this._value === `${value}`;
    }
    return this._value === `${value}`;
  }
  value(): string {
    return this._value;
  }
  desc(): string {
    return this._desc;
  }
  config(): string[] {
    return this._config;
  }
}
export type EnumMap = Record<string, Enum>;
export type GlobalArray = Record<string, Array<[string, string]>>;
export type GlobalMap = Record<string, Record<string, string>>;
export interface EnmuJson {
  GlobalArray: GlobalArray;
  GlobalMap: GlobalMap;
}
let configData: EnmuJson | null = null;
export const getEnums = (GlobalValues: EnumMap): {
  EnumArray: (key: string, { hidden }?: { hidden?: string[] }) => Array<[string, string]>;
  EnumMap: (key: string, { hidden }?: { hidden?: string[] }) => Record<string, string>;
  all: EnmuJson;
  getKV: (key: string, { disabled, hidden, empty }?: { disabled?: string[]; hidden?: string[]; empty?: [string, string] }) => Array<{ value: string; label: string; disabled?: boolean; hidden?: boolean }>;
} => {
  if (!configData) {
    const result: EnmuJson = {
      GlobalArray: {},
      GlobalMap: {}
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    Object.keys(GlobalValues).forEach((item) => {
      // const guess = /([\w\W]+)_([^_]+)$/.exec(item);
      const guess = item.replace(new RegExp(`_${GlobalValues[item]!.value()}`, 'i'), '');
      if (guess) {
        if (!result.GlobalArray[guess]) {
          result.GlobalArray[guess] = [];
        }
        result.GlobalArray[guess]!.push([GlobalValues[item]!.value(), GlobalValues[item]!.desc()]);
        if (!result.GlobalMap[guess]) {
          result.GlobalMap[guess] = {};
        }
        result.GlobalMap[guess]![GlobalValues[item]!.value()] = GlobalValues[item]!.desc();
      }
    });
    configData = result;
  }
  return {
    EnumArray: (key: string, { hidden }: { hidden?: string[] } = {}) =>
      configData!.GlobalArray[key]!
        .filter(item => (hidden ? !hidden.includes(item[0]!) : true)),
    EnumMap: (key: string, { hidden }: { hidden?: string[] } = {}) =>
      Object.fromEntries(
        configData!.GlobalArray[key]!
          .filter(item => (hidden ? !hidden.includes(item[0]!) : true))
      ),
    all: configData!,
    getKV: (key: string, { disabled, hidden, empty }: { disabled?: string[]; hidden?: string[]; empty?: [string, string] } = {}) => {
      const result = configData!.GlobalArray[key]!
        .map(item => ({
          value: item[0],
          label: item[1],
          disabled: disabled?.includes(item[0]),
          hidden: hidden?.includes(item[0])
        }))
        .filter(item => (hidden ? !hidden.includes(item.value) : true));
      if (empty) {
        result.push({
          value: empty[0],
          label: empty[1],
          disabled: false,
          hidden: false
        });
      }
      return result;
    }

  };
}