import { arraySplit } from './object.js';
import { Throw } from './error.js';
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
export const promise = function <T>(
  this: any,
  { fn, target, last = true }: { fn: (...args: any[]) => any; target?: any; last?: boolean }
): (...args: any[]) => Promise<T> {
  return (...args: any[]): Promise<T> => {
    return new Promise((resolve, reject) => {
      args[last === true ? 'push' : 'unshift'](
        (
          err: {
            message: string;
            [key: string]: any;
          } | null,
          data: T
        ) => {
          if (err === null || err === undefined) {
            return resolve.call(this, data);
          }
          return reject(err);
        }
      );
      if (target) {
        fn.apply(target, args);
      } else {
        fn.apply({}, args);
      }
    });
  };
};

export const sleep = (time: number = parseInt(`${Math.random()}`) + 200,) =>
  new Promise((resolve) => setTimeout(resolve, time));

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
export async function dieTrying<T = any>(
  fn: (...args: any[]) => Promise<T | undefined> | T | undefined,
  {
    ifFinish = (result?: T) => !!result,
    maxTryTimes = 20,
    onFail,
    name = 'dieTrying',
    exitIfFail = true,
    defVal,
    sleepAppend = 0
  }: {
    ifFinish?: (result?: T) => boolean;
    maxTryTimes?: number;
    onFail?: () => Promise<boolean | undefined> | boolean | undefined;
    name?: string;
    exitIfFail?: boolean;
    defVal?: T;
    sleepAppend?: number;
  } = {}): Promise<T | undefined> {
  let count = 0;
  let result = defVal;
  while (result = await fn(), !ifFinish(result)) {
    await sleep(parseInt(`${Math.random() * 1000}`) + sleepAppend);
    count++;
    console.debug(`${name} try ${count} times`);
    if (count > maxTryTimes) {
      if (onFail) {
        const remuseExcute = await onFail();
        console.error(`${name} timeout`);
        count = 0;
        if (remuseExcute === false) {
          break;
        }
      }
      if (exitIfFail) {
        break;
      }
    }
  }
  return result;
}
export enum ExcuteSplitMode {
  SyncTrust,
  SyncNoTrust,
  AsyncTrust,
  AsyncNoTrust,
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
  ## settled 异步执行是否并行执行? 默认false
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
export function excuteSplit<T = any, R = any, E = any>(
  sync: ExcuteSplitMode.SyncTrust,
  datas: T[],
  fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => R,
  option: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
  }
): R[];
export function excuteSplit<T = any, R = any, E = any>(
  sync: ExcuteSplitMode.SyncNoTrust,
  datas: T[],
  fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => R,
  option: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
  }
): { result: R[]; error: string[]; };
export function excuteSplit<T = any, R = any, E = any>(
  sync: ExcuteSplitMode.AsyncTrust,
  datas: T[],
  fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => Promise<R>,
  option: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
  }
): Promise<R[]>;
export function excuteSplit<T = any, R = any, E = any>(
  sync: ExcuteSplitMode.AsyncNoTrust,
  datas: T[],
  fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => Promise<R>,
  option: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
  }
): Promise<{ result: R[]; error: string[]; }>;
export function excuteSplit<T = any, R = any, E = any>(
  sync: ExcuteSplitMode,
  datas: T[],
  fn: (args: T[], index: number, length: number, extendParam?: E, startIndex?: number, endIndex?: number) => R | Promise<R>,
  { everyLength = 0, groupCount = 0, settled = false, extendParams = new Array<E>() }: {
    everyLength?: number;
    groupCount?: number;
    settled?: boolean;
    extendParams?: E[];
  }
): Promise<{ result: R[]; error: string[]; }> | Promise<R[]> | { result: R[]; error: string[]; } | R[] {
  if (extendParams.length > 0) {
    groupCount = extendParams.length;
  }
  Throw.if(everyLength === 0 && groupCount === 0, '参数错误!');
  const ps = { everyLength, groupCount };
  const list = arraySplit(datas, ps);
  if (sync === ExcuteSplitMode.AsyncTrust) {
    return new Promise<R[]>(async (resolve, reject) => {
      try {
        const reasons: R[] = [];
        if (settled) {
          const result = await Promise.allSettled(list.map((list, i) => fn(list, i, list.length, extendParams[i])));
          for (const item of result) {
            if (item.status === 'rejected') {
              reject(item.reason);
            } else {
              reasons.push(item.value);
            }
          }
        } else {
          for (let i = 0; i < list.length; i++) {
            const startIndex = (i - 1) * ps.everyLength;
            const endIndex = startIndex + list[i]!.length - 1;
            reasons.push(await fn(list[i]!, i, list.length, extendParams[i], startIndex, endIndex));
          }
        }
        resolve(reasons);
      } catch (error) {
        reject(error);
      }
    });
  } else if (sync === ExcuteSplitMode.AsyncNoTrust) {
    return new Promise<{ result: R[]; error: string[]; }>(async (resolve, reject) => {
      try {
        const reasons: { result: R[]; error: string[]; } = { result: [], error: [] };
        if (settled) {
          const result = await Promise.allSettled(list.map((list, i) => fn(list, i, list.length, extendParams[i])));
          for (const item of result) {
            if (item.status === 'rejected') {
              reasons.error.push(item.reason);
            } else {
              reasons.result.push(item.value);
            }
          }
        } else {
          for (let i = 0; i < list.length; i++) {
            const startIndex = (i - 1) * ps.everyLength;
            const endIndex = startIndex + list[i]!.length - 1;
            try {
              reasons.result.push(await fn(list[i]!, i, list.length, extendParams[i], startIndex, endIndex));
            } catch (error) {
              reasons.error.push(error as string);
            }
          }
        }
        resolve(reasons);
      } catch (error) {
        reject(error);
      }
    });
  } else if (sync === ExcuteSplitMode.SyncTrust) {
    const reasons: R[] = [];
    for (let i = 0; i < list.length; i++) {
      const startIndex = (i - 1) * ps.everyLength;
      const endIndex = startIndex + list[i]!.length - 1;
      reasons.push(fn(list[i]!, i, list.length, extendParams[i], startIndex, endIndex) as R);
    }
    return reasons;
  } else {
    const reasons: { result: R[]; error: string[]; } = { result: [], error: [] };
    for (let i = 0; i < list.length; i++) {
      try {
        const startIndex = (i - 1) * ps.everyLength;
        const endIndex = startIndex + list[i]!.length - 1;
        reasons.result.push(fn(list[i]!, i, list.length, extendParams[i], startIndex, endIndex) as R);
      } catch (error) {
        reasons.error.push(error as string);
      }
    }
    return reasons;
  }
}