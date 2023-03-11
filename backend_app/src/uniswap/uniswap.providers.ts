import {Connection} from 'typeorm';
import {TransactionEntity} from "./entities/transaction.entity";
import {EnvService} from '../env/env.service';
import {PairEntity} from "./entities/pair.entity";
import {TokenEntity} from "./entities/token.entity";
import {RedisClient} from 'redis';

export const providers = [
    {
        provide: 'TRANSACTION_REPOSITORY',
        useFactory: (connection: Connection) => connection.getRepository(TransactionEntity),
        inject: ['DATABASE_CONNECTION'],
    },
    {
        provide: 'PAIR_REPOSITORY',
        useFactory: (connection: Connection) => connection.getRepository(PairEntity),
        inject: ['DATABASE_CONNECTION'],
    },
    {
        provide: 'TOKEN_REPOSITORY',
        useFactory: (connection: Connection) => connection.getRepository(TokenEntity),
        inject: ['DATABASE_CONNECTION'],
    },
    {
        provide: 'REDIS_PUBLISHER_CLIENT',
        useFactory: async (envService: EnvService) => {
            return new RedisClient({
                host: envService.get('REDIS_HOST'),
                port: +envService.get('REDIS_PORT'),
                password: envService.get('REDIS_PASSWORD')
            });
        },
        inject: [EnvService]
    },
    {
        provide: 'REDIS_SUBSCRIBER_CLIENT',
        useFactory: async (envService: EnvService) => {
            console.log({
                host: envService.get('REDIS_SUBSCRIBER_HOST'),
                port: +envService.get('REDIS_SUBSCRIBER_PORT'),
                password: envService.get('REDIS_SUBSCRIBER_PASSWORD')
            });
            return new RedisClient({
                host: envService.get('REDIS_SUBSCRIBER_HOST'),
                port: +envService.get('REDIS_SUBSCRIBER_PORT'),
                password: envService.get('REDIS_SUBSCRIBER_PASSWORD')
            });
        },
        inject: [EnvService]
    },
];
