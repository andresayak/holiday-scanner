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
import { Timeout } from '@nestjs/schedule';

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
    async cron(){
        await this.create('ankr');
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

        const startWork = new Date();
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

        const forceLogs = false;
        const wsProvider = this.providers('ws', this.envService.get('ETH_HOST'), providerName);
        const provider = this.providers('http', this.envService.get('ETH_HOST'), providerName);
        this.redisPublisherClient.del('reserves');
        try {
            wsProvider.on("block", (blockNumber) => {
                const timeStart = new Date();
                console.log(timeStart, ' --------- new block [' + blockNumber + '] live blocks: ' + liveCount,
                    ' live work: '+((new Date().getTime() - startWork.getTime())/1000)+' sec');
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
                                    //liveCount++;
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
