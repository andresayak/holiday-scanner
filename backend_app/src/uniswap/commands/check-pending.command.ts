import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ethers} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {EthProviderFactoryType} from "../uniswap.providers";
import {RouterEntity} from "../entities/router.entity";
import {TransactionEntity} from "../entities/transaction.entity";
import * as process from "process";

@Injectable()
export class CheckPendingCommand {
    lastBlock: number = 0;
    lastBlockTime: number = 0;
    processingTransactions: { [k: string]: any } = {};

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('TRANSACTION_REPOSITORY')
                private readonly transactionRepository: Repository<TransactionEntity>,
                @Inject('REDIS_SUBSCRIBER_CLIENT')
                private readonly redisSubscriberClient: RedisClient,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ROUTER_REPOSITORY')
                private readonly routerRepository: Repository<RouterEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType
    ) {
    }

    @Command({
        command: 'check:pending <providerName>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
    ) {
        const wsProvider1 = this.providers('ws', this.envService.get('ETH_NETWORK'), providerName);
        const jsonProvider1 = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);

        let invalidCount = 0;
        let successCount = 0;
        let total = 0;
        const processPending = (txHash: string | TransactionResponse, providerName: string) => {
            total++;
            if (typeof txHash == 'string') {
                this.processingTransactions[txHash] = setTimeout(() => {
                    invalidCount++;
                    stat();
                }, 5000);
                Promise.any([jsonProvider1].map((provider, index) => {
                    return provider.getTransaction(txHash).then((target: TransactionResponse) => {
                        clearTimeout(this.processingTransactions[txHash]);
                        processTxHash(txHash, target);
                    }).catch(error => {
                        console.log('error', error);
                    })
                }));
            } else {
                processTxHash(txHash.hash, txHash);
            }
        }
        const processBlock = (blockNumber: number, providerName: string) => {
            if (blockNumber > this.lastBlock) {
                const used = process.memoryUsage().heapUsed / 1024 / 1024;
                const timeStart = new Date();
                console.log('\n',timeStart.getTime(), ' --------- new block [' + blockNumber + '] ' + providerName, `memory ${Math.round(used * 100) / 100} MB`);
                this.lastBlock = blockNumber;
                this.lastBlockTime = timeStart.getTime();
            }
        }
        const amountMinProfit = ethers.utils.parseEther('1').mul(1).div(300);// 1 $

        const processTxHash = (hash: string, target: TransactionResponse) => {
            successCount++;
            stat();
        }

        const stat = ()=>{
            const wait = total - invalidCount - successCount;
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write('total: '+total+', '
                +'wait: '+wait+' ('+(Math.ceil(wait / total * 100))+'%), '
                +'invalid: '+invalidCount+' ('+(Math.ceil(invalidCount / total * 100))+'%), '
                +'success: '+successCount + '('+(Math.ceil(successCount / total * 100))+'%)');

        }
        wsProvider1.on("pending", (tx) => processPending(tx, 'provider1'));

        wsProvider1.on("block", (blockNumber) => processBlock(blockNumber, 'provider1'));

        console.log('listening...');
        this.redisSubscriberClient.subscribe('pairs');
    }
}
