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

    @Command({
        command: 'scan:reserves <providerType>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerType',
            type: 'string'
        })
            providerType: 'ws' | 'http' = 'ws',
    ) {

        let lastBlock = 0;
        let liveCount = 0;
        const processBlock = (pair, block, reserve0, reserve1) => {
            const blockNumber = block.blockNumber;
            const transactionIndex = block.transactionIndex;
            const logIndex = block.logIndex;
            if (!pair.blockNumber
                || (blockNumber > pair.blockNumber)
                || (blockNumber === pair.blockNumber
                    && transactionIndex > pair.transactionIndex
                )
                || (blockNumber === pair.blockNumber
                    && transactionIndex == pair.transactionIndex
                    && logIndex > pair.logIndex
                )
            ) {
                pair.blockNumber = blockNumber;
                pair.transactionIndex = transactionIndex;
                pair.logIndex = logIndex;
                pair.reserve0 = reserve0.toString();
                pair.reserve1 = reserve1.toString();
                //this.pairRepository.save(pair);
            }
        }

        const processLogs = (blockNumber, logs, timeStart) => {
            liveCount++;
            let count = 0;
            for (const event of logs) {
                try {
                    const result = this.iface.decodeEventLog('Sync', event.data, event.topics);
                    const pair = pairs.find(pair => pair.address === event.address.toLowerCase());
                    if (pair) {
                        processBlock(pair, event, result[0], result[1]);
                        count++;
                    }
                } catch (e) {

                }
            }

            const activePairs = pairs.filter(pair => pair.blockNumber).map((pair) =>
                ({...pair, reserve0: pair.reserve0.toString(), reserve1: pair.reserve1.toString()}));
            console.log('update pairs: ' + count + ', live pairs: ' + activePairs.length);

            const data = JSON.stringify({
                pairs: activePairs,
                blockNumber,
                liveCount,
                timeStart
            });
            this.redisPublisherClient.publish('pairs', data, () => {
                console.log('sync time', (new Date().getTime() - timeStart.getTime()) / 1000 + ' sec');
            });
        }

        const forceLogs = true;

        const pairs = await this.pairRepository.find({
            network: this.envService.get('ETH_NETWORK')
        });
        console.log('fetch ' + pairs.length + ' pairs');
        const provider = this.providers(providerType);

        try {
            provider.on("block", (blockNumber) => {
                const timeStart = new Date();
                console.log(timeStart, ' --------- new block [' + blockNumber + '] live blocks: ' + liveCount);
                try {
                    new Promise(async (done) => {
                        let attempt = 0;
                        while (true) {
                            attempt++;
                            const logs = await provider.getLogs({
                                fromBlock: blockNumber,
                                toBlock: blockNumber
                            });
                            if (!logs) {
                                console.log('attems', attempt);
                                continue;
                            }
                            if (blockNumber > lastBlock) {
                                if (blockNumber === lastBlock + 1) {
                                    liveCount++;
                                } else {
                                    liveCount = 1;
                                }
                            }
                            lastBlock = blockNumber;
                            console.log('fetch logs [' + blockNumber + '] count: ' + logs.length + ', attempt: ' + attempt);
                            if (forceLogs || blockNumber > lastBlock) {
                                processLogs(blockNumber, logs, timeStart);
                            }
                            break;
                        }
                        return done(true);
                    });

                } catch (e) {
                    console.log('getLogs error2', e.toString());
                }
            });
        } catch (e) {
            console.log('wsProvider error', e.toString());
        }
        /*

                try {
                    let currentBlock = await jsonProvider.getBlockNumber();
                    for (const pair of pairs) {
                        try {
                            currentBlock = Math.max(lastBlock, currentBlock);
                            const pairContract = ContractFactory.getContract(pair.address, pairAbi.abi, wsProvider);
                            const result = await pairContract.getReserves({blockTag: currentBlock});
                            processBlock(pair, {
                                blockNumber: currentBlock,
                                transactionIndex: 0,
                                logIndex: 0,
                            }, result[0], result[1]);
                        } catch (e) {
                            console.log('getReserves error', e.toString());
                        }
                    }
                } catch (e) {
                    console.log('e', e)
                }*/

        console.log('listening...');
    }
}
