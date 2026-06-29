import { _fields, _columns, AField } from 'baja-lite-field';
import { add, calc } from '../math.js';
import { emptyString } from '../string.js';
import { _tableName, _transformer } from '../const/symbols.js';
import {
    MapperIfUndefined,
    MethodOption,
    PageQuery,
    SelectResult,
    SqlMapper,
    SyncMode,
} from '../const/types.js';
import type { SqlService } from './service.js';

const IF_PROCEED = function <T extends object>() {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn = descriptor.value;
        descriptor.value = function (this: StreamQuery<T>) {
            if (this.if_proceed) {
                // eslint-disable-next-line prefer-rest-params
                const args = Array.from(arguments);
                fn.call(this, ...args);
            } else {
                this.if_proceed = true;
            }
            return this;
        };
    };
};
/*** 是否执行最终查询/操作*/
const IF_EXEC = function <T extends object>(def: any) {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const fn = descriptor.value;
        descriptor.value = async function (this: StreamQuery<T>) {
            if (this.if_proceed && this.if_exec) {
                // eslint-disable-next-line prefer-rest-params
                const args = Array.from(arguments);
                return await fn.call(this, ...args);
            } else {
                return def;
            }
        };
    };
};
export class StreamQuery<T extends object> {
    private _prefix = 0;
    private _index = 0;

    private _wheres: string[] = [];

    private _andQuerys: StreamQuery<T>[] = [];
    private _orQuerys: StreamQuery<T>[] = [];

    private _paramKeys: Record<string, string[] | Record<string, string> | string> = {};
    private _param: Record<string, any> = {};
    public if_proceed = true;
    public if_exec = true;

    private _distinct = false;
    private _columns: string[] = [];

    private _updates?: Partial<T>;
    private _updateColumns: string[] = [];

    private _groups: string[] = [];
    private _orders: string[] = [];

    private _startRow = -1;
    private _pageSize = -1;

    private _service: SqlService<T>;
    private [_fields]: Record<string, AField>;
    private [_columns]: string[];
    constructor(service: SqlService<T>, __fields: Record<string, AField>, __columns: string[]) {

        this._prefix = parseInt(`${Math.random() * 1000}`);
        this._service = service;
        this[_fields] = __fields;
        this[_columns] = __columns;
    }
    /** 将当前stream重置 */
    reset() {
        this._index = 0;
        this._wheres.length = 0;
        this._param = {};
        this._paramKeys = {};
        this._pageSize = -1;
        this._startRow = -1;
        this._orders.length = 0;
        this._groups.length = 0;
        this._columns.length = 0;
        this._updateColumns.length = 0;
        return this;
    }
    // #region 条件
    /** 为下次链条执行提供条件判断：非异步方法跳过，异步方法不执行并返回默认值 */
    @IF_PROCEED<T>()
    if(condition: boolean) {
        this.if_proceed = condition;
        return this;
    }
    /**
     * AND(key1 = :value OR key2 = :value)
     * @param keys [key1, key2, ...]
     */
    @IF_PROCEED<T>()
    eqs(keys: (keyof T)[], value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this.__(keys, value, '=', { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /*** AND key = :value */
    @IF_PROCEED<T>()
    eq(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._(key, value, '=', { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /*** AND key1 = :value1 AND  key2 = :value2 */
    @IF_PROCEED<T>()
    eqT(t: Partial<T>, { name: paramName = '', breakExcuteIfEmpty = true } = {}) {
        let exe = false;
        if (t) {
            t = this._service[_transformer]!(t, {
                skipNull: true,
                skipUndefined: true,
                skipEmptyString: true
            });
            const keys = Object.keys(t);
            if (keys.length > 0) {
                if (paramName && this._paramKeys[paramName]) {
                    for (const [key, pname] of Object.entries(this._paramKeys[paramName] as Record<string, string>)) {
                        this._param[pname as string] = t[key];
                    }
                } else {
                    const paramKeys: Record<string, string> = {};
                    for (const [key, value] of Object.entries(t)) {
                        const pkey = `p${this._prefix}${this._index++}`;
                        this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} = :${pkey} `);
                        this._param[pkey] = value;
                        if (paramName) {
                            paramKeys[key] = pkey;
                        }
                    }
                    if (paramName) {
                        this._paramKeys[paramName] = paramKeys;
                    }
                }
                exe = true;
            }
        }
        if (breakExcuteIfEmpty && exe === false) {
            this.if_exec = false;
        }
        return this;
    }
    /*** AND key <> :value */
    @IF_PROCEED<T>()
    notEq(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._(key, value, '<>', { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND key1 = key2 */
    @IF_PROCEED<T>()
    eqWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '='); }
    /** AND key1 <> key2 */
    @IF_PROCEED<T>()
    notEqWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '<>'); }
    /** AND key > :value */
    @IF_PROCEED<T>()
    grate(key: keyof T, value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, value, '>', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key >= :value */
    @IF_PROCEED<T>()
    grateEq(key: keyof T, value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, value, '>=', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key1 > key2 */
    @IF_PROCEED<T>()
    grateWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '>'); }
    /** AND key1 >= key2 */
    @IF_PROCEED<T>()
    grateEqWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '>='); }
    /** AND key < :value */
    @IF_PROCEED<T>()
    less(key: keyof T, value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, value, '<', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key <= :value */
    @IF_PROCEED<T>()
    lessEq(key: keyof T, value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, value, '<=', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key1 < key2 */
    @IF_PROCEED<T>()
    lessWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '<'); }
    /** AND key1 <= key2 */
    @IF_PROCEED<T>()
    lessEqWith(key1: keyof T, key2: keyof T) { return this._key(key1, key2, '<='); }
    /** AND key REGEXP :regexp */
    @IF_PROCEED<T>()
    regexp(key: keyof T, regexp: string, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, regexp, 'REGEXP', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND key NOT REGEXP :regexp */
    @IF_PROCEED<T>()
    notRegexp(key: keyof T, regexp: string, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._(key, regexp, 'REGEXP', { paramName, skipEmptyString: true, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :regexp REGEXP key */
    @IF_PROCEED<T>()
    regexp2(key: keyof T, regexp: string, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._2(key, regexp, 'REGEXP', { paramName, skipEmptyString: true, breakExcuteIfEmpty }); }
    /** AND :regexp NOT REGEXP key */
    @IF_PROCEED<T>()
    notRegexp2(key: keyof T, regexp: string, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._2(key, regexp, 'REGEXP', { paramName, skipEmptyString: true, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND (key1 << 8) + key2 = value */
    @IF_PROCEED<T>()
    shiftEq(key1: keyof T, key2: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._shift(key1, key2, value, '=', { paramName, breakExcuteIfEmpty }); }
    /** AND (key1 << 8) + key2 <> value */
    @IF_PROCEED<T>()
    shiftNotEq(key1: keyof T, key2: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._shift(key1, key2, value, '<>', { paramName, breakExcuteIfEmpty }); }
    /** AND key LIKE CONCAT('%', :value, '%') */
    @IF_PROCEED<T>()
    like(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', right: '%', breakExcuteIfEmpty }); }
    /** AND key NOT LIKE CONCAT('%', :value, '%') */
    @IF_PROCEED<T>()
    notLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', right: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key NOT LIKE CONCAT('%', :value) */
    @IF_PROCEED<T>()
    leftLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', breakExcuteIfEmpty }); }
    /** AND key LIKE CONCAT('%', :value) */
    @IF_PROCEED<T>()
    notLeftLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key LIKE CONCAT(:value, '%') */
    @IF_PROCEED<T>()
    rightLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, right: '%', breakExcuteIfEmpty }); }
    /** AND key NOT LIKE CONCAT(:value, '%') */
    @IF_PROCEED<T>()
    notRightLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, right: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key LIKE :value 注意：不会拼接% */
    @IF_PROCEED<T>()
    PreciseLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND key NOT LIKE :value 注意：不会拼接%*/
    @IF_PROCEED<T>()
    notPreciseLike(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key GLOB CONCAT('%', :value, '%') 注意：GLOB是大小写敏感like */
    @IF_PROCEED<T>()
    glob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', right: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key NOT GLOB CONCAT('%', :value, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', right: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key GLOB CONCAT('%', :value) 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    leftGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key NOT GLOB CONCAT('%', :value) 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notLeftGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, left: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key GLOB CONCAT(:value, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    rightGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, right: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key NOT GLOB CONCAT(:value, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notRightGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, right: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key GLOB :value 注意：GLOB是大小写敏感like,这里不拼接%*/
    @IF_PROCEED<T>()
    preciseGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key NOT GLOB :value 注意：GLOB是大小写敏感like,这里不拼接%*/
    @IF_PROCEED<T>()
    notPreciseGlob(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value LIKE CONCAT('%', key, '%') */
    @IF_PROCEED<T>()
    like2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', right: '%', breakExcuteIfEmpty }); }
    /** AND :value NOT LIKE CONCAT('%', key, '%') */
    @IF_PROCEED<T>()
    notLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', right: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value NOT LIKE CONCAT('%', key) */
    @IF_PROCEED<T>()
    leftLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', breakExcuteIfEmpty }); }
    /** AND :value LIKE CONCAT('%', key) */
    @IF_PROCEED<T>()
    notLeftLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value LIKE CONCAT(key, '%') */
    @IF_PROCEED<T>()
    rightLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, right: '%', breakExcuteIfEmpty }); }
    /** AND :value NOT LIKE CONCAT(key, '%') */
    @IF_PROCEED<T>()
    notRightLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, right: '%', not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value LIKE key 注意：不会拼接% */
    @IF_PROCEED<T>()
    PreciseLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND :value NOT LIKE key 注意：不会拼接%*/
    @IF_PROCEED<T>()
    notPreciseLike2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value GLOB CONCAT('%', key, '%') 注意：GLOB是大小写敏感like */
    @IF_PROCEED<T>()
    glob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', right: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value NOT GLOB CONCAT('%', key, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', right: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value GLOB CONCAT('%', key) 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    leftGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value NOT GLOB CONCAT('%', key) 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notLeftGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, left: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value GLOB CONCAT(key, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    rightGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, right: '%', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value NOT GLOB CONCAT(key, '%') 注意：GLOB是大小写敏感like*/
    @IF_PROCEED<T>()
    notRightGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, right: '%', not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value GLOB key 注意：GLOB是大小写敏感like,这里不拼接%*/
    @IF_PROCEED<T>()
    preciseGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND :value NOT GLOB key 注意：GLOB是大小写敏感like,这里不拼接%*/
    @IF_PROCEED<T>()
    notPreciseGlob2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._like2(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty, op: 'GLOB' }); }
    /** AND key IN (:value) */
    @IF_PROCEED<T>()
    in(key: keyof T, value: Array<string | number>, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._in(key, value, { paramName, breakExcuteIfEmpty }); }
    /** AND key NOT IN (:value) */
    @IF_PROCEED<T>()
    notIn(key: keyof T, value: Array<string | number>, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._in(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND :value IN (key1, key2, ...) */
    @IF_PROCEED<T>()
    in2(key: (keyof T)[], value: string | number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._in2(key, value, { paramName, breakExcuteIfEmpty }); }
    /** AND :value NOT IN (key1, key2, ...) */
    @IF_PROCEED<T>()
    notIn2(key: (keyof T)[], value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._in2(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND key IS NULL */
    @IF_PROCEED<T>()
    isNULL(key: keyof T) { return this._null(key); }
    /** AND key IS NOT NULL */
    @IF_PROCEED<T>()
    isNotNULL(key: keyof T) { return this._null(key, 'NOT'); }
    /** AND (key IS NULL OR key = '') */
    @IF_PROCEED<T>()
    isEmpty(key: keyof T) {
        this._wheres.push(`AND (t.${this[_fields]![String(key)]?.C2()} IS NULL OR t.${this[_fields]![String(key)]?.C2()} = '')`);
        return this;
    }
    /** AND key IS NOT NULL AND key <> ''*/
    @IF_PROCEED<T>()
    isNotEmpty(key: keyof T) {
        this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} IS NOT NULL AND t.${this[_fields]![String(key)]?.C2()} <> ''`);
        return this;
    }
    /** AND key BETWEEN :value1 AND :value2 */
    @IF_PROCEED<T>()
    between(key: keyof T, value1: string | number, value2: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._between(key, value1, value2, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND key NOT BETWEEN :value1 AND :value2 */
    @IF_PROCEED<T>()
    notBetween(key: keyof T, value1: string | number, value2: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._between(key, value1, value2, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND POW(2, key) & :value */
    @IF_PROCEED<T>()
    pow(key: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow(key, value, { paramName, breakExcuteIfEmpty }); }
    /** AND NOT POW(2, key) & :value */
    @IF_PROCEED<T>()
    notPow(key: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow(key, value, { paramName, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND POW(2, :value) & key */
    @IF_PROCEED<T>()
    pow2(key: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow2(key, value, { paramName, breakExcuteIfEmpty }); }
    /** AND NOT POW(2, :value) & key */
    @IF_PROCEED<T>()
    notPow2(key: keyof T, value: number, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow2(key, value, { paramName, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND POW(2, key1) & key2 */
    @IF_PROCEED<T>()
    powWith(key: keyof T, values: Array<number | string>, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow(key, add(...values.map(value => Math.pow(2, +value))), { paramName, breakExcuteIfEmpty }); }
    /** AND NOT POW(2, key1) & key2 */
    @IF_PROCEED<T>()
    notPowWith(key: keyof T, values: Array<number | string>, { paramName = '', breakExcuteIfEmpty = true } = {}) { return this._pow(key, add(...values.map(value => Math.pow(2, +value))), { paramName, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) */
    @IF_PROCEED<T>()
    match(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) */
    @IF_PROCEED<T>()
    notMatch(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) IN BOOLEAN MODE*/
    @IF_PROCEED<T>()
    matchBoolean(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty, append: 'IN BOOLEAN MODE' }); }
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) IN BOOLEAN MODE */
    @IF_PROCEED<T>()
    notMatchBoolean(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty, not: 'NOT', append: 'IN BOOLEAN MODE' }); }
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) WITH QUERY EXPANSION*/
    @IF_PROCEED<T>()
    matchQuery(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty, append: 'WITH QUERY EXPANSION' }); }
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) WITH QUERY EXPANSION*/
    @IF_PROCEED<T>()
    notMatchQuery(value: string, keys: (keyof T)[], { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._match(value, keys, { paramName, skipEmptyString, breakExcuteIfEmpty, not: 'NOT', append: 'WITH QUERY EXPANSION' }); }
    /** AND LOCATE(key, :value) > 0 */
    @IF_PROCEED<T>()
    includes(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._includes(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND NOT LOCATE(key, :value) = 0 */
    @IF_PROCEED<T>()
    notIncludes(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._includes(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND LOCATE(:value, key) > 0 */
    @IF_PROCEED<T>()
    includes2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._includes2(key, value, { paramName, skipEmptyString, breakExcuteIfEmpty }); }
    /** AND NOT LOCATE(:value, key) = 0 */
    @IF_PROCEED<T>()
    notIncludes2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) { return this._includes2(key, value, { paramName, skipEmptyString, not: 'NOT', breakExcuteIfEmpty }); }
    /** AND FIND_IN_SET(:value, key) */
    @IF_PROCEED<T>()
    findInSet(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND FIND_IN_SET(:${pkey}, t.${this[_fields]![String(key)]?.C2()})`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    /** AND FIND_IN_SET(key, :value) */
    @IF_PROCEED<T>()
    findInSet2(key: keyof T, value: string | number, { paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND FIND_IN_SET(t.${this[_fields]![String(key)]?.C2()}, :${pkey})`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    @IF_PROCEED<T>()
    and(fn: StreamQuery<T> | ((stream: StreamQuery<T>) => boolean | void)) {
        if (fn instanceof StreamQuery) {
            this._andQuerys.push(fn);
        } else {
            const stream = new StreamQuery<T>(this._service, this[_fields], this[_columns]);
            const ret = fn(stream);
            if (ret !== false) { this._andQuerys.push(stream); }
        }
        return this;
    }
    @IF_PROCEED<T>()
    or(fn: StreamQuery<T> | ((stream: StreamQuery<T>) => boolean | void)) {
        if (fn instanceof StreamQuery) {
            this._andQuerys.push(fn);
        } else {
            const stream = new StreamQuery<T>(this._service, this[_fields], this[_columns]!);
            const ret = fn(stream);
            if (ret !== false) { this._orQuerys.push(stream); }
        }
        return this;
    }
    /**
     * sql WHERE 查询语句拼接：注意若有JOIN，需要写明别名。本表别名为t.例如:
     * ```
     * where('t.name > :name', {name: 1});
     * where('(t.name > :name OR t.name <> :name)', {name: 1});
     * ```
     */
    @IF_PROCEED<T>()
    where(sql: string, param?: Record<string, any>) {
        this._wheres.push(`AND ${sql}`);
        if (param) {
            Object.assign(this._param, param);
        }
        return this;
    }
    /** SET key = IFNULL(key, 0) + :value */
    @IF_PROCEED<T>()
    incr(key: keyof T, value = 1) {
        const pkey = `p${this._prefix}${this._index++}`;
        const keyName = this[_fields]![String(key)]?.C2()!;
        this._updateColumns.push(`t.${keyName} = IFNULL(t.${keyName}, 0) + :${pkey}`);
        this._param[pkey] = value;
        return this;
    }
    /** GROUP BY key1, key2, ... */
    @IF_PROCEED<T>()
    groupBy(...keys: (keyof T)[]) { this._groups.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()}`)); return this; }
    /** GROUP BY key1, key2, ... */
    @IF_PROCEED<T>()
    groupBy2(...keys: string[]) { this._groups.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()}`)); return this; }
    /** ORDER BY key1 ASC, key2 ASC, ... */
    @IF_PROCEED<T>()
    asc(...keys: (keyof T)[]) { this._orders.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()} ASC`)); return this; }
    /** ORDER BY key1 ASC, key2 ASC, ... */
    @IF_PROCEED<T>()
    asc2(...keys: string[]) { this._orders.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()} ASC`)); return this; }
    /** ORDER BY key1 DESC, key2 DESC, ... */
    @IF_PROCEED<T>()
    desc(...keys: (keyof T)[]) { this._orders.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()} DESC`)); return this; }
    /** ORDER BY key1 DESC, key2 DESC, ... */
    @IF_PROCEED<T>()
    desc2(...keys: string[]) { this._orders.push(...keys.map(key => `t.${this[_fields]![String(key)]?.C2()} ASC`)); return this; }
    /** LIMIT :startRow, :pageSize */
    @IF_PROCEED<T>()
    limit(startRow: number, pageSize: number) { this._startRow = startRow; this._pageSize = pageSize; return this; }
    /** LIMIT ((:pageNumber || 1) - 1) * :pageSize, :pageSize */
    @IF_PROCEED<T>()
    page(pageNumber: number, pageSize: number) { this._startRow = ((pageNumber || 1) - 1) * pageSize; this._pageSize = pageSize; return this; }
    @IF_PROCEED<T>()
    distinct(on = true) { this._distinct = on; return this; }
    /** COUNT(DISTINCT key) */
    @IF_PROCEED<T>()
    countDistinct(key: keyof T, countName?: string,) { this._columns.push(`COUNT(DISTINCT t.${this[_fields]![String(key)]?.C2()}) ${countName || this[_fields]![String(key)]?.C2()}`); return this; }
    @IF_PROCEED<T>()
    count(countName?: string) { this._columns.push(`COUNT(1) ${countName ?? 'ct'}`); return this; }
    @IF_PROCEED<T>()
    sum(key: keyof T, legName?: string, distinct?: boolean) { this._columns.push(`SUM(${distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}) ${legName || this[_fields]![String(key)]?.C2()}`); return this; }
    @IF_PROCEED<T>()
    avg(key: keyof T, legName?: string, distinct?: boolean) { this._columns.push(`AVG(${distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}) ${legName || this[_fields]![String(key)]?.C2()}`); return this; }
    @IF_PROCEED<T>()
    max(key: keyof T, legName?: string, distinct?: boolean) { this._columns.push(`MAX(${distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}) ${legName || this[_fields]![String(key)]?.C2()}`); return this; }
    @IF_PROCEED<T>()
    min(key: keyof T, legName?: string, distinct?: boolean) { this._columns.push(`MIN(${distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}) ${legName || this[_fields]![String(key)]?.C2()}`); return this; }
    /** GROUP_CONCAT([DISTINCT] key [ORDER BY :asc ASC] [ORDER BY :asc DESC] [SEPARATOR :separator]) */
    @IF_PROCEED<T>()
    groupConcat(key: keyof T, param?: { distinct?: boolean, separator?: string, asc?: (keyof T)[], desc?: (keyof T)[], groupName?: string }): this {
        this._columns.push(`GROUP_CONCAT(
            ${param && param.distinct ? 'DISTINCT' : ''} t.${this[_fields]![String(key)]?.C2()}
            ${param && param.asc && param.asc.length > 0 ? `ORDER BY ${param.asc.map(i => `t.${this[_fields]![String(i)]?.C2()} ASC`)} ` : ''}
            ${param && param.desc && param.desc.length > 0 ? `${param && param.asc && param.asc.length > 0 ? '' : 'ORDER BY'} ${param.desc.map(i => `t.${this[_fields]![String(i)]?.C2()} DESC`)} ` : ''}
            SEPARATOR '${param && param.separator || ','}'
            ) ${param && param.groupName || this[_fields]![String(key)]?.C2()}`);
        return this;
    }
    @IF_PROCEED<T>()
    select(...key: (keyof T)[]) { this._columns.push(...(key.map(k => `t.${this[_fields]![String(k)]!.C3()}`))); return this; }
    /**
     * sql查询语句拼接：注意若有JOIN，需要写明别名。本表别名为t.例如:
     * ```
     * select2('t.name, t.age, ISNULL(t.type, :type)', {type: 1});
     * select2('MAX(t.age) MAXAge');
     * ```
     */
    @IF_PROCEED<T>()
    select2(sql: string, param?: Record<string, any>) { this._columns.push(`${sql}`); Object.assign(this._param, param); return this; }
    @IF_PROCEED<T>()
    update(key: keyof T, value: T[keyof T]) { this._updates ??= {}; this._updates[this[_fields]![String(key)]?.C2()!] = value; return this; }
    /** update语句拼接：注意若有JOIN，需要写明别名。本表别名为t */
    @IF_PROCEED<T>()
    update2(sql: string, param?: Record<string, any>) { this._updateColumns.push(sql); Object.assign(this._param, param); return this; }
    @IF_PROCEED<T>()
    updateT(t: Partial<T>) {
        this._updates ??= {};
        for (const [key, value] of Object.entries(t)) {
            this._updates[this[_fields]![String(key)]?.C2()!] = value;
        }
        return this;
    }
    /** SET key = REPLACE(key, :valueToFind,  :valueToReplace) */
    @IF_PROCEED<T>()
    replace(key: keyof T, valueToFind: T[keyof T], valueToReplace: T[keyof T]) {
        const [pkey1, pkey2] = [`p${this._prefix}${this._index++}`, `p${this._prefix}${this._index++}`];
        this._updateColumns.push(` t.${this[_fields]![String(key)]?.C2()} = REPLACE(t.${this[_fields]![String(key)]?.C2()}, :${pkey1}, :${pkey2}) `);
        this._param[pkey1] = valueToFind as any;
        this._param[pkey2] = valueToReplace as any;
        return this;
    }
    // #endregion

    excuteSelect<L = T>(option?: MethodOption & { sync?: SyncMode.Async; selectResult?: SelectResult.RS_CS | SelectResult.RS_C; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L[]>;
    excuteSelect<L = T>(option: MethodOption & { sync?: SyncMode.Async; selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L>;
    excuteSelect<L = T>(option: MethodOption & { sync?: SyncMode.Async; selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): Promise<L | null>;
    excuteSelect<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.RS_CS | SelectResult.RS_C; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L[];
    excuteSelect<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L;
    excuteSelect<L = T>(option: MethodOption & { sync: SyncMode.Sync; selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): L | null;
    @IF_EXEC<T>(null)
    excuteSelect<L = T>(option?: MethodOption & { sync?: SyncMode; selectResult?: SelectResult; errorMsg?: string; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; }): null | L | L[] | Promise<null | L | L[]> {
        option ??= {};
        option.sync ??= SyncMode.Async;
        option.selectResult ??= SelectResult.RS_CS;
        const { where, params } = this._where();
        let sql = `
            SELECT
            ${this._distinct ? 'DISTINCT' : ''} ${this._columns && this._columns.length > 0 ? this._columns.join(',') : this[_columns].map(key => `t.${this[_fields]![String(key)]?.C3()}`).join(',')}
            FROM ${option.tableName ?? this._service[_tableName]} t
            ${where ? ' WHERE ' : ''}
            ${where}
            ${this._groups.length > 0 ? `GROUP BY ${this._groups.join(',')} ` : ''}
            ${this._orders.length > 0 ? `ORDER BY ${this._orders.join(',')} ` : ''}
        `;
        if (this._startRow >= 0 && this._pageSize >= 0) {
            sql += `LIMIT ${this._startRow}, ${this._pageSize}`;
        } else if (this._startRow >= 0) {
            sql += `LIMIT ${this._startRow}`;
        }
        if (option.sync === SyncMode.Async) {
            switch (option.selectResult) {
                case SelectResult.RS_CS: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.RS_CS, sql, params });
                case SelectResult.RS_C: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.RS_C, sql, params });
                case SelectResult.R_CS_Assert: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.R_CS_Assert, sql, params });
                case SelectResult.R_C_Assert: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.R_C_Assert, sql, params });
                case SelectResult.R_CS_NotSure: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.R_CS_NotSure, sql, params });
                case SelectResult.R_C_NotSure: return this._service.select<L>({ ...option, sync: SyncMode.Async, selectResult: SelectResult.R_C_NotSure, sql, params });
            }
        } else {
            switch (option.selectResult) {
                case SelectResult.RS_CS: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.RS_CS, sql, params });
                case SelectResult.RS_C: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.RS_C, sql, params });
                case SelectResult.R_CS_Assert: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.R_CS_Assert, sql, params });
                case SelectResult.R_C_Assert: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.R_C_Assert, sql, params });
                case SelectResult.R_CS_NotSure: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.R_CS_NotSure, sql, params });
                case SelectResult.R_C_NotSure: return this._service.select<L>({ ...option, sync: SyncMode.Sync, selectResult: SelectResult.R_C_NotSure, sql, params });
            }
        }
    }
    @IF_EXEC<T>(null)
    excutePage<L = T>(option?: MethodOption & { sync?: SyncMode; hump?: boolean; mapper?: string | SqlMapper; mapperIfUndefined?: MapperIfUndefined; dataConvert?: Record<string, string>; }): PageQuery<L> | Promise<PageQuery<L>> {
        option ??= {};
        option.sync ??= SyncMode.Async;
        const { where, params } = this._where();
        const result: PageQuery<L> = {
            records: [],
            size: 0,
            total: 0
        };
        let sql = `
            SELECT
            ${this._distinct ? 'DISTINCT' : ''} ${this._columns && this._columns.length > 0 ? this._columns.join(',') : this[_columns].map(key => `t.${this[_fields]![String(key)]?.C3()}`).join(',')}
            FROM ${option.tableName ?? this._service[_tableName]} t
            ${where ? ' WHERE ' : ''}
            ${where}
            ${this._groups.length > 0 ? `GROUP BY ${this._groups.join(',')} ` : ''}
            ${this._orders.length > 0 ? `ORDER BY ${this._orders.join(',')} ` : ''}
        `;
        if (this._startRow >= 0 && this._pageSize >= 0) {
            sql += `LIMIT ${this._startRow}, ${this._pageSize}`;
        } else if (this._startRow >= 0) {
            sql += `LIMIT ${this._startRow}`;
        }
        const sqlCount = `
            SELECT COUNT(1)
            FROM ${option.tableName ?? this._service[_tableName]} t
            ${where ? ' WHERE ' : ''}
            ${where}
            ${this._groups.length > 0 ? `GROUP BY ${this._groups.join(',')} ` : ''}
            ${this._orders.length > 0 ? `ORDER BY ${this._orders.join(',')} ` : ''}
        `;
        if (option.sync === SyncMode.Sync) {
            result.total = this._service.select<number>({
                ...option,
                params,
                sql: sqlCount,
                sync: SyncMode.Sync,
                selectResult: SelectResult.R_C_Assert
            });
            result.size = calc(result.total)
                .add(this._pageSize - 1)
                .div(this._pageSize)
                .round(0, 2)
                .over();
            result.records = this._service.select<L>({
                ...option,
                params,
                sql,
                sync: SyncMode.Sync,
                selectResult: SelectResult.RS_CS
            });
            return result;
        } else {
            return (async (): Promise<PageQuery<L>> => {
                result.total = await this._service.select<number>({
                    ...option,
                    params,
                    sql: sqlCount,
                    sync: SyncMode.Async,
                    selectResult: SelectResult.R_C_Assert
                });
                result.size = calc(result.total)
                    .add(this._pageSize - 1)
                    .div(this._pageSize)
                    .round(0, 2)
                    .over();
                result.records = await this._service.select<L>({
                    ...option,
                    params,
                    sql,
                    sync: SyncMode.Async,
                    selectResult: SelectResult.RS_CS
                });
                return result;
            })();
        }
    }
    excuteUpdate(option?: MethodOption & { sync?: SyncMode.Async; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; }): Promise<number>;
    excuteUpdate(option: MethodOption & { sync: SyncMode.Sync; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; }): number;
    @IF_EXEC<T>(0)
    excuteUpdate(option?: MethodOption & { sync?: SyncMode; skipUndefined?: boolean; skipNull?: boolean; skipEmptyString?: boolean; }): number | Promise<number> {
        option ??= {};
        option.sync ??= SyncMode.Async;
        const { where, params } = this._where();
        const sets = new Array<string>(...this._updateColumns);
        if (this._updates) {
            for (const [K, V] of Object.entries(this._updates)) {
                const pkey = `p${this._prefix}${this._index++}`;
                sets.push(` t.${K} = :${pkey} `);
                params[pkey] = V;
            }
        }
        if (sets.length > 0) {
            const sql = `UPDATE ${option.tableName ?? this._service[_tableName]} SET ${sets.join(',')}
            ${where ? ' WHERE ' : ''}
            ${where}
            `.replace(/t\./g, '');
            if (option.sync === SyncMode.Async) {
                return this._service.excute({ ...option, sync: SyncMode.Async, sql, params });
            } else {
                return this._service.excute({ ...option, sync: SyncMode.Sync, sql, params });
            }
        } else {
            return 0;
        }
    }
    excuteDelete(option?: MethodOption & { sync?: SyncMode.Async; forceDelete?: boolean; }): Promise<number>;
    excuteDelete(option: MethodOption & { sync: SyncMode.Sync; forceDelete?: boolean; }): number;
    @IF_EXEC<T>(0)
    excuteDelete(option?: MethodOption & { sync?: SyncMode; forceDelete?: boolean; }): number | Promise<number> {
        option ??= {};
        option.sync ??= SyncMode.Async;
        const { where, params } = this._where();
        const sql = `DELETE FROM ${option.tableName ?? this._service[_tableName]}
            ${where ? ' WHERE ' : ''}
            ${where}
        `.replace(/t\./g, '');
        // if (option.sync === SyncMode.Async) {
        //     return this._service.delete({ ...option, sync: SyncMode.Async, whereSql: where, whereParams: params });
        // } else {
        //     return this._service.delete({ ...option, sync: SyncMode.Sync, whereSql: where, whereParams: params });
        // }
        if (option.sync === SyncMode.Async) {
            return this._service.excute({ ...option, sync: SyncMode.Async, sql, params });
        } else {
            return this._service.excute({ ...option, sync: SyncMode.Sync, sql, params });
        }
    }
    private _where() {
        const wheres = new Array<string>();
        const sql = this._wheres.join(' ');
        if (sql) {
            wheres.push(`(${sql.replace(/^and|^or/i, '')})`);
        }
        if (this._orQuerys.length > 0) {
            for (const query of this._orQuerys) {
                const { where, params } = query._where();
                if (where) {
                    wheres.push(` OR (${where}) `);
                }
                Object.assign(this._param, params);
            }
        }
        if (this._andQuerys.length > 0) {
            for (const query of this._andQuerys) {
                const { where, params } = query._where();
                if (where) {
                    wheres.push(` AND (${where}) `);
                }
                Object.assign(this._param, params);
            }
        }
        return { where: wheres.join(' '), params: this._param };
    }
    private _(key: keyof T, value: any, op: string, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} ${not} ${op} :${pkey} `);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _2(key: keyof T, value: any, op: string, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND :${pkey} ${not} ${op} t.${this[_fields]![String(key)]?.C2()}`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private __(keys: (keyof T)[], value: any, op: string, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND (${keys.map(key => `t.${this[_fields]![String(key)]?.C2()} ${not} ${op} :${pkey} `).join(' OR ')})`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _null(key: keyof T, not = ''): this {
        this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} IS ${not} NULL`);
        return this;
    }
    private _key(key1: keyof T, key2: keyof T, op: string, not = '') {
        this._wheres.push(`AND t.${this[_fields]![String(key1)]?.C2()} ${not} ${op} t.${this[_fields]![String(key2)]?.C2()} `);
        return this;
    }
    private _between(key: keyof T, value1: string | number, value2: string | number, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value1 === null
            || value1 === undefined
            || (emptyString(`${value1 ?? ''}`) && skipEmptyString)
            || value2 === null
            || value2 === undefined
            || (emptyString(`${value2 ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName && this._paramKeys[paramName]) {
            this._param[this._paramKeys[paramName]![0]] = value1;
            this._param[this._paramKeys[paramName]![1]] = value2;
        } else {
            const [pkey1, pkey2] = [`p${this._prefix}${this._index++}`, `p${this._prefix}${this._index++}`];
            this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} ${not} BETWEEN :${pkey1} AND :${pkey2}`);
            this._param[pkey1] = value1;
            this._param[pkey2] = value2;
            if (paramName) {
                this._paramKeys[paramName] = [pkey1, pkey2];
            }
        }
        return this;
    }
    private _in(key: keyof T, value: Array<string | number>, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (value && value.length > 0 && skipEmptyString) {
            value = value.filter(v => !emptyString(`${v ?? ''}`));
        }
        if (value && value.length > 0) {
            if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
                this._param[this._paramKeys[paramName] as string] = value;
            } else {
                const pkey = `p${this._prefix}${this._index++}`;
                this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} ${not} IN (:${pkey}) `);
                this._param[pkey] = value;
                if (paramName) {
                    this._paramKeys[paramName] = pkey;
                }
            }
        } else if (breakExcuteIfEmpty) {
            this.if_exec = false;
        }
        return this;
    }
    private _in2(key: (keyof T)[], value: any, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        const skip = emptyString(`${value ?? ''}`) && skipEmptyString;
        if (!skip) {
            if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
                this._param[this._paramKeys[paramName] as string] = value;
            } else {
                const pkey = `p${this._prefix}${this._index++}`;
                this._wheres.push(`AND :${pkey} ${not} IN (${key.map(k => `t.${this[_fields]![String(k)]?.C2()}`).join(',')}) `);
                this._param[pkey] = value;
                if (paramName) {
                    this._paramKeys[paramName] = pkey;
                }
            }
        } else if (breakExcuteIfEmpty) {
            this.if_exec = false;
        }
        return this;
    }
    private _shift(key1: keyof T, key2: keyof T, value: number, op: string, { not = '', paramName = '', breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || emptyString(`${value ?? ''}`)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND (t.${this[_fields]![String(key1)]?.C2()} << 8) + t.${this[_fields]![String(key2)]?.C2()} ${not} ${op} :${pkey} `);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _match(value: string, keys: (keyof T)[], { paramName = '', not = '', append = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || emptyString(`${value ?? ''}`)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND ${not} MATCH(${keys.map(key => `t.${this[_fields]![String(key)]?.C2()}`).join(',')}) AGAINST (:${pkey} ${append ?? ''})`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _pow(key: keyof T, value: number, { not = '', paramName = '', breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || emptyString(`${value ?? ''}`)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND ${not} POW(2, t.${this[_fields]![String(key)]?.C2()}) & :${pkey}`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _pow2(key: keyof T, value: number, { not = '', paramName = '', breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || emptyString(`${value ?? ''}`)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND ${not} POW(2, :${pkey}) & t.${this[_fields]![String(key)]?.C2()}`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _like(key: keyof T, value: any, { not = '', left = '', right = '', paramName = '', op = 'LIKE', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }

        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND t.${this[_fields]![String(key)]?.C2()} ${not} ${op} CONCAT('${left}', :${pkey}, '${right}') `);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _like2(key: keyof T, value: any, { not = '', left = '', right = '', paramName = '', op = 'LIKE', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }

        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND :${pkey} ${not} ${op} CONCAT('${left}',t.${this[_fields]![String(key)]?.C2()}, '${right}') `);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _includes(key: keyof T, value: any, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND LOCATE(t.${this[_fields]![String(key)]?.C2()}, :${pkey}) ${not ? '=' : '>'}  0`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
    private _includes2(key: keyof T, value: any, { not = '', paramName = '', skipEmptyString = true, breakExcuteIfEmpty = true } = {}) {
        if (
            value === null
            || value === undefined
            || (emptyString(`${value ?? ''}`) && skipEmptyString)
        ) {
            if (breakExcuteIfEmpty) {
                this.if_exec = false;
            }
            return this;
        }
        if (paramName !== undefined && this._paramKeys.hasOwnProperty(paramName)) {
            this._param[this._paramKeys[paramName] as string] = value;
        } else {
            const pkey = `p${this._prefix}${this._index++}`;
            this._wheres.push(`AND LOCATE(:${pkey}, t.${this[_fields]![String(key)]?.C2()}) ${not ? '=' : '>'}  0`);
            this._param[pkey] = value;
            if (paramName) {
                this._paramKeys[paramName] = pkey;
            }
        }
        return this;
    }
}
