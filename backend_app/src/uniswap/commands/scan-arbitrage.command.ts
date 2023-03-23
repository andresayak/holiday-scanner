import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {BigNumber, Contract, ContractFactory, utils, Wallet} from 'ethers';
import {In, Repository, MoreThan, Not, IsNull} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import {balanceHuman, BNB_CONTRACT, getAmountIn, getAmountOut, tokens} from "../helpers/calc";
import {EthProviderFactoryType} from "../uniswap.providers";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {RouterEntity} from "../entities/router.entity";
import {PairsType, VariantType} from "./helpers/getVariants";
import * as MultiSwapAbi from "../../contracts/MultiSwapV2.json";
import {calculate} from './helpers/arbitrage';


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
    openTrading = false;
    pairs: PairEntity[] = [];
    transactions = [];
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
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ROUTER_REPOSITORY')
                private readonly routerRepository: Repository<RouterEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'scan:arbitrage <providerName>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
    ) {

        let txIndex = 0;
        const routers = (await this.routerRepository.find());//.map((item)=>item.address.toLowerCase());
        const startWork = new Date();
        let removed = [];
        let openRequest = 0;
        let closeRequest = 0;
        let timeoudRequest = 0;
        let successTxs = 0;
        const wsProvider = this.providers('ws', this.envService.get('ETH_NETWORK'), providerName);
        const provider = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);
        let wallet = Wallet.fromMnemonic(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(wsProvider);

        const balance = await wallet.getBalance();
        console.log(' - account address: ' + wallet.address);
        console.log(' - account balance: ' + balanceHuman(balance));

        const multiSwapAddress = this.envService.get('MULTI_SWAP_ADDRESS');
        const multiSwapContract = ContractFactory.getContract(multiSwapAddress, MultiSwapAbi.abi, wallet);
        console.log('multiSwapAddress=', multiSwapAddress);
        const getTransaction = async (hash, addedBlock: number) => {
            const timeStart = new Date();
            let attems = 0;
            while (true) {
                try {
                    openRequest++;
                    const target: TransactionResponse | null = await wsProvider.getTransaction(hash);
                    openRequest--;
                    if (target && target.to && target.nonce) {
                        closeRequest++;
                        successTxs++;
                        //this.transactions = this.transactions.filter((tx) => !(tx && tx.from == target.from && tx.nonce == target.nonce));
                        const router = routers.find((router) => router.address.toLowerCase() === target.to.toLowerCase())
                        if (target.gasPrice.gt('1000000000') && router) {
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
                                //if(!this.openTrading) {
                                //    this.openTrading = true;
                                try {
                                    await calculate(swap, this.pairRepository, this.envService.get('ETH_NETWORK'), this.startBlock, this.currentBlock,
                                        multiSwapContract, wallet, timeStart);
                                }catch (e) {
                                    console.log(e)
                                }

                                //    this.openTrading = false;
                                //}
                                /*this.transactions = this.transactions.map((tx)=>tx.hash == target.hash?{...tx, ...target, json,
                                    factory: router.factory,
                                    deadline}:tx);
                                renderTable();*/
                            }
                        }
                        return;
                    } else {
                        attems++;
                        if (new Date().getTime() - timeStart.getTime() > 1000) {
                            //console.log('not found ' + hash, (new Date().getTime() - timeStart.getTime()) / 1000 + ' sec');
                            this.transactions = this.transactions.filter(item => item.hash !== hash);
                            removed.push(hash);
                            return null
                        }
                        //}
                        //console.log('target', target)
                    }
                } catch (e) {
                    console.log('error', e.toString());
                    timeoudRequest++;
                    openRequest--;
                    closeRequest++;
                }
                //    console.log('target', target)
            }
        }
        const renderTable = () => {
            /*const prices = this.transactions.reduce((accumulator, item) => {
                if (item.gasPrice) {
                    return {
                        count: accumulator.count + 1,
                        totalGasPrice: item.gasPrice.add(accumulator.totalGasPrice)
                    };
                }
                return accumulator;
            }, {
                count: 0,
                totalGasPrice: 0
            });
            const avgPrice = prices.totalGasPrice.div(prices.count)*/
            //console.log(currentBlock + ') avgPrice=' + avgPrice);
            const items = this.transactions.sort((a, b) => {
                if (a.gasPrice && b.gasPrice) {
                    if (a.gasPrice.eq(b.gasPrice)) {
                        return a.txIndex > b.txIndex ? -1 : 1;
                    } else {
                        return a.gasPrice.gt(b.gasPrice) ? -1 : 1;
                    }
                }
                return 1;
            });
            const table = items.filter(item => item.from && item.json).map((item) => {
                return {
                    hash: item.hash,
                    txIndex: item.txIndex,
                    from: item.from ? item.from.toString() : null,
                    to: item.to ? item.to.toString() : null,
                    //nonce: item.nonce?item.nonce:null,
                    price: item.gasPrice ? item.gasPrice.toString() : null,
                    limit: item.gasLimit ? item.gasLimit.toString() : null,
                    added: (new Date().getTime() - item.added) / 1000 + ' sec',
                    method: item.json ? item.json.method : '',
                    //token0: item.json.result.path[0],
                    //token1: item.json.result.path[1],
                    //token2: item.json.result.path[2],
                    factory: item.factory,
                    path: item.json.result.path,
                    value: item.value.toString(),
                    amountOutMin: item.json.result?.amountOutMin,
                    amountOut: item.json.result?.amountOut,
                    amountInMax: item.json.result?.amountInMax,
                    amountIn: item.value.gt(0) ? item.value : item.json.result?.amountIn,
                    gasPrice: item.gasPrice,
                    deadline: item.deadline + ' sec'
                }
            });
            //this.calculate(table, multiSwapContract);
            //console.table(table);
            console.log('time ', (new Date().getTime() - startWork.getTime()) / 1000 + ' sec')

        }
        wsProvider.on("pending", (hash) => {
            const timeStart = new Date();
            this.transactions.push({
                txIndex: ++txIndex,
                currentBlock: this.currentBlock,
                hash,
                added: new Date().getTime()
            });
            if (typeof hash == 'string') {
                getTransaction(hash, this.currentBlock);
            }
        });
        wsProvider.on("block", (blockNumber) => {
            const timeStart = new Date();
            console.log('block', blockNumber);
            this.currentBlock = blockNumber;
            this.lastBlockTime = timeStart.getTime();
            this.lastVariants = null;
            this.lastPairs = null;
            this.transactions = [];
            provider.getBlockWithTransactions(blockNumber).then((info) => {
                let transactions = info.transactions.map(item => item.hash);
                const items = info.transactions.filter(item => item.gasPrice.gt(0));
                const minGasPrice = items.reduce((a: BigNumber, item) => (a === null)
                    ? item.gasPrice : (item.gasPrice.lt(a) && a.toString() !== '0' ? item.gasPrice : a), null);
                console.log('minGasPrice=' + minGasPrice);
                const maxGasPrice = items.reduce((a: BigNumber, item) => (a === null)
                    ? item.gasPrice : (item.gasPrice.gt(a) && a.toString() !== '0' ? item.gasPrice : a), null);
                console.log('maxGasPrice=' + maxGasPrice);

                const pendings = this.transactions.map(item => item.hash);
                this.transactions = this.transactions.filter(item => //!transactions.includes(item.hash)
                    //||
                    ((new Date().getTime() - item.added) / 1000 < 5)//)//&& item.gasPrice && item.gasPrice.lt(minGasPrice))
                );
                const notFromList = transactions.filter(hash => !pendings.includes(hash));
                const fromRemoveList = notFromList.filter(hash => removed.includes(hash));
                console.log('notFromPending', notFromList.length + ' / ' + transactions.length);
                console.log('fromRemoveList', fromRemoveList.length + ' / ' + removed.length);
                console.log('transactions', this.transactions.length);
                console.log('openRequest', openRequest, 'closeRequest', closeRequest, 'successTxs', successTxs, 'timeoudRequest', timeoudRequest);
                this.transactions = this.transactions.sort((a, b) => {
                    return a.gasPrice && b.gasPrice && a.gasPrice.gt(b.gasPrice) ? -1 : 1;
                });
                //renderTable();
                console.log('end block', blockNumber, (new Date().getTime() - timeStart.getTime()) / 1000 + ' sec');
            });
        });

        this.redisSubscriberClient.subscribe('pairs');
        this.redisSubscriberClient.on('message', async (channel, data) => {
            const json = JSON.parse(data);
            //console.log('json.pairs', json.pairs);
            this.startBlock = json.blockNumber - json.liveCount;
        });
    }

}
