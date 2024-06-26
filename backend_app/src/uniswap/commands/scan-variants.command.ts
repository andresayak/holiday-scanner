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
export class ScanVariantsCommand {


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
        command: 'scan:variants',
        autoExit: false
    })
    async create() {

        const timeStart = new Date().getTime();
        const tokensAll = (await this.tokenRepository.find({
            //isTested: true,
        })).filter(token=>!tokens.includes(token.address))
            .map(token=>token.address);

        console.log('tokens='+tokensAll.length);
        const pairsAll = await this.pairRepository.find({
            where: {
                //status: 'Success'
                fee: Not(IsNull())
            }
        });
        console.log('pairs='+pairsAll.length);

        let variants = [];
        let total = 0;
        for (const tokenIn of tokens) {
            for (const tokenOut in tokensAll) {
                total++;
            }
        }
        let count = 0;
        for (const tokenOut of tokensAll) {
            console.log('Removed', (++count)+'/'+total, tokenOut);
            await new Promise((done)=>this.redisPublisherClient.del('variants_' + tokenOut, done));
        }

        count = 0;
        let count_cases = 0;
        for (const tokenOut of tokensAll) {
            let variants = [];
            let unitPairs = [];
            console.log('Added', (++count)+'/'+total, tokenOut);
            const items = pairsAll.filter(pair=>(pair.token0 == tokenOut || pair.token1 == tokenOut));
            if(items.length > 0) {
                for(const variant of getVariants(items)){
                    variants.push(variant);
                    unitPairs.push(variant.pairs[0]);
                    unitPairs.push(variant.pairs[1]);
                }
            }
            if(variants.length){
                unitPairs = unitPairs.filter((value, index, array) => array.indexOf(value) === index);
                console.log('variants', variants);
                console.log('unitPairs', unitPairs);
                this.redisPublisherClient.set('variants_'+tokenOut, JSON.stringify({
                    variants,
                    pairs: unitPairs
                }));
            }
        }
        console.log('count_cases='+count_cases);
        console.log('variants='+variants.length);
        console.log('count='+count);
        return;
/*

        const variants: VariantType[] = getVariants(pairs);
        console.log('variants', variants.length);
        console.log('pairs', pairs);*/
        console.log('Time: '+ (new Date().getTime() - timeStart)/1000+' sec.');
    }

}
