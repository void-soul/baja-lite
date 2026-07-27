import { MapperIfUndefined, SqlMapper, SqlMappers, _SqlModel } from '../const/types.js';
/**
 * ifUndefined默认是MapperIfUndefined.Skip
 */
export declare function flatData<M>(options: {
    data: any;
    mapper: string | SqlMapper;
    mapperIfUndefined?: MapperIfUndefined;
}): M;
export declare class SqlCache {
    private sqlMap;
    private sqlFNMap;
    private _read;
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
    private readResultMap;
    init(options: {
        sqlMap?: _SqlModel;
        sqlDir?: string;
        sqlFNMap?: Record<string, string>;
        sqlFNDir?: string;
        sqlMapperMap?: SqlMappers;
        sqlMapperDir?: string;
        jsMode?: boolean;
    }): Promise<void>;
    load(sqlids: string[], options: {
        ctx?: any;
        isCount?: boolean;
        isSum?: boolean;
        limitStart?: number;
        limitEnd?: number;
        sortName?: string;
        sortType?: string;
        [k: string]: any;
    }): string;
}
