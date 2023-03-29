import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {BigNumber, Contract, ContractFactory, ethers, utils, Wallet} from 'ethers';
import {In, Repository, MoreThan, Not, IsNull} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import {balanceHuman, BNB_CONTRACT, getAmountIn, getAmountOut, sortTokens, tokens} from "../helpers/calc";
import {EthProviderFactoryType} from "../uniswap.providers";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {RouterEntity} from "../entities/router.entity";
import {getVariants, PairsType, VariantType} from "./helpers/getVariants";
import * as MultiSwapAbi from "../../contracts/MultiSwapV2.json";
import {calculate} from './helpers/arbitrage';
import {urls} from "../helpers/provider";


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

const sql = 'SELECT \n' +
    'pair1.id as p1, \n' +
    'pair2.id as p2, \n' +
    'pair3.id as p3\n' +
    '\n' +
    'FROM `pairs` as `pair1`, `pairs` as `pair2`, `pairs` as `pair3` \n' +
    'WHERE \n' +
    '(      \n' +
    '\tpair2.id = $2\n' +
    '   \n' +
    ')\n' +
    'AND \n' +
    '(      (pair1.token0 = \'$1\' AND pair1.token1 = pair2.token0 AND pair2.token1 != pair1.token0)\n' +
    '    OR (pair1.token0 = \'$1\' AND pair1.token1 = pair2.token1 AND pair2.token0 != pair1.token0)\n' +
    '    OR (pair1.token1 = \'$1\' AND pair1.token0 = pair2.token0 AND pair2.token1 != pair1.token1)\n' +
    '    OR (pair1.token1 = \'$1\' AND pair1.token0 = pair2.token1 AND pair2.token0 != pair1.token1)\n' +
    ') \n' +
    'AND \n' +
    '(      (pair3.token0 = \'$1\' AND pair3.token1 = pair2.token0 AND pair2.token1 != pair3.token0)\n' +
    '    OR (pair3.token0 = \'$1\' AND pair3.token1 = pair2.token1 AND pair2.token0 != pair3.token0)\n' +
    '    OR (pair3.token1 = \'$1\' AND pair3.token0 = pair2.token0 AND pair2.token1 != pair3.token1)\n' +
    '    OR (pair3.token1 = \'$1\' AND pair3.token0 = pair2.token1 AND pair2.token0 != pair3.token1)\n' +
    ' )\n' +
    'AND \n' +
    '(      (pair1.token0 = \'$1\' AND pair1.token1 != pair3.token0 AND pair1.token1 != pair3.token1)\n' +
    '    OR (pair1.token1 = \'$1\' AND pair1.token0 != pair3.token0 AND pair1.token0 != pair3.token1)\n' +
    '    \n' +
    ');'
@Injectable()
export class ScanVariants3Command {


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
                private readonly routerRepository: Repository<RouterEntity>) {
    }

    @Command({
        command: 'scan:variants3',
        autoExit: false
    })
    async create() {


        const tokensAll = (await this.tokenRepository.find({
            isTested: true,
        })).filter(token=>!tokens.includes(token.address))
            .map(token=>token.address);

        console.log('tokens='+tokensAll.length);

        let total = 0;
        for (const tokenIn of tokens) {
            for (const tokenOut in tokensAll) {
                total++;
            }
        }
        let count = 0;

        const timeStart = new Date().getTime();
        const items = await this.pairRepository.query(sql
            .replaceAll('$2', '666702')
            .replaceAll('$1', '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'));

        console.log('items='+items.length);

        console.log('Time: '+ (new Date().getTime() - timeStart)/1000+' sec.');
    }

}
