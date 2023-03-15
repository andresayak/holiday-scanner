import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, ethers, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import * as colors from 'colors';
import {balanceHuman, calcProfit} from "../helpers/calc";
import * as MultiSwapAbi from "../../contracts/MultiSwap.json";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {processRouterTx} from './helpers/processRouterTx';
import {ContractTransaction} from "@ethersproject/contracts";
import {EthProviderFactoryType} from "../uniswap.providers";

const factories = {
    '0x10ED43C718714eb63d5aA57B78B54704E256024E': '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
    '0x0aC05Fc1B4381dc8026beAdeE77A5419463D29a8': '0x05df1c02c60Abb67c7f49fC1B22212512196211a',//local
};

const routerAddresses = [
    '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    '0x0aC05Fc1B4381dc8026beAdeE77A5419463D29a8',//local
];

@Injectable()
export class ScanSandwichCommand {
    lastVariants: any[] | null;
    lastPairs: PairEntity[] | null;
    lastBlock: number = 0;
    listeners: {
        variantsUpdate: ((variants: any[]) => void)[],
        pairsUpdate: ((pairs: any[]) => void)[],
    } = {
        variantsUpdate: [],
        pairsUpdate: [],
    };
    currentTransaction: TransactionResponse | null = null;

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_SUBSCRIBER_CLIENT')
                private readonly redisSubscriberClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'scan:sandwich <providerType> <isTestMode>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerType',
            type: 'string'
        })
            providerType: 'ws' | 'http' = 'ws',
        @Positional({
            name: 'isTestMode',
            type: 'boolean'
        })
            isTestMode: boolean = false,
    ) {

        if (this.envService.get('FACTORY_ADDRESS')) {
            routerAddresses.push(this.envService.get('ROUTER_ADDRESS'))
            factories[this.envService.get('ROUTER_ADDRESS')] = this.envService.get('FACTORY_ADDRESS');
        }

        const whitelist = (await this.tokenRepository.find()).map(token => token.address);

        const provider = this.providers(providerType);

        const multiSwapAddress = this.envService.get('MULTI_SWAP_ADDRESS');
        console.log('multiSwapAddress', multiSwapAddress);
        //let wallet = new Wallet(this.envService.get('ETH_PRIVATE_KEY'), provider);
        let wallet = Wallet.fromMnemonic(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(provider);
        const balance = await wallet.getBalance();
        console.log(' - account address: ' + wallet.address);
        console.log(' - account balance: ' + balanceHuman(balance));

        console.log('multiSwapAddress=', multiSwapAddress);

        const multiSwapContract = ContractFactory.getContract(multiSwapAddress, MultiSwapAbi.abi, wallet);

        const amountMaxIn = ethers.utils.parseEther('0.1');
        if(balance.lt(amountMaxIn)){
            console.log('not enough balance');
            return;
        }
        const amountMinProfit = ethers.utils.parseEther('1').mul(3).div(300);// 3 $
        provider.on("pending", (txHash) => {
            const timeStart = new Date();
            if(typeof txHash == 'string'){
                provider.getTransaction(txHash).then((target: TransactionResponse) => {
                    processTxHash(target, timeStart);
                });
            }else{
                processTxHash(txHash, timeStart);
            }
        });

        provider.on("block", (blockNumber) => {
            if (blockNumber > this.lastBlock) {
                const timeStart = new Date();
                console.log(timeStart, ' --------- new block [' + blockNumber + ']');
                this.listeners['pairsUpdate'].map((callback) => {
                    callback([]);
                });
                this.lastVariants = null;
                this.lastPairs = null;
                this.lastBlock = blockNumber;
            }
        });

        const processTxHash = (target: TransactionResponse, timeStart) => {
            if (target && target.from !== wallet.address && routerAddresses.includes(target.to)) {
                try {
                    processRouterTx({
                        amountMaxIn,
                        amountMinProfit,
                        profitMin: 1,
                        checkBeforeStart: (tx: ContractTransaction): boolean => {
                            if(isTestMode){
                                console.log('isTestMode ENABLED');
                                return false;
                            }
                            if (!this.currentTransaction) {
                                this.currentTransaction = tx;
                                return true;
                            }
                            return false;
                        },
                        callbackBuy: (tx: ContractTransaction) => {
                            console.log('Buy hash', tx.hash);
                            console.log('Buy after: ' + ((new Date().getTime() - timeStart.getTime()) / 1000) + ' sec');
                        },
                        callbackSell: (tx: ContractTransaction) => {
                            console.log('Sell hash', tx.hash);
                            console.log('Sell after: ' + ((new Date().getTime() - timeStart.getTime()) / 1000) + ' sec');
                            this.currentTransaction = null;
                        },
                        target,
                        timeStart,
                        whitelist,
                        factories,
                        multiSwapContract,
                        getPairs: () => this.getPairs()
                    }).then(result => {
                        console.log('result', result);

                        const buy = result['buy'].amountIn;
                        const sell = result['sell'].amountOut;

                        const buyGasCost = result['receiptBuy'].effectiveGasPrice.mul(result['receiptBuy'].gasUsed);
                        const sellGasCost = result['receiptSell'].effectiveGasPrice.mul(result['receiptSell'].gasUsed);
                        const gasCost = buyGasCost.add(sellGasCost);
                        console.log('gasCost=' + gasCost, balanceHuman(gasCost));

                        calcProfit(buy, sell);
                    }).catch(() => {
                        if (target == this.currentTransaction)
                            this.currentTransaction = null;
                    });
                } catch (e) {
                    console.log('ERROR');
                }

            } else {
                console.log(colors.grey('txHash'), colors.grey(target.hash));
            }
            //}).catch(error => {
            //    console.log('txHash', txHash, 'error', error);
            //});
        }

        this.redisSubscriberClient.subscribe('pairs');
        this.redisSubscriberClient.on('message', (channel, data) => {
            const json = JSON.parse(data);
            this.lastPairs = json.pairs;
            console.log('live pairs: ' + json.pairs.length);
            this.listeners['pairsUpdate'].map((callback) => {
                return callback(json.pairs);
            });
        });

        console.log('listening...');
    }

    async getVariants(): Promise<any[]> {
        if (!this.lastVariants) {
            return new Promise(done => {
                return this.listeners['variantsUpdate'].push(done);
            });
        }
        return this.lastVariants
    }

    async getPairs(): Promise<any[]> {
        /*if (!this.lastPairs) {
            return new Promise(done => {
                return this.listeners['pairsUpdate'].push(done);
            });
        }*/
        return this.lastPairs
    }
}
