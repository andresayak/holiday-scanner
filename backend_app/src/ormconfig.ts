import {join} from 'path';
import {ConnectionOptions} from 'typeorm';
import {EnvService} from './env/env.service';

const config = (new EnvService()).read();
const connectionOptions: ConnectionOptions = {
    type: config['DATABASE_TYPE'],
    host: config['DATABASE_HOST'],
    port: config['DATABASE_PORT'],
    username: config['DATABASE_USER'],
    password: config['DATABASE_PASSWORD'],
    database: config['DATABASE_NAME'],
    synchronize: false,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrationsTableName: 'custom_migration_table',
    migrations: [join(__dirname, 'database/migrations/*{.ts,.js}')],
    cli: {
        migrationsDir: 'src/database/migrations',
    },
    logging: config['DATABASE_LOGGING']
};

export default connectionOptions;
