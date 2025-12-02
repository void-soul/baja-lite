import { Field, SqlType } from 'baja-lite-field';
import 'reflect-metadata';
import { Boot } from './boot.js';
import { ColumnMode, DB, SelectResult, SqlService } from './sql.js';
class BaseAuditUser {
    /**
    *
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 32, id: true, notNull: true, uuidShort: true })
    auditId?: string;
    /**
    * 密码
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 32, comment: '密码' })
    password?: string;
    /**
    * 省
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 255, comment: '省' })
    userProvinceCode?: string;
    /**
    * 省
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 255, comment: '省' })
    userProvince?: string;
    /**
    * 显示名称
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 32, comment: '显示名称' })
    labelName?: string;
    /**
    * 备注名称
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 32, comment: '备注名称' })
    remarkName?: string;
    /**
    * 初始密码
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 32, comment: '初始密码' })
    upassword?: string;
    /**
    * 是否中心
    * @type { char }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.char, length: 1, def: 0, comment: '是否中心' })
    baseType?: string;
    /**
    * 
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 32 })
    userId?: string;
    /**
    * 
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 32 })
    companyId?: string;
    /**
    * 
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 32 })
    username?: string;
    /**
    * 状态
    * @type { char }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.char, length: 1, def: 0, comment: '状态' })
    userStatus?: string;
    /**
    * 账户分组
    * @type { char }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.char, length: 1, def: 0, comment: '账户分组' })
    groupId?: string;
    /**
    * 
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 10 })
    startDate?: string;
    /**
    * 
    * @type { varchar }
    * @memberof BaseAuditUser
    */
    @Field({ type: SqlType.varchar, length: 10 })
    endDate?: string;
}
@DB({ tableName: 'base_audit_user', clz: BaseAuditUser })
class BaseAuditUserService extends SqlService<BaseAuditUser> {
}
export async function go2() {
    await Boot({
        Mysql: {
            host: '127.0.0.1',
            port: 3306,
            user: 'root',
            password: 'abcd1234',
            // 数据库名
            database: 'sportevent',
            debug: false
        },
        log: 'verbose',
        columnMode: ColumnMode.HUMP,
        sqlDir: 'E:/pro/my-sdk/baja-lite/xml',
        sqlMap: {
            ['test.test']: `
            SELECT * FROM base_user {{#realname}} WHERE realname LIKE CONCAT(:realname, '%') {{/realname}};
            SELECT * FROM base_user {{#realname}} WHERE realname LIKE CONCAT(:realname, '%') {{/realname}};
            `
        }
    });
    const service = new BaseAuditUserService();
    const rt = await service.stream().eq('auditId', '100987125344341382').select('labelName').where('audit_id > 0').excuteSelect({selectResult:SelectResult.R_C_Assert});
    console.log(rt);
    // const list = await service.transaction<number>({
    //     fn: async conn => {
    //         await service.stream().eq('baseType', '0').in('auditId', ['162400829591265280', '162201628882247680']).excuteSelect();
    //         const data = await service.stream().in('auditId', ['162400829591265280', '162201628882247680']).update('labelName', '333').excuteUpdate({ conn });
    //         return data;
    //     }
    // });
    // console.log(11, list);
}
go2();
