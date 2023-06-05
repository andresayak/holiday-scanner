import {createConnection} from 'typeorm';
import {extractor} from './../ormconfig';
import {EnvService} from "../env/env.service";

export const databaseProviders = [
    {
        provide: 'DATABASE_CONNECTION',
        useFactory: async (envService: EnvService) => {
            const connectionOptions = extractor({
                DATABASE_TYPE: envService.get('DATABASE_TYPE'),
                DATABASE_HOST: envService.get('DATABASE_HOST'),
                DATABASE_PORT: envService.get('DATABASE_PORT'),
                DATABASE_USER: envService.get('DATABASE_USER'),
                DATABASE_PASSWORD: envService.get('DATABASE_PASSWORD'),
                DATABASE_NAME: envService.get('DATABASE_NAME'),
            });
            return await createConnection(connectionOptions);
        },
        inject: [EnvService]
    },
];
