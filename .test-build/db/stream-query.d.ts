import { _fields, _columns, AField } from 'baja-lite-field';
import { MapperIfUndefined, MethodOption, PageQuery, SelectResult, SqlMapper, SyncMode } from '../const/types.js';
import type { SqlService } from './service.js';
export declare class StreamQuery<T extends object> {
    private _prefix;
    private _index;
    private _wheres;
    private _andQuerys;
    private _orQuerys;
    private _paramKeys;
    private _param;
    if_proceed: boolean;
    if_exec: boolean;
    private _distinct;
    private _columns;
    private _updates?;
    private _updateColumns;
    private _groups;
    private _orders;
    private _startRow;
    private _pageSize;
    private _service;
    private [_fields];
    private [_columns];
    constructor(service: SqlService<T>, __fields: Record<string, AField>, __columns: string[]);
    /** 将当前stream重置 */
    reset(): this;
    /** 为下次链条执行提供条件判断：非异步方法跳过，异步方法不执行并返回默认值 */
    if(condition: boolean): this;
    /**
     * AND(key1 = :value OR key2 = :value)
     * @param keys [key1, key2, ...]
     */
    eqs(keys: (keyof T)[], value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /*** AND key = :value */
    eq(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /*** AND key1 = :value1 AND  key2 = :value2 */
    eqT(t: Partial<T>, { name: paramName, breakExcuteIfEmpty }?: {
        name?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /*** AND key <> :value */
    notEq(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key1 = key2 */
    eqWith(key1: keyof T, key2: keyof T): this;
    /** AND key1 <> key2 */
    notEqWith(key1: keyof T, key2: keyof T): this;
    /** AND key > :value */
    grate(key: keyof T, value: string | number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key >= :value */
    grateEq(key: keyof T, value: string | number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key1 > key2 */
    grateWith(key1: keyof T, key2: keyof T): this;
    /** AND key1 >= key2 */
    grateEqWith(key1: keyof T, key2: keyof T): this;
    /** AND key < :value */
    less(key: keyof T, value: string | number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key <= :value */
    lessEq(key: keyof T, value: string | number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key1 < key2 */
    lessWith(key1: keyof T, key2: keyof T): this;
    /** AND key1 <= key2 */
    lessEqWith(key1: keyof T, key2: keyof T): this;
    /** AND key REGEXP :regexp */
    regexp(key: keyof T, regexp: string, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT REGEXP :regexp */
    notRegexp(key: keyof T, regexp: string, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :regexp REGEXP key */
    regexp2(key: keyof T, regexp: string, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :regexp NOT REGEXP key */
    notRegexp2(key: keyof T, regexp: string, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND (key1 << 8) + key2 = value */
    shiftEq(key1: keyof T, key2: keyof T, value: number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND (key1 << 8) + key2 <> value */
    shiftNotEq(key1: keyof T, key2: keyof T, value: number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key LIKE CONCAT('%', :value, '%') */
    like(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT LIKE CONCAT('%', :value, '%') */
    notLike(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT LIKE CONCAT('%', :value) */
    leftLike(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key LIKE CONCAT('%', :value) */
    notLeftLike(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key LIKE CONCAT(:value, '%') */
    rightLike(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT LIKE CONCAT(:value, '%') */
    notRightLike(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key LIKE :value 注意：不会拼接% */
    PreciseLike(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT LIKE :value 注意：不会拼接%*/
    notPreciseLike(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key GLOB CONCAT('%', :value, '%') 注意：GLOB是大小写敏感like */
    glob(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT GLOB CONCAT('%', :value, '%') 注意：GLOB是大小写敏感like*/
    notGlob(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key GLOB CONCAT('%', :value) 注意：GLOB是大小写敏感like*/
    leftGlob(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT GLOB CONCAT('%', :value) 注意：GLOB是大小写敏感like*/
    notLeftGlob(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key GLOB CONCAT(:value, '%') 注意：GLOB是大小写敏感like*/
    rightGlob(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT GLOB CONCAT(:value, '%') 注意：GLOB是大小写敏感like*/
    notRightGlob(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key GLOB :value 注意：GLOB是大小写敏感like,这里不拼接%*/
    preciseGlob(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT GLOB :value 注意：GLOB是大小写敏感like,这里不拼接%*/
    notPreciseGlob(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value LIKE CONCAT('%', key, '%') */
    like2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT LIKE CONCAT('%', key, '%') */
    notLike2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT LIKE CONCAT('%', key) */
    leftLike2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value LIKE CONCAT('%', key) */
    notLeftLike2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value LIKE CONCAT(key, '%') */
    rightLike2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT LIKE CONCAT(key, '%') */
    notRightLike2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value LIKE key 注意：不会拼接% */
    PreciseLike2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT LIKE key 注意：不会拼接%*/
    notPreciseLike2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value GLOB CONCAT('%', key, '%') 注意：GLOB是大小写敏感like */
    glob2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT GLOB CONCAT('%', key, '%') 注意：GLOB是大小写敏感like*/
    notGlob2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value GLOB CONCAT('%', key) 注意：GLOB是大小写敏感like*/
    leftGlob2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT GLOB CONCAT('%', key) 注意：GLOB是大小写敏感like*/
    notLeftGlob2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value GLOB CONCAT(key, '%') 注意：GLOB是大小写敏感like*/
    rightGlob2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT GLOB CONCAT(key, '%') 注意：GLOB是大小写敏感like*/
    notRightGlob2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value GLOB key 注意：GLOB是大小写敏感like,这里不拼接%*/
    preciseGlob2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT GLOB key 注意：GLOB是大小写敏感like,这里不拼接%*/
    notPreciseGlob2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key IN (:value) */
    in(key: keyof T, value: Array<string | number>, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT IN (:value) */
    notIn(key: keyof T, value: Array<string | number>, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value IN (key1, key2, ...) */
    in2(key: (keyof T)[], value: string | number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND :value NOT IN (key1, key2, ...) */
    notIn2(key: (keyof T)[], value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key IS NULL */
    isNULL(key: keyof T): this;
    /** AND key IS NOT NULL */
    isNotNULL(key: keyof T): this;
    /** AND (key IS NULL OR key = '') */
    isEmpty(key: keyof T): this;
    /** AND key IS NOT NULL AND key <> ''*/
    isNotEmpty(key: keyof T): this;
    /** AND key BETWEEN :value1 AND :value2 */
    between(key: keyof T, value1: string | number, value2: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND key NOT BETWEEN :value1 AND :value2 */
    notBetween(key: keyof T, value1: string | number, value2: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND POW(2, key) & :value */
    pow(key: keyof T, value: number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND NOT POW(2, key) & :value */
    notPow(key: keyof T, value: number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND POW(2, :value) & key */
    pow2(key: keyof T, value: number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND NOT POW(2, :value) & key */
    notPow2(key: keyof T, value: number, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND POW(2, key1) & key2 */
    powWith(key: keyof T, values: Array<number | string>, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND NOT POW(2, key1) & key2 */
    notPowWith(key: keyof T, values: Array<number | string>, { paramName, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) */
    match(value: string, keys: (keyof T)[], { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) */
    notMatch(value: string, keys: (keyof T)[], { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) IN BOOLEAN MODE*/
    matchBoolean(value: string, keys: (keyof T)[], { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) IN BOOLEAN MODE */
    notMatchBoolean(value: string, keys: (keyof T)[], { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND MATCH(key1, key2, key3...) AGAINST (:value) WITH QUERY EXPANSION*/
    matchQuery(value: string, keys: (keyof T)[], { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND NOT MATCH(key1, key2, key3...) AGAINST (:value) WITH QUERY EXPANSION*/
    notMatchQuery(value: string, keys: (keyof T)[], { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND LOCATE(key, :value) > 0 */
    includes(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND NOT LOCATE(key, :value) = 0 */
    notIncludes(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND LOCATE(:value, key) > 0 */
    includes2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND NOT LOCATE(:value, key) = 0 */
    notIncludes2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND FIND_IN_SET(:value, key) */
    findInSet(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    /** AND FIND_IN_SET(key, :value) */
    findInSet2(key: keyof T, value: string | number, { paramName, skipEmptyString, breakExcuteIfEmpty }?: {
        paramName?: string | undefined;
        skipEmptyString?: boolean | undefined;
        breakExcuteIfEmpty?: boolean | undefined;
    }): this;
    and(fn: StreamQuery<T> | ((stream: StreamQuery<T>) => boolean | void)): this;
    or(fn: StreamQuery<T> | ((stream: StreamQuery<T>) => boolean | void)): this;
    /**
     * sql WHERE 查询语句拼接：注意若有JOIN，需要写明别名。本表别名为t.例如:
     * ```
     * where('t.name > :name', {name: 1});
     * where('(t.name > :name OR t.name <> :name)', {name: 1});
     * ```
     */
    where(sql: string, param?: Record<string, any>): this;
    /** SET key = IFNULL(key, 0) + :value */
    incr(key: keyof T, value?: number): this;
    /** GROUP BY key1, key2, ... */
    groupBy(...keys: (keyof T)[]): this;
    /** GROUP BY key1, key2, ... */
    groupBy2(...keys: string[]): this;
    /** ORDER BY key1 ASC, key2 ASC, ... */
    asc(...keys: (keyof T)[]): this;
    /** ORDER BY key1 ASC, key2 ASC, ... */
    asc2(...keys: string[]): this;
    /** ORDER BY key1 DESC, key2 DESC, ... */
    desc(...keys: (keyof T)[]): this;
    /** ORDER BY key1 DESC, key2 DESC, ... */
    desc2(...keys: string[]): this;
    /** LIMIT :startRow, :pageSize */
    limit(startRow: number, pageSize: number): this;
    /** LIMIT ((:pageNumber || 1) - 1) * :pageSize, :pageSize */
    page(pageNumber: number, pageSize: number): this;
    distinct(on?: boolean): this;
    /** COUNT(DISTINCT key) */
    countDistinct(key: keyof T, countName?: string): this;
    count(countName?: string): this;
    sum(key: keyof T, legName?: string, distinct?: boolean): this;
    avg(key: keyof T, legName?: string, distinct?: boolean): this;
    max(key: keyof T, legName?: string, distinct?: boolean): this;
    min(key: keyof T, legName?: string, distinct?: boolean): this;
    /** GROUP_CONCAT([DISTINCT] key [ORDER BY :asc ASC] [ORDER BY :asc DESC] [SEPARATOR :separator]) */
    groupConcat(key: keyof T, param?: {
        distinct?: boolean;
        separator?: string;
        asc?: (keyof T)[];
        desc?: (keyof T)[];
        groupName?: string;
    }): this;
    select(...key: (keyof T)[]): this;
    /**
     * sql查询语句拼接：注意若有JOIN，需要写明别名。本表别名为t.例如:
     * ```
     * select2('t.name, t.age, ISNULL(t.type, :type)', {type: 1});
     * select2('MAX(t.age) MAXAge');
     * ```
     */
    select2(sql: string, param?: Record<string, any>): this;
    update(key: keyof T, value: T[keyof T]): this;
    /** update语句拼接：注意若有JOIN，需要写明别名。本表别名为t */
    update2(sql: string, param?: Record<string, any>): this;
    updateT(t: Partial<T>): this;
    /** SET key = REPLACE(key, :valueToFind,  :valueToReplace) */
    replace(key: keyof T, valueToFind: T[keyof T], valueToReplace: T[keyof T]): this;
    excuteSelect<L = T>(option?: MethodOption & {
        sync?: SyncMode.Async;
        selectResult?: SelectResult.RS_CS | SelectResult.RS_C;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<L[]>;
    excuteSelect<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert;
        errorMsg?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<L>;
    excuteSelect<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<L | null>;
    excuteSelect<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult: SelectResult.RS_CS | SelectResult.RS_C;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): L[];
    excuteSelect<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert;
        errorMsg?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): L;
    excuteSelect<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): L | null;
    excutePage<L = T>(option?: MethodOption & {
        sync?: SyncMode;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): PageQuery<L> | Promise<PageQuery<L>>;
    excuteUpdate(option?: MethodOption & {
        sync?: SyncMode.Async;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
    }): Promise<number>;
    excuteUpdate(option: MethodOption & {
        sync: SyncMode.Sync;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
    }): number;
    excuteDelete(option?: MethodOption & {
        sync?: SyncMode.Async;
        forceDelete?: boolean;
    }): Promise<number>;
    excuteDelete(option: MethodOption & {
        sync: SyncMode.Sync;
        forceDelete?: boolean;
    }): number;
    private _where;
    private _;
    private _2;
    private __;
    private _null;
    private _key;
    private _between;
    private _in;
    private _in2;
    private _shift;
    private _match;
    private _pow;
    private _pow2;
    private _like;
    private _like2;
    private _includes;
    private _includes2;
}
