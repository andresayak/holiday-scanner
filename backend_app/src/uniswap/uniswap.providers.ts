import {Connection} from 'typeorm';
import {TransactionEntity} from "./entities/transaction.entity";
import {EnvService} from '../env/env.service';
import {PairEntity} from "./entities/pair.entity";
import {TokenEntity} from "./entities/token.entity";
import {RedisClient} from 'redis';
import {ethers} from "ethers";

export type EthProviderFactoryType = (type: 'ws' | 'http', network?: string) => ethers.providers.BaseProvider;

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
        provide: 'ETH_WS_PROVIDER_FACTORY',
        useFactory: (envService: EnvService) => {
            return (network?: string) => {
                network = network?network:envService.get('ETH_NETWORK');
                if (network === 'bsc_mainnet') {
                    const url = 'wss://rpc.ankr.com/bsc/ws/' + envService.get('ANKR_PROVIDER_KEY');
                    console.log('PROVIDER: '+url);
                    return new ethers.providers.WebSocketProvider(url);
                }
                if (network === 'local') {
                    const url = 'ws://host:8545';
                    console.log('PROVIDER: '+url);
                    return new ethers.providers.WebSocketProvider(url);
                }
                throw Error('wrong network ['+network+']');
            }
        },
        inject: [EnvService]
    },
    {
        provide: 'ETH_JSON_PROVIDER_FACTORY',
        useFactory: (envService: EnvService) => {
            return (network?: string) => {
                network = network?network:envService.get('ETH_NETWORK');
                if (network === 'bsc_mainnet') {
                    const url = 'https://rpc.ankr.com/bsc/' + envService.get('ANKR_PROVIDER_KEY');
                    console.log('PROVIDER: '+url);
                    return new ethers.providers.JsonRpcProvider(url);
                }
                if (network === 'local') {
                    const url = 'http://host:8545';
                    console.log('PROVIDER: '+url);
                    return new ethers.providers.JsonRpcProvider(url);
                }
                throw Error('wrong network ['+network+']');
            }
        },
        inject: [EnvService]
    },
    {
        provide: 'ETH_PROVIDERS',
        useFactory: (httpFactory, wsFactory): EthProviderFactoryType => {
            return (type: 'ws' | 'http', network?: string) => {
                if(type === 'ws'){
                    return wsFactory(network);
                }else{
                    return httpFactory(network);
                }
            }
        },
        inject: ['ETH_JSON_PROVIDER_FACTORY', 'ETH_WS_PROVIDER_FACTORY']
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
            return new RedisClient({
                host: envService.get('REDIS_SUBSCRIBER_HOST'),
                port: +envService.get('REDIS_SUBSCRIBER_PORT'),
                password: envService.get('REDIS_SUBSCRIBER_PASSWORD')
            });
        },
        inject: [EnvService]
    },
];
