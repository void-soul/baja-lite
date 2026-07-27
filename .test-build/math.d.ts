/** 金钱格式化可用样式 */
export declare class MoneyOption {
    style?: 'currency' | 'decimal' | 'percent';
    currency?: string;
    prefix?: number;
    def?: number;
    currencyDisplay?: 'symbol' | 'name' | 'code';
    useGrouping?: boolean;
    local?: string;
}
export interface Point {
    latitude: string;
    longitude: string;
    lat: number;
    long: number;
}
export declare const num: (val: any, def?: number) => number;
export declare const max: (...args: any[]) => number;
export declare const min: (...args: any[]) => number;
export declare const div: (...args: any[]) => number;
export declare const divDef: (def: any, ...args: any[]) => number;
export declare const add: (...args: any[]) => number;
export declare const mul: (...args: any[]) => number;
export declare const sub: (...args: any[]) => number;
export declare const round: (number: any, numDigits: number, upOrDown?: number) => number;
/** =value.xx,其中xx=number,如number=99，表示修正数字为value.99 */
export declare const merge: (value: any, number: any) => any;
export declare const money: (value: any, option?: MoneyOption) => string;
export declare class Bus {
    private result;
    private ifit;
    constructor(result: any);
    add(...args: any[]): this;
    sub(...args: any[]): this;
    div(...args: any[]): this;
    divDef(def: any, ...args: any[]): this;
    mul(...args: any[]): this;
    max(...args: any[]): this;
    min(...args: any[]): this;
    ac(): this;
    abs(): this;
    round(numDigits: number, upOrDown?: number): this;
    merge(number: any): this;
    if(condition: boolean): this;
    over(): number;
    money(option?: MoneyOption): string;
    lt(data: any): boolean;
    le(data: any): boolean;
    gt(data: any): boolean;
    ge(data: any): boolean;
    nlt(data: any): boolean;
    nle(data: any): boolean;
    ngt(data: any): boolean;
    nge(data: any): boolean;
    eq(data: any): boolean;
    ne(data: any): boolean;
    ifLt(data: any): this;
    ifLe(data: any): this;
    ifGt(data: any): this;
    ifGe(data: any): this;
    ifNlt(data: any): this;
    ifNle(data: any): this;
    ifNgt(data: any): this;
    ifNge(data: any): this;
    ifEq(data: any): this;
    ifNe(data: any): this;
}
export declare const calc: (result: any) => Bus;
export declare const getGeo: (p1: Point, p2: Point) => number;
/**
 * 十进制转换自定义进制
 * @param from 数字
 * @param to 自定义进制的字符
 * @returns
 */
export declare function ten2Any(from: number, to?: string): string;
/**
 * 自定义进制转换十进制
 * @param from
 * @param to
 * @returns
 */
export declare function any2Ten(from: string, to?: string): number;
