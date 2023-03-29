import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {utils} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';
import {EthProviderFactoryType} from "../uniswap.providers";
import {Timeout} from '@nestjs/schedule';
import * as process from "process";
import {WebSocketProvider} from "@ethersproject/providers";

@Injectable()
export class ScanReservesCommand {
    iface: Interface;

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType
    ) {

        const swapInterface = [
            'event Sync(uint112 reserve0, uint112 reserve1)'
        ];

        this.iface = new utils.Interface(swapInterface);
    }

    @Timeout(5000)
    async cron() {
        //if (process.env.NODE_ENV == 'production')
        //    await this.create('chainstack');
    }

    @Command({
        command: 'scan:reserves <providerName>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
    ) {
        const provider = this.providers('ws', this.envService.get('ETH_HOST'), providerName);
        const providers = [provider];
        const startWork = new Date();
        let lastBlock: number = await new Promise(done => this.redisPublisherClient.get('lastBlock', (err, reply) => {
            const number = parseInt(reply);
            if (number) {
                return done(number);
            }
            done(0);
        }));

        console.log('lastBlock', lastBlock);
        let liveCount = 0;
        let lastProcessBlock = 0;
        let currentBlock = await provider.getBlockNumber();
        let isSyncOld = false;

        const processLogs = (blockNumber, logs, timeStart) => {
            const startSave = new Date().getTime();
            liveCount++;

            let pairs = {};
            for (const event of logs) {
                try {
                    const result = this.iface.decodeEventLog('Sync', event.data, event.topics);
                    pairs[event.address.toLowerCase()] = result;
                } catch (e) {

                }
            }
            Promise.all(Object.entries(pairs).map(([pairAddress, result]) => {
                return new Promise(async (done) => {
                    let pairData: any = await new Promise((fetch) => this.redisPublisherClient.get('pair_' + pairAddress, (err, reply) => {
                        if (reply) {
                            const data = JSON.parse(reply);
                            if (data) {
                                fetch(data)
                            }
                        }
                        fetch(null);
                    }));
                    if (!pairData || !pairData.address) {
                        const pair = await this.pairRepository.findOne({
                            where: {
                                address: pairAddress
                            }
                        });
                        if (pair && pair.fee) {
                            pairData = pair.toJSON();
                        }
                    }
                    if (pairData) {
                        pairData = {
                            ...pairData,
                            blockNumber,
                            reserve0: result[0].toString(),
                            reserve1: result[1].toString(),
                        };
                        //await this.pairRepository.save(pair);
                        await new Promise((save) => this.redisPublisherClient.set('pair_' + pairData.token0 + '_' + pairData.token1, JSON.stringify(pairData), save));
                        await new Promise((save) => this.redisPublisherClient.set('pair_' + pairData.address, JSON.stringify(pairData), save));
                    }
                    done(true);
                });

            })).then(() => {
                const data = JSON.stringify({
                    pairs,
                    blockNumber,
                    liveCount,
                    timeStart
                });
                this.redisPublisherClient.publish('pairs', data, () => {
                    console.log('save', ((new Date().getTime() - startSave) / 1000) + ' sec');
                    console.log('sync time, blockNumber: ' + blockNumber + '; pairs: ' + Object.keys(pairs).length + '; ' + (new Date().getTime() - timeStart.getTime()) / 1000 + ' sec');
                });
                this.redisPublisherClient.set('lastBlock', blockNumber);
            })
        }

        new Promise(async () => {
            if (lastBlock > 0)
                for (let blockNumber = lastBlock; blockNumber <= currentBlock; blockNumber++) {
                    const logs = await Promise.any(providers.map(provider => provider.getLogs({
                        fromBlock: blockNumber,
                        toBlock: blockNumber
                    })));
                    processLogs(blockNumber, logs, new Date());
                }
            isSyncOld = true;
            console.log('SYNC OK');
        });

        const forceLogs = false;

        const processBlock = (blockNumber: number, timeStart: Date) => {
            lastProcessBlock = blockNumber;
            try {
                new Promise(async (done) => {
                    let attempt = 0;
                    while (attempt <= 10) {
                        attempt++;
                        try {
                            const logs = await Promise.any(providers.map(provider => provider.getLogs({
                                fromBlock: blockNumber,
                                toBlock: blockNumber
                            })));
                            if (!logs || !logs.length) {
                                console.log('attems', attempt);
                                continue;
                            }
                            if (blockNumber > lastBlock) {
                                if (blockNumber === lastBlock + 1) {
                                    //liveCount++;
                                } else {
                                    liveCount = 1;
                                }
                            }
                            attempt = 0;
                            console.log('fetch logs [' + blockNumber + '] count: ' + logs.length + ', attempt: ' + attempt);
                            if (forceLogs || blockNumber > lastBlock) {
                                processLogs(blockNumber, logs, timeStart);
                            }
                            lastBlock = blockNumber;
                        } catch (e) {
                            console.log(e);
                            continue;
                        }

                        break;
                    }
                    return done(true);
                });

            } catch (e) {
                console.log('getLogs error2', e.toString());
            }
        };
        this.redisPublisherClient.del('reserves');
        try {
            provider.on("block", (blockNumber) => {
                currentBlock = blockNumber;
                const timeStart = new Date();
                const used = process.memoryUsage().heapUsed / 1024 / 1024;
                console.log(timeStart, ' --------- new block [' + blockNumber + '] live blocks: ' + liveCount,
                    ' live work: ' + ((new Date().getTime() - startWork.getTime()) / 1000) + ' sec', `memory ${Math.round(used * 100) / 100} MB`);
                if (blockNumber > lastProcessBlock && isSyncOld)
                    processBlock(blockNumber, timeStart)
            });
        } catch (e) {
            console.log('wsProvider error', e.toString());
        }
        console.log('listening...');
    }


}
