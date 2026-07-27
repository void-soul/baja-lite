/**
 * 对象对象（等同与convertBean）
 * 仅会将classType有的属性进行转换
 * * 相当与一次属性过滤
 * @param source
 * @param classType
 */
export declare const copyBean: <T>(source: any, classType: any) => T;
/**
 * 对象转换（等同与copyBean）
 * 仅会将classType有的属性进行转换
 * 相当与一次属性过滤
 * @param source
 * @param classType
 */
export declare const convertBean: <T>(source: any, classType: any) => T;
/**
 * 批量对象转换（等同与copyBean）
 * 仅会将classType有的属性进行转换
 * 相当与一次属性过滤
 * @param source
 * @param classType
 */
export declare const convertBeans: <T>(source: any[], classType: any, cb?: (target: T, source: any) => void) => T[];
/**
 * 创建一个空对象
 * 其内各属性都是null
 * @param classType
 */
export declare const emptyBean: <T>(classType: any) => T;
/**
 * 将一个json数组提取为一个json对象
 * @param source 源数组
 * @param key 作为新对象的key的字段
 * @param value 作为新对象value的字段,不传则将自身为value
 */
export declare const createBeanFromArray: <F, T = F>(source: F[], key: keyof F, value?: keyof F) => {
    [name: string]: T;
};
/**
 * 转换复合对象为指定bean
 * @param source
 * @param classType
 */
export declare const coverComplexBean: <T>(source: any, classType: any) => {
    data: T;
    array: {
        [key: string]: any[];
    };
};
/**
 * 将目标对象中为空的字段替换为source中对应key的值或者函数返回值
 * @param target
 * @param source
 */
export declare const fixEmptyPrototy: (target: any, source: {
    [key: string]: any;
}) => Promise<void>;
/**
 * 1. 统计array中某个字段key的数量:{ [k: string]: number }
 *
 * @param array T组成的array,数据源
 * @param key  返回结果{ [k: string]: number }的key
 * @param defKey  如果array中某个对象没有key字段，则归类到默认key中
 * @returns
 */
export declare const mixArray: <T>(array: T[], key: keyof T, defKey?: string) => {
    [key: string]: number;
};
/**
 * 1. 将T组成的array按照某个字段(key)提取为{ [key: string]: V[] }
 * @param array T组成的array,数据源
 * @param key 返回结果{ [key: string]: V[] }的key
 * @param value  返回结果{ [key: string]: V[] }中的V可以是T，也可以是T的某个字段(指定value参数)
 * @param defKey 如果array中某个对象没有key字段，则归类到默认key中
 * @returns
 */
export declare const mixList: <T, V = T>(array: T[], key: keyof T, value?: keyof T, defKey?: string) => {
    [key: string]: V[];
};
/**
 * ## 仿照Object.assign的数组方法
 * ### 1. 用法参照
 * ```
 *  // ID 是 数组中对象的关键字段，用来区分同一条记录.支持多个字段(联合主键场景)
 *  // 与assign的逻辑相同，后面的数组会覆盖前面数组的相同对象的同名字段
 *  const result = assignArray('ID', Array1, Array2, Array3...);
 * ```
 * @param key
 * @param arrays
 * @returns
 */
export declare const assignArray: <T>(key: keyof T | (keyof T)[] | ((t1: T, t2: T) => boolean), ...arrays: T[][]) => T[];
export declare const array2map: <T = string | number>(array: string[], v: T) => {
    [key: string]: T;
};
/**
 * 数组分割
 * @param datas
 * @param config(二选一) everyLength=每组个数(最后一组可能不足次数), groupCount=拆分几组
 * @returns T[][]
 */
export declare const arraySplit: <T = any>(datas: T[], { everyLength, groupCount }?: {
    everyLength?: number | undefined;
    groupCount?: number | undefined;
}) => T[][];
/**
 * 合并对象（浅），忽略后续参数的null、undefined、空字符串
 * @param source
 * @param os
 * @returns
 */
export declare const assginObject: <T extends Object>(source: T, ...os: T[]) => void;
/**
 * 去除数组中重复数据，同时可以通过each函数为每个数据执行某项操作
 * @param source
 * @param each
 */
export declare const distinctArray: <T extends Object>(source: T[], keys: (keyof T)[], each?: (data: T) => void) => T[];
export declare const P2C: (pro: string, IF?: boolean) => string;
export declare const C2P: (pro: string, IF?: boolean) => string;
export declare function C2P2<T extends Object = any, L extends Object = T>(datas: L[], hump?: boolean, convert?: Record<string, (data: any) => any>): T[];
export declare function C2P2<T extends Object = any, L extends Object = T>(datas: L, hump?: boolean, convert?: Record<string, (data: any) => any>): T;
export declare function P2C2<T extends Object = any, L extends Object = T>(datas: L[]): T[];
export declare function P2C2<T extends Object = any, L extends Object = T>(datas: L): T;
export declare function fillArrayToMinLength<T>(arr: T[], minLength: number, fillValue: T): T[];
