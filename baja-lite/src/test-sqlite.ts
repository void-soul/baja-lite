import { DBType, Field, SqlType } from 'baja-lite-field';
import 'reflect-metadata';
import { Boot } from './boot';
import { DB, DeleteMode, InsertMode, SqlService, SyncMode } from './sql';
class AmaFuck {
    @Field({ type: SqlType.varchar })
    site?: string;
    @Field({ type: SqlType.varchar })
    SellerSKU2?: string;
    @Field({ type: SqlType.varchar, id: true })
    SellerSKU?: string;
}

@DB({
    tableName: 'ama_fuck2', clz: AmaFuck, dbType: DBType.Sqlite, sqliteVersion: '0.0.3'
})
class AmaService extends SqlService<AmaFuck> {

}
async function go() {
    await Boot({
        Sqlite: 'd:1.db',
        log: 'info'
    });
    const service = new AmaService();
    const ret = service.transaction<number>({
        sync: SyncMode.Sync,
        fn: conn => {
            const list = new Array<AmaFuck>({
                SellerSKU: '1',
                site: '111'
            }, {
                SellerSKU: '2',
                SellerSKU2: '22',
            }, {
                SellerSKU2: '33',
                SellerSKU: '3',
                site: '333'
            }, {
                SellerSKU2: '44',
                SellerSKU: '4',
                site: '444'
            }, {
                SellerSKU2: '',
                SellerSKU: '66',
                site: undefined
            });
            const rt = service.insert({
                sync: SyncMode.Sync,
                data: list,
                conn, skipEmptyString: false, mode: InsertMode.InsertWithTempTable
            });
            console.log(rt);
            const rt2 = service.update({
                sync: SyncMode.Sync,
                data: list,
                conn, skipEmptyString: false
            });
            console.log(rt2);
            const rt3 = service.delete({
                sync: SyncMode.Sync,
                where: [
                    { SellerSKU2: '11', SellerSKU: '1' },
                    { SellerSKU2: '22', SellerSKU: '2' },
                    { SellerSKU2: '33', SellerSKU: '3' }
                ],
                mode: DeleteMode.TempTable
            });
            console.log(rt3);
            return 1;
        }
    });
    return ret;
}





go();
