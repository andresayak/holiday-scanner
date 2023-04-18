import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {BigNumber, ethers, Wallet} from 'ethers';
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
import axios from "axios";

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

        //const response = await axios.get('https://explorer.48.club/api/v1/puissant/0xd693ca98575e4b83b6dce120e7cbabb6');

        //console.log('data', response.data);
        //return;
        let send = false;
        const wsProvider1 = this.providers('ws', this.envService.get('ETH_NETWORK'), providerName);
        const jsonProvider1 = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);

        let wallet = new Wallet(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(jsonProvider1);
        console.log('wallet: '+wallet.address);
        let chainId = 56;
        let nonce = await wallet.getTransactionCount();
        let invalidCount = 0;
        let successCount = 0;
        let total = 0;
        const processPending = (txHash: string | TransactionResponse, providerName: string) => {
            total++;
            //console.log('txHash', txHash);
            if (typeof txHash == 'string') {
                this.processingTransactions[txHash] = setTimeout(() => {
                    invalidCount++;
                    stat();
                }, 5000);
                Promise.any([jsonProvider1].map((provider, index) => {
                    return provider.getTransaction(txHash).then((target: TransactionResponse) => {
                        clearTimeout(this.processingTransactions[txHash]);
                        if(target){
                            processTxHash(txHash, target);
                        }else{
                            invalidCount++;
                        }
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
                invalidCount = 0;
                successCount = 0;
                total = 0;
            }
        }
        const amountMinProfit = ethers.utils.parseEther('1').mul(1).div(300);// 1 $

        const processTxHash = async (hash: string, tx: TransactionResponse) => {
            successCount++;
            stat();

            if(send){
                return;
            }
            send = true;
            const transaction = {
                nonce: tx.nonce,
                gasPrice: tx.gasPrice,
                gasLimit: tx.gasLimit,
                to: tx.to,
                value: BigNumber.from(tx.value),
                data: tx.data,
                chainId
            };
            console.log('transaction', transaction);
            const signedTargetTx = ethers.utils.serializeTransaction(transaction, {
                v: tx.v,
                r: tx.r,
                s: tx.s,
            });

            const emptyTx: any = {
                nonce: nonce,
                gasLimit: BigNumber.from('21000'),
                gasPrice: BigNumber.from('60000000000'),
                to: wallet.address,
                value: BigNumber.from('0'),
                chainId
            };

            console.log('emptyTx', emptyTx);

            /*const emptyTxHash = ethers.utils.keccak256(ethers.utils.RLP.encode([
                emptyTx.nonce,
                emptyTx.gasPrice,
                emptyTx.gasLimit,
                emptyTx.to,
                emptyTx.value,
                emptyTx.data,
                emptyTx.chainId,
                0,
                0
            ]));*/

            //console.log('emptyTx', emptyTxHash);
            const signedEmptyTx = await wallet.signTransaction(emptyTx);

            const empty2Tx: any = {
                nonce: nonce + 1,
                gasLimit: BigNumber.from('21000'),
                gasPrice: transaction.gasPrice,
                to: wallet.address,
                value: BigNumber.from('0'),
                chainId
            };
            console.log('empty2Tx', empty2Tx);
            /*const empty2TxHash = ethers.utils.keccak256(ethers.utils.RLP.encode([
                empty2Tx.nonce,
                empty2Tx.gasPrice,
                empty2Tx.gasLimit,
                empty2Tx.to,
                empty2Tx.value,
                empty2Tx.data,
                empty2Tx.chainId,
                0,
                0
            ]));
            console.log('empty2Tx', empty2TxHash);*/
            const signedEmpty2Tx = await wallet.signTransaction(empty2Tx);

            console.log('txs', [
                signedEmptyTx,
                signedTargetTx,
                signedEmpty2Tx
            ]);

            const {data} = await axios.post('https://puissant-bsc.48.club', {
                id: new Date().getTime(),
                jsonrpc: '2.0',
                method: 'eth_sendPuissant',
                params: [
                    {
                        txs: [
                            signedEmptyTx,
                            signedTargetTx,
                            signedEmpty2Tx
                        ],
                        maxTimestamp: Math.ceil((new Date().getTime()) / 1000) + 30,
                        acceptRevert: []
                    }

                ]
            });
            console.log('target' ,tx);
            console.log('data', data);
            setTimeout(async ()=>{
                const response = await axios.get('https://explorer.48.club/api/v1/puissant/'+data.result);

                console.log('response', response.data);
                process.exit(1);
            }, 10*1000)

            return;
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
