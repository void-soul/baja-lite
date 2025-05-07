import { DBType, Field, SqlType } from 'baja-lite-field';
import 'reflect-metadata';
import { Boot } from './boot.js';
import { ColumnMode, DB, SelectResult, SqlService, } from './sql.js';
class AmaFuck2 {
    @Field({ type: SqlType.int, length: 200, id: true, uuid: true })
    userid?: number;
    @Field({ type: SqlType.varchar, length: 200, def: '333' })
    username?: string;
    @Field({ type: SqlType.varchar, length: 200 })
    pwd?: string;
}

@DB({
    tableName: 'nfc_user', clz: AmaFuck2, dbType: DBType.Postgresql
})
class AmaService2 extends SqlService<AmaFuck2> {

}

// interface Menu {
//     resourceid: string;
//     resourcepid: string;
//     resourcename: string;
//     children: Menu[];
// }

export async function go2() {
    await Boot({
        Postgresql: {
            database: 'nfc',
            user: 'postgres',
            password: 'abcd1234',
            port: 5432,
            host: '127.0.0.1'
        },
        log: 'info',
        columnMode: ColumnMode.HUMP,
        sqlDir: 'E:/pro/baja-lite/xml',
        sqlMap: {
            ['test.test']: `SELECT * FROM nfc_user {{#username}} WHERE username = :username {{/username}}`
        }
    });
    const service = new AmaService2();
    await service.transaction<number>({
        fn: async conn => {
            const rt5 = await service.select<{ username: string }>({
                sqlId: 'test.test',
                params: { username: '1111' },
                selectResult: SelectResult.RS_CS,
                conn
            })
            console.log(55, rt5.length);
            await service.insert({
                data: {
                    userid: 22,
                    username: '222',
                    pwd: '333'
                }
            })
            return 1;
        }
    });

    // const data = await service.select<Menu>({
    //     sql: 'SELECT resourceid, resourcepid,resourcename FROM cp_resource ',
    //     params: {
    //         site: '1234',
    //         matchInfo: { reportType: 'yyyy', id: '11' }
    //     },
    //     // mapper: [
    //     //     ['site', ['info', 'bSist'], 989],
    //     //     ['site', ['info2', 'bSist'], 33],
    //     //     ['site', ['Bsite'], 0]
    //     // ]
    // });
    // console.log(data);

}
go2();
