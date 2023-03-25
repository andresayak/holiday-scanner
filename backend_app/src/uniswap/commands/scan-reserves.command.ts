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
        //await this.create('node2', 'node2');
    }

    @Command({
        command: 'scan:reserves <provider1Name> <provider2Name>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'provider1Name',
            type: 'string'
        })
            provider1Name: string,
        @Positional({
            name: 'provider2Name',
            type: 'string'
        })
            provider2Name: string,
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
                return new Promise(async (done)=>{
                    const pair = await this.pairRepository.findOne({
                        where: {
                            address: pairAddress
                        }
                    });
                    if(pair && pair.fee){
                        pair.fill({
                            blockNumber,
                            reserve0: result[0].toString(),
                            reserve1: result[1].toString(),
                        })
                        await this.pairRepository.save(pair);
                        await new Promise((save)=>this.redisPublisherClient.set('pair_'+pair.token0+'_'+pair.token1, JSON.stringify(pair), save));
                    }
                    done(true);
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
        const wsProvider = this.providers('ws', this.envService.get('ETH_HOST'), provider1Name);
        const provider = this.providers('http', this.envService.get('ETH_HOST'), provider2Name);
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
                            try {
                                const logs = await Promise.race([provider.getLogs({
                                    fromBlock: blockNumber,
                                    toBlock: blockNumber
                                })]);
                                if (!logs || !logs.length) {
                                    console.log('attems', attempt);
                                    continue;
                                }
                                if (blockNumber > lastBlock) {
                                    console.log('blockNumber', blockNumber, lastBlock + 1, blockNumber === lastBlock + 1);
                                    if (blockNumber === lastBlock + 1) {
                                        //liveCount++;
                                    } else {
                                        liveCount = 1;
                                    }
                                }
                                console.log('fetch logs [' + blockNumber + '] count: ' + logs.length + ', attempt: ' + attempt);
                                if (forceLogs || blockNumber > lastBlock) {
                                    processLogs(blockNumber, logs, timeStart);
                                }
                                lastBlock = blockNumber;
                            }catch (e) {
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
            });
        } catch (e) {
            console.log('wsProvider error', e.toString());
        }
        console.log('listening...');
    }
}
