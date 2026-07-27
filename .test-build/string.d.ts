/**
 * 通过uri获取key
 * @param uri
 */
/**
 * 通过 URI 获取图片 Key
 * @param uri 图片完整路径或包含 Key 的字符串
 */
export declare const getPicKey: (uri: string) => string;
/**
 * 判断对象/字符串是否为空
 * @param source 待判断的对象
 * @param skipEmptyString 是否跳过仅包含空白字符的字符串，默认为 true
 */
export declare const emptyString: (source: any, skipEmptyString?: boolean) => boolean;
/**
 * 判断对象/字符串是否不为空
 */
export declare const notEmptyString: (source: any, skipEmptyString?: boolean) => boolean;
/**
 * 安全字符串处理（移除单引号）
 * @deprecated 不推荐用于 SQL 注入防护，请使用参数化查询
 * @param source 源字符串
 * @returns 移除单引号后的字符串
 */
export declare const safeString: (source?: string) => string;
/**
 * 修剪对象中所有字符串属性的首尾空格
 */
export declare const trimObject: <T>(data: any) => T;
/**
 * 生成指定长度的随机数字字符串
 */
export declare const randomNumber: (len: number) => string;
/**
 * 生成指定长度的随机字符串（包含大小写字母和数字）
 */
export declare const randomString: (len: number) => string;
export declare const randomString2: (len: number) => string;
export declare const randomString3: (len: number) => string;
export declare const buildWxStr: (data: {
    [key: string]: string;
}, maxLabelLength: number, ...titles: string[]) => string;
/**
 * 将字符串中的中文标点符号统一替换为对应的英文标点
 */
export declare const replaceChineseCode: (str: string) => string;
/** 更安全的sql 参数占位符替换 */
export declare function replacePlaceholders(sql: string): string;
