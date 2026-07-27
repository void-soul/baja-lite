/**
 * 回调函数promise化
 * 调用示例
 * soap.excute(arg1, arg2, function(error, data){});
 * 可使用为:
 * const soap_excute = promise({
 *  fn: soap.excute,
 *  target: soap
 * });
 * const data = await soap_excute(arg1, arg2);
 * @param this
 * @param param1
 */
export declare const promise: <T>(this: any, { fn, target, last }: {
    fn: (...args: any[]) => any;
    target?: any;
    last?: boolean;
}) => (...args: any[]) => Promise<T>;
export declare const sleep: (time?: number) => Promise<unknown>;
/**
 * 执行器
 * @param fn
 * @param {
    ifFinish?: (result?: T) => boolean; // 是否结束,默认是建议判断 !!result
    maxTryTimes?: number; //最多尝试几次,默认是20
    onFail?: () => Promise<boolean | undefined> | boolean | undefined; // 失败时的回调，返回false表示停止执行
    name?: string;  // 执行器名称，用于打印日志
    exitIfFail?: boolean; // 失败时是否退出，默认是false. 这里设置true后，onFail返回true,也会停止执行
    defVal?: T; // 失败时的默认值
    sleepAppend?: number; // 等待延迟MS，默认是1000内随机+200
 * }
 * @returns
 */
export declare function dieTrying<T = any>(fn: (...args: any[]) => Promise<T | undefined> | T | undefined, { ifFinish, maxTryTimes, onFail, name, exitIfFail, defVal, sleepAppend }?: {
    ifFinish?: (result?: T) => boolean;
    maxTryTimes?: number;
    onFail?: () => Promise<boolean | undefined> | boolean | undefined;
    name?: string;
    exitIfFail?: boolean;
    defVal?: T;
    sleepAppend?: number;
}): Promise<T | undefined>;
export declare enum ExcuteSplitMode {
    SyncTrust = 0,
    SyncNoTrust = 1,
    AsyncTrust = 2,
    AsyncNoTrust = 3
}
/**
 * 数组分割执行
 * @param datas 数组
 * @param fn 执行的函数, 参数1：分割数组；参数2：第几个分割数组；参数3：分割数组的数量；参数4：从第几个下标（相对于总数组）元素开始；参数5：到第几个下标（相对于总数组）元素结束
 * @param config 配置（三选一）：everyLength=每组个数(最后一组可能不足次数), groupCount=拆分几组, extendParams=依附拆分数组；
 * @param 额外选项 settled=是否并行?
 * T: datas类型
 * E: extendParams类型
 * R: 返回值类型
 */
/**
 * 数组分割执行
 *
 * # 参数说明
 * @param sync 同步异步开关
 * @param datas 数组
 * @param fn 执行的函数
  ```
  ** `args`:   分割后的小数组
  ** `index`:  第几个小数组
  ** `length`: 总共多少个小数组
  ** `extendParam`?: `参见下面Option中的extendParams`
  ** `startIndex`?: 本次小数组的第一个元素是从总数组的第几个元素
  ** `endIndex`?: 本次小数组的最后一个元素是从总数组的第几个元素
  fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number):R => {

  }
  ```
  * @param option 选项

  ## 分割数组方式:2种，选择一种即可
  1. everyLength=每组个数(最后一组可能不足次数)
  2. groupCount=拆分几组
  ## `settled` 异步执行是否并行执行? 默认false。
  ** 注意：开启并行执行时，请确保 `fn` 内部没有共享状态（如共用同一个数据库连接），否则可能导致冲突。
  ## `extendParams`：扩展参数
  ** 数组
  ** 结合分组方式：groupCount使用。例如:
  ```
  `groupCount`=5，那么可以传入5个`extendParams`,在执行分组时，会为每个数组传入对应下标的`extendParam`
  ```
  ## `trust` 是否信任方法体，默认false
  * true时，执行时捕获不异常, 返回值变为 R[]
  * false时,执行时捕获异常，并返回 { result: R[]; error: string[]; };
  # 泛型说明:全部可选
  1. T = 数组类型
  2. R = 返回结果类型
  3. E = 扩展参数类型

 * @returns
 */
export declare function excuteSplit<T = any, R = any, E = any>(sync: ExcuteSplitMode.SyncTrust, datas: T[], fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => R, option: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
}): R[];
export declare function excuteSplit<T = any, R = any, E = any>(sync: ExcuteSplitMode.SyncNoTrust, datas: T[], fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => R, option: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
}): {
    result: R[];
    error: string[];
};
export declare function excuteSplit<T = any, R = any, E = any>(sync: ExcuteSplitMode.AsyncTrust, datas: T[], fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => Promise<R>, option: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
}): Promise<R[]>;
export declare function excuteSplit<T = any, R = any, E = any>(sync: ExcuteSplitMode.AsyncNoTrust, datas: T[], fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => Promise<R>, option: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
}): Promise<{
    result: R[];
    error: string[];
}>;
