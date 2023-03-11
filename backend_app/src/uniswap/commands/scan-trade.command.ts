import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {BigNumber, utils} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';
import {balanceHuman, getAmountOut} from "../helpers/calc";

const BNB_CONTRACT = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const tokens = [
    BNB_CONTRACT.toLowerCase(),
    '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    '0x55d398326f99059ff775485246999027b3197955',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
];

@Injectable()
export class ScanTradeCommand {
    iface: Interface;

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_SUBSCRIBER_CLIENT')
                private readonly redisSubscriberClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>) {

        const swapInterface = [
            'event Sync(uint112 reserve0, uint112 reserve1)'
        ];

        this.iface = new utils.Interface(swapInterface);
    }

    @Command({
        command: 'scan:trade',
        autoExit: false
    })
    async create() {
        const gasLimit = BigNumber.from('215000');
        const gasPrice = BigNumber.from('5000000000');
        const processVariants = (pairs:{
            id: number,
            address: string,
            factory: string,
            token0: string,
            token1: string,
            reserve0: string,
            reserve1: string,
            blockNumber: number,
            transactionIndex: number,
            logIndex: number
        }[]) => {
            const variants = [];
            let timeStart = new Date();
            for (const tokenIn of tokens) {
                for (const x in pairs) {
                    const pairX = pairs[x];
                    if (pairX.token0 !== tokenIn && pairX.token1 !== tokenIn) {
                        continue;
                    }
                    const tokenOut = pairX.token0 == tokenIn ? pairX.token1 : pairX.token0;
                    for (const y in pairs) {
                        if (x === y) {
                            continue;
                        }
                        const pairY = pairs[y];
                        if (
                            (pairY.token0 === tokenOut && pairY.token1 === tokenIn)
                            || (pairY.token1 === tokenOut && pairY.token0 === tokenIn)
                        ) {
                            variants.push({
                                path: [tokenIn, tokenOut, tokenIn],
                                pairs: [pairX.address, pairY.address]
                            });
                        }
                    }
                }
            }
            console.log('variants', variants.length, (new Date().getTime() - timeStart.getTime()) / 1000);

            timeStart = new Date();
            let success = [];
            for (const variant of variants) {
                const amountIn = variant.path[0] == BNB_CONTRACT.toLowerCase() ? utils.parseEther("0.3") : utils.parseEther("100");
                let amountOutsMin = [];
                let reservers = [];
                let status = true;
                for (const index in variant.pairs) {
                    const pairAddress = variant.pairs[index];
                    const pair = pairs.find(pair => pair.address == pairAddress);
                    if (pair) {
                        const token0 = variant.path[index];
                        const reserve0 = BigNumber.from(token0 == pair.token0 ? pair.reserve0 : pair.reserve1);
                        const reserve1 = BigNumber.from(token0 == pair.token0 ? pair.reserve1 : pair.reserve0);

                        const amountInCurrent = parseInt(index) == 0 ? amountIn : amountOutsMin[parseInt(index) - 1];

                        //if(amountInCurrent.gt(reserve0)){
                        //   console.log('not enouthr');
                        //   status = true;
                        //}

                        amountOutsMin.push(getAmountOut(amountInCurrent, reserve0, reserve1));
                        reservers.push([reserve0, reserve1]);
                    }
                }
                //const amountInMax = ethers.BigNumber.from(reservers[0][1].sub(reservers[1][1]).div(620000).toString());

                const amountOut = BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
                const _gasPrice = gasPrice.add(gasPrice.mul(30).div(100));
                const gas = _gasPrice.mul(gasLimit);
                //const profit = parseInt(amountOut.sub(amountIn).mul(10000).div(amountIn).toString()) / 100;
                const profit = amountOut.sub(amountIn).sub(gas).mul(10000).div(amountIn);
                console.log('profit', parseInt(profit.toString()) / 100);
                console.log('gas', balanceHuman(gas));
                const real = amountIn.mul(profit).div(1000);//.div(100);
                if (status) {
                    success.push({
                        amountIn: amountIn.toString(),
                        amountOut: amountOut.toString(),
                        //amountInsMax: [amountInMax],
                        amountOutsMin: amountOutsMin.map(amountOutMin => amountOutMin.toString()),
                        reservers,
                        pairs: variant.pairs,
                        path: variant.path,
                        gasPrice: _gasPrice,
                        gasLimit: gasLimit,
                        profit: parseInt(profit.toString()) / 100,
                        profit_real: balanceHuman(real)
                    });
                }
            }
            success = success.filter(item => item.profit > 0).sort((a, b) => (b.profit - a.profit));
            console.log('success', success);
            console.log('success', success.length, (new Date().getTime() - timeStart.getTime()) / 1000);
            console.log(success[0]);
        }

        this.redisSubscriberClient.subscribe('pairs');
        this.redisSubscriberClient.on('message', (channel, data) => {
            const json = JSON.parse(data);
            console.log('data', channel, json);
            processVariants(json);
        });
        console.log('listening...');
    }


}
