import {Command, Positional, Option} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {utils} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';
import {EthWebsocketProviderFactoryType} from "../uniswap.providers";
import * as process from "process";
import {TgBot} from "../TgBot";

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
                @Inject('ETH_WS_PROVIDER_FACTORY')
                private readonly providers: EthWebsocketProviderFactoryType,
                private readonly tgBot: TgBot,
    ) {

        const swapInterface = [
            'event Sync(uint112 reserve0, uint112 reserve1)'
        ];

        this.iface = new utils.Interface(swapInterface);
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
        @Option({
            name: 'force',
            type: 'boolean',
            default: false,
        })
            force: boolean,
    ) {
        let loop = 0;
        while (true) {
            loop++;
            const forceInLoop = (loop === 1) ? force : false;
            await new Promise(async (errorWebsocket) => {
                const provider = this.providers(this.envService.get('ETH_HOST'), providerName);
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
                console.log('currentBlock', currentBlock);
                let isSyncOld = false;
                if (forceInLoop) {
                    isSyncOld = true;
                    lastBlock = currentBlock;
                }
                const processLogs = (blockNumber, logs, timeStart) => {
                    const startSave = new Date().getTime();
                    liveCount++;

                    let pairs = {};
                    for (const event of logs) {
                        try {
                            const result = this.iface.decodeEventLog('Sync', event.data, event.topics);
                            pairs[event.address.toLowerCase()] = [
                                result[0].toString(),
                                result[1].toString(),
                            ];
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
                            if (!pairData || !pairData.address || !pairData.fee) {
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
                                    reserve0: result[0],
                                    reserve1: result[1],
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
                    if (lastBlock > 0 && forceInLoop === false)
                        for (let blockNumber = lastBlock; blockNumber <= currentBlock; blockNumber++) {
                            const logs = await provider.getLogs({
                                fromBlock: blockNumber,
                                toBlock: blockNumber
                            });
                            processLogs(blockNumber, logs, new Date());
                        }
                    isSyncOld = true;
                    console.log('SYNC OK');
                    this.tgBot.sendMessage('reserves sync completed');
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
                                    const logs = await provider.getLogs({
                                        fromBlock: blockNumber,
                                        toBlock: blockNumber
                                    });
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
                    provider._websocket.on('close', async (code) => {
                        console.log('websocket error', code);
                        this.tgBot.sendMessage('reserves websocket error, code=' + code);
                        errorWebsocket(true);
                    });
                } catch (e) {
                    console.log('wsProvider error', e.toString());
                }
                console.log('listening...');
            });
        }
    }
}
