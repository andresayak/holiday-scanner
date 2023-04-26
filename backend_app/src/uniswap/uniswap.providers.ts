import {Connection} from 'typeorm';
import {TransactionEntity} from "./entities/transaction.entity";
import {EnvService} from '../env/env.service';
import {PairEntity} from "./entities/pair.entity";
import {TokenEntity} from "./entities/token.entity";
import {RedisClient} from 'redis';
import {ethers} from "ethers";
import {RouterEntity} from "./entities/router.entity";
import {PeerEntity} from "./entities/peer.entity";

export type EthProviderFactoryType = (type: 'ws' | 'http', network?: string, provider?: string)
    => (ethers.providers.JsonRpcProvider | ethers.providers.WebSocketProvider);

export type EthWebsocketProviderFactoryType = (network?: string, provider?: string)
    => (ethers.providers.WebSocketProvider);

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
        provide: 'PEER_REPOSITORY',
        useFactory: (connection: Connection) => connection.getRepository(PeerEntity),
        inject: ['DATABASE_CONNECTION'],
    },
    {
        provide: 'ROUTER_REPOSITORY',
        useFactory: (connection: Connection) => connection.getRepository(RouterEntity),
        inject: ['DATABASE_CONNECTION'],
    },
    {
        provide: 'ETH_WS_PROVIDER_FACTORY',
        useFactory: (envService: EnvService): EthWebsocketProviderFactoryType => {
            return (network?: string, provider?: string) => {
                network = network?network:envService.get('ETH_NETWORK');
                if (network === 'bsc_mainnet') {
                    let url;
                    if(provider == 'ankr'){
                        url = 'wss://rpc.ankr.com/bsc/ws/' + envService.get('ANKR_PROVIDER_KEY');
                    }else if(provider == 'quiknode') {
                        url = 'wss://frequent-purple-fire.bsc.discover.quiknode.pro/' + envService.get('QUIKNODE_KEY');
                    }else if(provider == 'node') {
                        url = 'ws://65.21.195.47:8545';
                    }else if(provider == 'node2'){
                        url = 'ws://host:58545';
                    }else if(provider == 'chainstack'){
                        url = envService.get("CHAINSTACK_WS_URL");
                    }else if(provider == 'nodereal'){
                        url = envService.get("NODEREAL_WS_URL");
                    }else if(provider == 'getblock'){
                        url = envService.get("GETBLOCK_WS_URL");
                    }else if(provider == 'blockvision'){
                        url = envService.get("GETBLOCK_WS_URL");
                    }else if(provider == 'zeeve'){
                        url = envService.get("ZEEVE_WS_URL");
                    }else{
                        url = provider;
                    }
                    console.log('PROVIDER: '+url);
                    return new ethers.providers.WebSocketProvider(url, 56);
                }
                if (network === 'local') {
                    const url = 'ws://host:8545';
                    console.log('PROVIDER: '+url);
                    return new ethers.providers.WebSocketProvider(url);
                }
                if (network === 'hardhat') {
                    const url = 'ws://hardhat:8545';
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
            return (network?: string, provider?: string) => {
                network = network?network:envService.get('ETH_NETWORK');
                if (network === 'bsc_mainnet') {
                    let url;
                    if(provider == 'ankr') {
                        url = 'https://rpc.ankr.com/bsc/' + envService.get('ANKR_PROVIDER_KEY');
                    }else if(provider == 'quiknode'){
                        url = 'https://frequent-purple-fire.bsc.discover.quiknode.pro/' + envService.get('QUIKNODE_KEY');
                    }else if(provider == 'node'){
                        url = 'http://65.21.195.47:8545';
                    }else if(provider == 'node2'){
                        url = 'http://host:58545';
                    }else if(provider == 'chainstack'){
                        url = envService.get("CHAINSTACK_HTTP_URL");
                    }else if(provider == 'nodereal'){
                        url = envService.get("NODEREAL_HTTP_URL");
                    }else if(provider == 'getblock'){
                        url = envService.get("GETBLOCK_HTTP_URL");
                    }else if(provider == 'blockvision'){
                        url = envService.get("BLOCKVISION_HTTP_URL");
                    }else if(provider == 'zeeve'){
                        url = envService.get("ZEEVE_HTTP_URL");
                    }else{
                        url = provider;
                    }

                    console.log('PROVIDER: '+url);
                    return new ethers.providers.JsonRpcProvider(url, 56);
                }
                if (network === 'local') {
                    const url = 'http://host:8545';
                    console.log('PROVIDER: '+url);
                    return new ethers.providers.JsonRpcProvider(url);
                }
                if (network === 'hardhat') {
                    const url = 'http://hardhat:8545';
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
            return (type: 'ws' | 'http', network?: string, provider?: string) => {
                if(type === 'ws'){
                    return wsFactory(network, provider);
                }else{
                    return httpFactory(network, provider);
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
