import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {utils} from 'ethers';
import {IsNull, Not, Repository} from "typeorm";
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

        const processLogs = (blockNumber, logs, timeStart) => {
            liveCount++;

            let pairs = {};
            for (const event of logs) {
                try {
                    const result = this.iface.decodeEventLog('Sync', event.data, event.topics);
                    pairs[event.address.toLowerCase()] = result;
                } catch (e) {

                }
            }
            Promise.all(Object.entries(pairs).map(([pairAddress, result])=>{
                return this.pairRepository.update({
                    address: pairAddress
                }, {
                    blockNumber,
                    reserve0: result[0].toString(),
                    reserve1: result[1].toString(),
                });
            })).then(()=>{
                const data = JSON.stringify({
                    pairs,
                    blockNumber,
                    liveCount,
                    timeStart
                });
                this.redisPublisherClient.publish('pairs', data, () => {
                    console.log('sync time, pairs: '+Object.keys(pairs).length+' / '+ (new Date().getTime() - timeStart.getTime()) / 1000 + ' sec');
                });
            })
        }

        const forceLogs = true;

        const provider = this.providers(providerType, this.envService.get('ETH_HOST'), 'node');
        this.redisPublisherClient.del('reserves');
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
        console.log('listening...');
    }
}
