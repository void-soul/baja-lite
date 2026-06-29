import { DBType } from 'baja-lite-field';
import { mysql, postgresql, sqlite } from 'sql-formatter';

export const formatDialects = {
    [DBType.Mysql]: mysql,
    [DBType.Sqlite]: sqlite,
    [DBType.SqliteRemote]: sqlite,
    [DBType.Postgresql]: postgresql,
};
