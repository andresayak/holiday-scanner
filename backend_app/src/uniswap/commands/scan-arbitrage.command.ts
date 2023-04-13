import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, ethers, utils, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import {balanceHuman} from "../helpers/calc";
import {EthProviderFactoryType, EthWebsocketProviderFactoryType} from "../uniswap.providers";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {RouterEntity} from "../entities/router.entity";
import {PairsType} from "./helpers/getVariants";
import * as MultiSwapAbi from "../../contracts/MultiSwapV2.json";
import {calculate} from './helpers/arbitrage';
import {urls} from "../helpers/provider";
import {TgBot} from "../TgBot";
import {TransactionEntity} from '../entities/transaction.entity';

const swapInterface = [
    'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)',
    'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)',
    'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] calldata path,address to,uint deadline)',
    'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path,address to,uint deadline)',
    'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
    'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)',
    'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',

    'event Sync(uint112 reserve0, uint112 reserve1)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
];

const methods = ['swapExactETHForTokens', 'swapETHForExactTokens', 'swapExactETHForTokensSupportingFeeOnTransferTokens',
    'swapExactTokensForETHSupportingFeeOnTransferTokens', 'swapExactTokensForTokensSupportingFeeOnTransferTokens', 'swapExactTokensForTokens',
    'swapTokensForExactTokens', 'swapTokensForExactTokens', 'swapTokensForExactETH', 'swapExactTokensForETH',
];

const iface = new utils.Interface(swapInterface);

@Injectable()
export class ScanArbitrageCommand {
    startBlock: number;
    currentBlock: number = 0;
    lastBlockTime: number = 0;
    lastSyncBlock: number = 0;
    openTrading = false;
    pairs: PairEntity[] = [];
    transactions = [];
    blockUpdated: boolean;
    lastVariants: any[] | null;
    variants: any[] = [];
    lastPairs: PairsType | null;
    listeners: {
        variantsUpdate: ((variants: any[]) => void)[],
        pairsUpdate: ((pairs: any[]) => void)[],
    } = {
        variantsUpdate: [],
        pairsUpdate: [],
    };
    reservers: any = {};

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_SUBSCRIBER_CLIENT')
                private readonly redisSubscriberClient: RedisClient,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ROUTER_REPOSITORY')
                private readonly routerRepository: Repository<RouterEntity>,
                @Inject('TRANSACTION_REPOSITORY')
                private readonly transactionRepository: Repository<TransactionEntity>,
                private readonly tgBot: TgBot,
                @Inject('ETH_WS_PROVIDER_FACTORY')
                private readonly wsProviders: EthWebsocketProviderFactoryType,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'scan:arbitrage <isTestMode> <provider1Name> <amount0> <amount1>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'isTestMode',
            type: 'boolean'
        })
            isTestMode: boolean = false,
        @Positional({
            name: 'provider1Name',
            type: 'string'
        })
            provider1Name: string,
        @Positional({
            name: 'amount0',
            type: 'string'
        })
            amount0: string,
        @Positional({
            name: 'amount1',
            type: 'string'
        })
            amount1: string,
    ) {

        const routers = (await this.routerRepository.find());//.map((item)=>item.address.toLowerCase());
        const wsProvider = this.wsProviders(this.envService.get('ETH_NETWORK'), provider1Name);
        const provider = this.providers('http', this.envService.get('ETH_NETWORK'), provider1Name);
        const providerForSend = new ethers.providers.JsonRpcProvider(this.envService.get('CHAINSTACK_WARP_URL'), parseInt(this.envService.get('ETH_NETWORK_CHAIN_ID')));

        let wallet = Wallet.fromMnemonic(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(providerForSend);

        let nonce = await wallet.provider.getTransactionCount(wallet.address);

        const upNonce = () => {
            nonce++;
        }
        const balance = await wallet.getBalance();
        console.log(' - account address: ' + wallet.address);
        console.log(' - account balance: ' + balanceHuman(balance));

        const providers = [
            provider
        ];
        for (const url of urls) {
            providers.push(new ethers.providers.JsonRpcProvider(url));
        }

        const multiSwapAddress = this.envService.get('MULTI_SWAP_ADDRESS');
        const multiSwapContract = ContractFactory.getContract(multiSwapAddress, MultiSwapAbi.abi, wallet);
        console.log('multiSwapAddress=', multiSwapAddress);
        const getTransaction = async (hash, addedBlock: number, timeStart: Date) => {
            let attems = 0;
            while (attems < 10) {
                try {
                    const target: TransactionResponse | null = await wsProvider.getTransaction(hash);
                    if (target && target.to && target.nonce !== null) {
                        const router = routers.find((router) => router.address.toLowerCase() === target.to.toLowerCase())
                        if (target.gasPrice.gte('4000000000') && router) {
                            console.log('t', (new Date().getTime() - timeStart.getTime()) / 1000, 'attems: ' + attems);
                            const getMethod = () => {
                                for (const method of methods) {
                                    let result;
                                    try {
                                        result = iface.decodeFunctionData(method, target.data);
                                        return {
                                            result, method
                                        };
                                    } catch (e) {
                                    }
                                }
                                return null;
                            }
                            const json = getMethod();
                            if (json && !json.method.match(/Supporting/)) {
                                const deadline = (parseInt(json.result.deadline) - Math.floor(new Date().getTime() / 1000));
                                const swap = {
                                    target, json,
                                    factory: router.factory,
                                    deadline
                                };
                                try {
                                    await calculate(swap, this.pairRepository, this.envService.get('ETH_NETWORK'), this.startBlock, this.currentBlock,
                                        multiSwapContract, wallet, timeStart, this.redisPublisherClient, isTestMode, providers, nonce, upNonce,
                                        parseInt(this.envService.get('ETH_NETWORK_CHAIN_ID')), amount0, amount1, this.tgBot, this.transactionRepository
                                    );
                                } catch (e) {
                                    console.log(e)
                                }
                            }
                        }
                        return;
                    } else {
                        attems++;
                    }
                } catch (e) {
                    console.log('error', e.toString());
                    return;
                }
            }
        }

        wsProvider.on("pending", (hash) => {
            const timeStart = new Date();
            if (typeof hash == 'string' && this.blockUpdated) {
                getTransaction(hash, this.currentBlock, timeStart);
            }
        });

        wsProvider.on('block', (blockNumber) => {
            const used = process.memoryUsage().heapUsed / 1024 / 1024;
            console.log('block', blockNumber, `memory ${Math.round(used * 100) / 100} MB`);
            this.currentBlock = blockNumber;
            this.lastBlockTime = new Date().getTime();
            this.blockUpdated = false;
        });

        wsProvider._websocket.on('close', async (code) => {
            console.log('websocket error', code);
            this.tgBot.sendMessage('arbitrage websocket error, code=' + code);
        });

        this.startBlock = parseInt(this.envService.get('START_BLOCK'));
        if (!this.startBlock || isNaN(this.startBlock)) {
            throw Error('START_BLOCK not set');
        }
        this.redisSubscriberClient.subscribe('pairs');
        this.redisSubscriberClient.on('message', async (channel, data) => {
            const json = JSON.parse(data);
            this.lastSyncBlock = json.blockNumber;
            const diff = this.lastSyncBlock - this.currentBlock;
            if (diff < 0) {
                console.log('wait sync, syncBlock=', json.blockNumber, 'currentBlock=', this.currentBlock, 'diff: ' + diff);
            } else {
                console.log('block', json.blockNumber, 'update', ((new Date().getTime() - this.lastBlockTime) / 1000) + ' sec');
                this.blockUpdated = true;
            }
        });
    }

}
