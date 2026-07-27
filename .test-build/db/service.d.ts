import { _columns, _columnsNoId, _def, _deleteState, _fields, _ids, _index, _logicIds, _stateFileName, DBType, FieldOption } from 'baja-lite-field';
import { _ClassName, _className, _comment, _daoDBName, _dbType, _SqlOption, _sqlite_version, _tableName, _transformer, _vueName } from '../const/symbols.js';
import { Connection, DeleteMode, InsertMode, MethodOption, PageQuery, SelectMode, SelectResult, ServiceOption, SqlMapper, SyncMode, TemplateResult, MapperIfUndefined } from '../const/types.js';
import { StreamQuery } from './stream-query.js';
export declare const DB: (config: ServiceOption) => <C extends {
    new (...args: any[]): {};
}>(constructor: C) => {
    new (...args: any[]): {
        [_tableName]: string | undefined;
        [_className]: string | undefined;
        [_ClassName]: string | undefined;
        [_vueName]: string | undefined;
        [_daoDBName]: string | undefined;
        [_dbType]: DBType | undefined;
        [_sqlite_version]: string | undefined;
        [_SqlOption]: {
            maxDeal: number;
            skipUndefined: boolean;
            skipNull: boolean;
            skipEmptyString: boolean;
        } & ServiceOption;
        [_ids]: any;
        [_logicIds]: any;
        [_fields]: any;
        [_columns]: any;
        [_columnsNoId]: any;
        [_index]: any;
        [_def]: any;
        [_comment]: string | undefined;
        [_stateFileName]: any;
        [_deleteState]: any;
        [_transformer]: <L extends Object>(data: L, option?: MethodOption & {
            finalColumns?: Set<string>;
            tempColumns?: Array<string>;
            insert?: boolean;
            skipId?: boolean;
            skipNull?: boolean;
            skipUndefined?: boolean;
            skipEmptyString?: boolean;
            onFieldExists?: (K: string, V: any) => void;
        }) => any;
    };
} & C;
/**
  js项目中实体类注解替代品，只要确保函数被执行即可,举例：
  ```
  // 声明一个class
    export class AmaFuck {}
    DeclareClass(AmaFuck, [
        { type: "String", name: "SellerSKU" },
        { type: "String", name: "SellerSKU2" },
        { type: "String", name: "site" }
    ]);
  ```
 */
export declare function DeclareClass(clz: any, FieldOptions: FieldOption[]): void;
/**
 JS项目中，service注解代替,举例：
 ```
 // 声明一个service,注意这里的let
    export let AmaService = class AmaService extends SqlService {};
    AmaService = DeclareService(AmaService, {
        tableName: "ama_fuck2",
        clz: AmaFuck,
        dbType: DBType.Sqlite,
        sqliteVersion: "0.0.3"
    });
 ```
 */
export declare function DeclareService(clz: any, config: ServiceOption): any;
/**
 ## 数据库服务
 ### 注解DB
 
 ### 泛型 T，同DB注解中的clz
 ** 服务中所有方法默认以该类型为准
 **
 
 */
export declare class SqlService<T extends object> {
    [_tableName]?: string;
    private [_className]?;
    private [_ClassName]?;
    private [_vueName]?;
    private [_daoDBName]?;
    private [_comment]?;
    private [_ids]?;
    private [_fields]?;
    private [_columns]?;
    private [_columnsNoId]?;
    private [_stateFileName]?;
    private [_deleteState]?;
    private [_SqlOption]?;
    private [_dbType]?;
    private [_sqlite_version]?;
    private [_index]?;
    private [_def]?;
    [_transformer]?: <L = T>(data: Partial<L>, option?: MethodOption & {
        finalColumns?: Set<string>;
        insert?: boolean;
        skipId?: boolean;
        skipNull?: boolean;
        skipUndefined?: boolean;
        skipEmptyString?: boolean;
        onFieldExists?: (K: string, V: any) => void;
    }) => Partial<T>;
    private _insert;
    /**
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认 `异步`
    1. `data`：可是数组或者单对象
    2. `skipUndefined`: boolean; 是否不处理值为undefined的字段,默认 true
    3. `skipNull`: boolean; 是否不处理值为null的字段,默认 true
    4. `skipEmptyString`: boolean; 是否不处理值为空字符串(`注意：多个空格也算空字符串`)的字段,默认 true
    5. `maxDeal`: number; 批量处理时，每次处理多少个？默认500
    6. `tableName`: 默认使用service注解的`tableName`,可以在某个方法中覆盖
    7. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    8. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    9.  `dao`: 永远不需要传入该值
    10. `mode` :默认`insert`，可选如下
        1. `insert`: 默认
        2. `insertIfNotExists`: 通过主键或者existConditionOtherThanIds字段判断数据是否存在，不存在才插入,存在则不执行
        3. `replace`: 只支持用主键判断, 存在更新, 不存在插入
    11. `existConditionOtherThanIds`: insertIfNotExists时判断同一记录的字段名称，默认情况下按照ID判断，设置existConditionOtherThanIds后，不用id
    12. `replaceWithDef` replace时，是否带入默认值? 默认true
    ### 返回值是最后一次插入的主键ID，对于自增ID表适用
    1. 如果主键是自增批量操作，且期望返回所有记录的ID，那么需要设置 `option 中的 every = true`,此时效率降低
     * @param {{[P in keyof T]?: T[P]}} data
     * @param {MethodOption} [option]
     * @memberof SqlServer
     */
    insert(option: MethodOption & {
        data: Partial<T>;
        sync?: SyncMode.Async;
        mode?: InsertMode;
        existConditionOtherThanIds?: (keyof T)[];
        every?: boolean;
        temp?: boolean;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        maxDeal?: number;
        replaceWithDef?: boolean;
    }): Promise<bigint>;
    insert(option: MethodOption & {
        data: Partial<T>[];
        sync?: SyncMode.Async;
        mode?: InsertMode;
        existConditionOtherThanIds?: (keyof T)[];
        every?: boolean;
        temp?: boolean;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        maxDeal?: number;
        replaceWithDef?: boolean;
    }): Promise<bigint[]>;
    insert(option: MethodOption & {
        data: Partial<T>;
        sync: SyncMode.Sync;
        mode?: InsertMode;
        existConditionOtherThanIds?: (keyof T)[];
        every?: boolean;
        temp?: boolean;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        maxDeal?: number;
        replaceWithDef?: boolean;
    }): bigint;
    insert(option: MethodOption & {
        data: Partial<T>[];
        sync: SyncMode.Sync;
        mode?: InsertMode;
        existConditionOtherThanIds?: (keyof T)[];
        every?: boolean;
        temp?: boolean;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        maxDeal?: number;
        replaceWithDef?: boolean;
    }): bigint[];
    private _update;
    /**
    ## 根据主键修改
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. `data`：可是数组或者单对象
    2. `skipUndefined`: boolean; 是否不处理值为undefined的字段,默认 true
    3. `skipNull`: boolean; 是否不处理值为null的字段,默认 true
    4. `skipEmptyString`: boolean; 是否不处理值为空字符串(`注意：多个空格也算空字符串`)的字段,默认 true
    5. `maxDeal`: number; 批量处理时，每次处理多少个？默认500
    6. `tableName`: 默认使用service注解的`tableName`,可以在某个方法中覆盖
    7. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    8. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    9.  `dao`: 永远不需要传入该值
     */
    update(option: MethodOption & {
        data: Partial<T> | Array<Partial<T>>;
        sync?: SyncMode.Async;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        maxDeal?: number;
    }): Promise<number>;
    update(option: MethodOption & {
        data: Partial<T> | Array<Partial<T>>;
        sync: SyncMode.Sync;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        maxDeal?: number;
    }): number;
    /**
    ## 删除
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. 支持按ID删除：可以单个ID或者ID数组 `需要实体类只有一个ID`
    2. 支持实体类删除: 用于多个ID或者按实体类某些字段删除
    3. 两种模式：`mode`=`Common` 或者 `TempTable`
    3. 如果数据多，使用 `TempTable`模式
    4. 当设置实体类的字段有 `logicDelete` ，将进行逻辑删除，除非设置 `forceDelete` = true
    5. 支持`whereSql`直接拼接，此时必须传递`whereParams`,不建议直接使用这种方式！为了简化逻辑，它不会和ID、WHERE共存，且优先级更高。且不支持 `TempTable` Mode
    6. `tableName`: 默认使用service注解的`tableName`,可以在某个方法中覆盖
    7. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    8. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    9.  `dao`: 永远不需要传入该值
    */
    delete(option: MethodOption & {
        sync?: SyncMode.Async;
        id?: string | number | Array<string | number>;
        where?: Partial<T> | Array<Partial<T>>;
        mode?: DeleteMode;
        forceDelete?: boolean;
        whereSql?: string;
        whereParams?: Record<string, any>;
    }): Promise<number>;
    delete(option: MethodOption & {
        sync: SyncMode.Sync;
        id?: string | number | Array<string | number>;
        where?: Partial<T> | Array<Partial<T>>;
        mode?: DeleteMode;
        forceDelete?: boolean;
        whereSql?: string;
        whereParams?: Record<string, any>;
    }): number;
    private _template;
    /**
    #根据条件查询对象
    ## 特点：快速、简单，可快速根据某些字段是否等于来查询返回，可以查询记录和记录数
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. `templateResult`: 返回值类型断言，4种
        1. `AssertOne` 确定返回一个，如果不是一个，将报错，返回类型是T `默认`
        2. `NotSureOne` 可能返回一个，返回类型是T|null
        3. `Many` 返回多个
        4. `Count` 返回记录数
    2. 支持按ID查询：可以单个ID或者ID数组 `需要实体类只有一个ID`
    3. 支持实体类查询: 用于多个ID或者按实体类某些字段查询
    4. 两种查询方式：`mode`=`Common`(默认) 或者 `TempTable`
    5. `tableName`: 默认使用service注解的`tableName`,可以在某个方法中覆盖
    6. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    7. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    8.  `dao`: 永远不需要传入该值

     */
    template<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        templateResult?: TemplateResult.AssertOne;
        id?: string | number | Array<string | number>;
        where?: Partial<L> | Array<Partial<L>>;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        mode?: SelectMode;
        error?: string;
        columns?: (keyof L)[];
    }): L;
    template<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        templateResult?: TemplateResult.AssertOne;
        id?: string | number | Array<string | number>;
        where?: Partial<L> | Array<Partial<L>>;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        mode?: SelectMode;
        error?: string;
        columns?: (keyof L)[];
    }): Promise<L>;
    template<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        templateResult: TemplateResult.Count;
        id?: string | number | Array<string | number>;
        where?: Partial<L> | Array<Partial<L>>;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        mode?: SelectMode;
        error?: string;
        columns?: (keyof L)[];
    }): number;
    template<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        templateResult: TemplateResult.Count;
        id?: string | number | Array<string | number>;
        where?: Partial<L> | Array<Partial<L>>;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        mode?: SelectMode;
        error?: string;
        columns?: (keyof L)[];
    }): Promise<number>;
    template<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        templateResult: TemplateResult.NotSureOne;
        id?: string | number | Array<string | number>;
        where?: Partial<L> | Array<Partial<L>>;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        mode?: SelectMode;
        error?: string;
        columns?: (keyof L)[];
    }): L | null;
    template<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        templateResult: TemplateResult.NotSureOne;
        id?: string | number | Array<string | number>;
        where?: Partial<L> | Array<Partial<L>>;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        mode?: SelectMode;
        error?: string;
        columns?: (keyof L)[];
    }): Promise<L | null>;
    template<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        templateResult: TemplateResult.Many;
        id?: string | number | Array<string | number>;
        where?: Partial<L> | Array<Partial<L>>;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        mode?: SelectMode;
        error?: string;
        columns?: (keyof L)[];
    }): L[];
    template<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        templateResult: TemplateResult.Many;
        id?: string | number | Array<string | number>;
        where?: Partial<L> | Array<Partial<L>>;
        skipUndefined?: boolean;
        skipNull?: boolean;
        skipEmptyString?: boolean;
        mode?: SelectMode;
        error?: string;
        columns?: (keyof L)[];
    }): Promise<L[]>;
    private _select;
    /**
    # 自由查询
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. `templateResult`: 返回值类型断言，6种, R表示行，C表示列，带S表示复数
        1. R_C_Assert,
        2. R_C_NotSure,
        3. R_CS_Assert,
        4. R_CS_NotSure,
        5. RS_C,
        7. RS_CS[默认]
    2. `sql` 或者 `sqlid`
    3. `params`
    4. `defValue`: One_Row_One_Column 时有效
    5. 禁止一次查询多个语句
    6. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    7. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    9.  `dao`: 永远不需要传入该值
    10. `hump`: 是否将列名改为驼峰写法？默认情况下按照全局配置
    11. `mapper`: 列名-属性 映射工具，优先级高于hump
     ```
     //    该属性支持传入mybatis.xml中定义的resultMap块ID，或者读取sqlMapDir目录下的JSON文件.
     //    注意：resultMap块ID与sql语句逻辑一致，同样是 目录.ID
     //    或者自定义Mapper,自定义Mapper格式如下:
     [
     {columnName: 'dit_id', mapNames: ['DTID'], def: 0, convert: 转换函数},  // 列名ditid,对应属性DTID,如果没有值，将返回默认值0,其中默认值0是可选的
     {columnName: 'event_id', mapNames: ['eventMainInfo', 'id'], def: 0,  convert: 转换函数},// 列名event_id对应属性eventMainInfo.id,这种方式将返回嵌套的json对象,其中默认值是可选的
     ]
     12. dataConvert 数据转换器
     ```
     dataConvert: {
         fileName: 'qiniu'
     }
         // 表示列 fileName 按 qiniu的函数格式化
         // qiniu 在项目初始化时定义
     ```
     */
    select<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        selectResult?: SelectResult.RS_CS | SelectResult.RS_C;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        isCount?: boolean;
        defValue?: L | null;
        errorMsg?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<L[]>;
    select<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        isCount?: boolean;
        defValue?: L | null;
        errorMsg?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<L>;
    select<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        isCount?: boolean;
        defValue?: L | null;
        errorMsg?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<L | null>;
    select<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult?: SelectResult.RS_CS | SelectResult.RS_C;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        isCount?: boolean;
        defValue?: L | null;
        errorMsg?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): L[];
    select<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        isCount?: boolean;
        defValue?: L | null;
        errorMsg?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): L;
    select<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        isCount?: boolean;
        defValue?: L | null;
        errorMsg?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): L | null;
    /**
    # 自由查询:一次执行多个SQL语句!
    0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
    1. `sql` 或者 `sqlid`
    2. `params`
    3. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
    4. `conn`: 仅在开启事务时需要主动传入,传入示例:
        ```
            service.transaction(async conn => {
                service.insert({conn});
            });
        ```
    5.  `dao`: 永远不需要传入该值
    6. `hump`: 是否将列名改为驼峰写法？默认情况下按照全局配置
    7. `mapper`: 列名-属性 映射工具，优先级高于hump
     ```
     //    该属性支持传入mybatis.xml中定义的resultMap块ID，或者读取sqlMapDir目录下的JSON文件(暂未实现).
     //    注意：resultMap块的寻找逻辑与sql语句逻辑一致，同样是 文件名.ID
     //    或者自定义Mapper,自定义Mapper格式如下:
     [
        // 数据列名ditid将转换为属性`DTID`,如果没有值，将返回默认值0,其中默认值0是可选的
        {columnName: 'dit_id', mapNames: ['DTID'], def?: 0, convert: 转换函数},
        // 数据列名event_id将转换为属性`eventMainInfo.id`,这种方式将返回嵌套的json对象,其中默认值0是可选的
        {columnName: 'event_id', mapNames: ['eventMainInfo', 'id'], def?: 0,  convert: 转换函数},
     ]
     ```
     8. `dataConvert` 数据转换器
     ```
     dataConvert: {
         fileName: 'qiniu'
     }
    // 表示列 fileName 按 qiniu的函数格式化
    // qiniu 在开始时定义
     ```
     */
    selectBatch<T extends any[] = []>(option: MethodOption & {
        sync?: SyncMode.Async;
        selectResult?: SelectResult.RS_CS | SelectResult.RS_C;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<{
        [K in keyof T]: T[K][];
    }>;
    selectBatch<T extends any[] = []>(option: MethodOption & {
        sync?: SyncMode.Async;
        selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<{
        [K in keyof T]: T[K];
    }>;
    selectBatch<T extends any[] = []>(option: MethodOption & {
        sync?: SyncMode.Async;
        selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<{
        [K in keyof T]: T[K] | null;
    }>;
    selectBatch<T extends any[] = []>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult?: SelectResult.RS_CS | SelectResult.RS_C;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): {
        [K in keyof T]: T[K][];
    };
    selectBatch<T extends any[] = []>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult: SelectResult.R_CS_Assert | SelectResult.R_C_Assert;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): {
        [K in keyof T]: T[K];
    };
    selectBatch<T extends any[] = []>(option: MethodOption & {
        sync: SyncMode.Sync;
        selectResult: SelectResult.R_CS_NotSure | SelectResult.R_C_NotSure;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): {
        [K in keyof T]: T[K] | null;
    };
    /**
     # 自由执行sql
     0. `sync`: 同步（sqlite）或者异步（mysql、remote），影响返回值类型,默认`异步模式`
     1. `sql` 或者 `sqlid`
     2. `params`
     3. `dbName`: 默认使用service注解的`dbName`,可以在某个方法中覆盖
     4. `conn`: 仅在开启事务时需要主动传入,传入示例:
         ```
             service.transaction(async conn => {
                 service.insert({conn});
             });
         ```
     5.  `dao`: 永远不需要传入该值
     
      */
    excute<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
    }): Promise<number>;
    excute<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        sqlId?: string;
        sql?: string;
        params?: Record<string, any>;
        context?: any;
    }): number;
    /**
     ### 开启事务
     ### 这里面的所有数据方法，都必须传递CONN，否则会引起
     # 死锁
     ### 举例说明：
     #### 假设有两条代码，都操作同一个表A，其中代码1传了conn，但代码2没有传
     #### 代码1：插入数据，代码2：更新数据
     #### 二者操作的是不同的数据
     #### 以上为前提，开始分析：
     ** 当事务打开后，会创建一个连接1，开始执行代码1
     ** 代码1执行完毕，由于`transaction`方法尚未结束，所以不会提交事务。
     ** 代码1是插入数据，因此会导致全表锁
     ** 代码2开始执行，由于没有传入conn，所以会创建一个新的连接2
     ** 代码2执行时，会等待连接1的锁释放
     ** 但是连接1的锁是在`transaction`方法执行完后才会提交并释放锁，这导致死循环，开启死锁
     **
     */
    transaction<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        fn: (conn: Connection) => Promise<L>;
    }): Promise<L | null>;
    transaction<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        fn: (conn: Connection) => L;
    }): L | null;
    stream<L extends object = T>(): StreamQuery<L>;
    page<L = T>(option: MethodOption & {
        sync?: SyncMode.Async;
        sqlId: string;
        context?: any;
        params: Record<string, any>;
        pageSize?: number;
        pageNumber?: number;
        limitSelf?: boolean;
        countSelf?: boolean;
        sum?: boolean;
        sumSelf?: boolean;
        sortName?: string;
        sortType?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): Promise<PageQuery<L>>;
    page<L = T>(option: MethodOption & {
        sync: SyncMode.Sync;
        sqlId: string;
        context?: any;
        params: Record<string, any>;
        pageSize?: number;
        pageNumber?: number;
        limitSelf?: boolean;
        countSelf?: boolean;
        sum?: boolean;
        sumSelf?: boolean;
        sortName?: string;
        sortType?: string;
        hump?: boolean;
        mapper?: string | SqlMapper;
        mapperIfUndefined?: MapperIfUndefined;
        dataConvert?: Record<string, string>;
    }): PageQuery<L>;
    /**
     * 导出数据，可以为EJS-EXCEL直接使用
     * @param list
     * @returns
     */
    exp<L = T>(list: L[]): {
        title: string | undefined;
        titleSpan: string;
        columnTitles: string[];
        datas: any[][];
    };
    /**
     * 导入数据的模板
     * @returns
     */
    imp(): {
        title: string | undefined;
        titleSpan: string;
        columnTitles: string[];
    };
    /**
     * 初始化表结构
     * 只有sqlite、sqliteremote需要
     * force: 是否强制，默认false, 强制时会删除再创建
     * @param option
     */
    init(option?: MethodOption & {
        sync?: SyncMode.Async;
        force?: boolean;
    }): Promise<void>;
    init(option: MethodOption & {
        sync: SyncMode.Sync;
        force?: boolean;
    }): void;
    close(option?: MethodOption & {
        sync?: SyncMode.Async;
    }): Promise<void>;
    close(option: MethodOption & {
        sync: SyncMode.Sync;
    }): void;
    /**
    #创建表
    ** `tableName` 表名称
    ** `temp` 是否是临时表，默认true
    ** `columns` 字符串数组，默认是当前实体类全部字段，通过`columns` 可以创建部分字段临时表
    ** `id` 表的主键设置 4种：
    1. `auto`: `columns`中已经在当前实体类配置的ID作为主键 `默认`
    2. `all`: `columns`中所有字段全部当主键
    3. `none`: 没有主键
    4. 自定义字段名称：字符串数组
    ** `index` 表的索引，设置方式同ID
     */
    private _createTable;
    private _matchSqlid;
    private _setParam;
    private _generSql;
}
