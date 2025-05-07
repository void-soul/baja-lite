import * as ite from 'iterare';
const iterate = ite.iterate;
/**
 * 对象对象（等同与convertBean）
 * 仅会将classType有的属性进行转换
 * * 相当与一次属性过滤
 * @param source
 * @param classType
 */
export const copyBean = <T>(source: any, classType: any): T => {
  const result = {};
  Object.keys(classType).forEach((key) => {
    result[key] =
      source[key] !== undefined ? source[key] : (result[key] = null);
  });
  return result as T;
};

/**
 * 对象转换（等同与copyBean）
 * 仅会将classType有的属性进行转换
 * 相当与一次属性过滤
 * @param source
 * @param classType
 */
export const convertBean = copyBean;
/**
 * 批量对象转换（等同与copyBean）
 * 仅会将classType有的属性进行转换
 * 相当与一次属性过滤
 * @param source
 * @param classType
 */
export const convertBeans = <T>(
  source: any[],
  classType: any,
  cb?: (target: T, source: any) => void
): T[] => {
  const result = new Array<T>();
  for (const bean of source) {
    const data = convertBean<T>(bean, classType);
    if (cb) {
      cb(data, bean);
    }
    result.push(data);
  }
  return result;
};
/**
 * 创建一个空对象
 * 其内各属性都是null
 * @param classType
 */
export const emptyBean = <T>(classType: any): T => {
  const target = {} as T;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  Object.keys(classType).forEach((key) => {
    target[key] = null;
  });
  return target;
};

/**
 * 将一个json数组提取为一个json对象
 * @param source 源数组
 * @param key 作为新对象的key的字段
 * @param value 作为新对象value的字段,不传则将自身为value
 */
export const createBeanFromArray = <F, T = F>(
  source: F[],
  key: keyof F,
  value?: keyof F
): {
  [name: string]: T;
} => {
  const result: {
    [name: string]: T;
  } = {};
  if (value) {
    source.forEach((item) => {
      if (item[key]) {
        result[`${item[key]}`] = item[value] as unknown as T;
      }
    });
  } else {
    source.forEach((item) => {
      if (item[key]) {
        result[`${item[key]}`] = item as unknown as T;
      }
    });
  }
  return result;
};

/**
 * 转换复合对象为指定bean
 * @param source
 * @param classType
 */
export const coverComplexBean = <T>(
  source: any,
  classType: any
): { data: T; array: { [key: string]: any[] } } => {
  const result = {};
  const arrayData = {};
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  for (const [key, value] of Object.entries(source)) {
    if (value instanceof Array) {
      arrayData[key] = value;
    } else if (typeof value === 'object') {
      Object.assign(result, value);
    } else {
      result[key] = value;
    }
  }
  return {
    data: convertBean<T>(result, classType),
    array: arrayData
  };
};

/**
 * 将目标对象中为空的字段替换为source中对应key的值或者函数返回值
 * @param target
 * @param source
 */
export const fixEmptyPrototy = async (
  target: any,
  source: {
    [key: string]: any;
  }
) => {
  for (const [key, fn] of Object.entries(source)) {
    if (!target[key]) {
      if (typeof fn === 'function') {
        target[key] = await fn();
      } else {
        target[key] = fn;
      }
    }
  }
};


export const mixArray = <T>(array: T[], key: keyof T, defKey?: string): { [key: string]: number } => {
  const obj = array.map(item => item[key]);
  const result: { [k: string]: number } = {};
  for (const i of obj) {
    let ki = '';
    if (i !== undefined && i !== null) {
      ki = `${i}`;
    } else if (defKey) {
      ki = defKey;
    }
    if (!result[ki]) {
      result[ki] = 0;
    }
    result[ki]!++;
  }
  return result;
};

export const mixList = <T, V = T>(array: T[], key: keyof T, value?: keyof T, defKey?: string): { [key: string]: V[] } => {
  const result: { [k: string]: V[] } = {};
  for (const i of array) {
    let ki = '';
    if (i[key] !== undefined && i[key] !== null) {
      ki = `${i[key]}`;
    } else if (defKey) {
      ki = defKey;
    }
    if (!result[ki]) {
      result[ki] = [];
    }
    if (value) {
      result[ki]!.push(i[value] as any);
    } else {
      result[ki]!.push(i as any);
    }
  }
  return result;
};

export const array2map = <T = string | number>(array: string[], v: T): { [key: string]: T } => {
  const ot: { [key: string]: T } = {};
  for (const item of array) {
    ot[item] = v;
  }
  return ot;
};
/**
 * 数组分割
 * @param datas
 * @param config(二选一) everyLength=每组个数(最后一组可能不足次数), groupCount=拆分几组
 * @returns T[][]
 */
export const arraySplit = <T = any>(datas: T[], { everyLength = 0, groupCount = 0 } = {}) => {
  if (groupCount > 0) {
    everyLength = Math.floor(datas.length / groupCount + 0.9);
    const result: T[][] = [];
    for (let i = 0; i < groupCount; i++) {
      result.push(datas.slice(i * everyLength, (i + 1) * everyLength));
    }
    return result;
  } else if (everyLength > 0) {
    groupCount = Math.ceil(datas.length / everyLength);
    const result: T[][] = [];
    for (let i = 0; i < groupCount; i++) {
      result.push(datas.slice(i * everyLength, (i + 1) * everyLength));
    }
    return result;
  } else {
    throw new Error('参数错误!');
  }
};


const P2CEX = /[A-Z]/g;
export const P2C = (pro: string, IF = true) => IF ? pro.replace(P2CEX, (a: string) => `_${a.toLowerCase()}`) : pro;
const C2PEX = /_([a-z])/g;
export const C2P = (pro: string, IF = true) => IF ? pro.replace(C2PEX, (a: string, b: string) => `${b.toUpperCase()}`) : pro;


export function C2P2<T extends Object = any, L extends Object = T>(datas: L[]): T[];
export function C2P2<T extends Object = any, L extends Object = T>(datas: L): T;
export function C2P2<T extends Object = any, L extends Object = T>(datas: L | L[]): T | T[] {
  if (datas instanceof Array) {
    return iterate(datas).map((data: L) => Object.fromEntries<T>(Object.entries(data).map(([K, V]) => [C2P(K), V]))).toArray() as unknown as T[];
  } else if (datas) {
    return Object.fromEntries<T>(Object.entries(datas).map(([K, V]) => [C2P(K), V])) as unknown as T;
  } else {
    return datas;
  }
}

export function P2C2<T extends Object = any, L extends Object = T>(datas: L[]): T[];
export function P2C2<T extends Object = any, L extends Object = T>(datas: L): T;
export function P2C2<T extends Object = any, L extends Object = T>(datas: L | L[]): T | T[] {
  if (datas instanceof Array) {
    return iterate(datas).map((data: L) => Object.fromEntries<T>(Object.entries(data).map(([K, V]) => [P2C(K), V]))).toArray() as unknown as T[];
  } else if (datas) {
    return Object.fromEntries<T>(Object.entries(datas).map(([K, V]) => [P2C(K), V])) as unknown as T;
  } else {
    return datas;
  }
}

export function fillArrayToMinLength<T>(arr: T[], minLength: number, fillValue: T): T[] {
  while (arr.length < minLength) arr.push(fillValue);
  return arr;
}