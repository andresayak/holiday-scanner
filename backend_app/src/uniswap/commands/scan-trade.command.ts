import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {BigNumber, ContractFactory, providers, utils, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';
import {balanceHuman, getAmountOut} from "../helpers/calc";
import * as MultiSwapAbi from "../../contracts/MultiSwap.json";
import * as UniswapV2Pair from "../../contracts/UniswapV2Pair.json";

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
        let openTrade = false;
        const gasLimit = BigNumber.from('215000');
        const gasPrice = BigNumber.from('6000000000');

        const mainProvider = new providers.JsonRpcProvider('https://rpc.ankr.com/bsc/' + this.envService.get('ANKR_PROVIDER_KEY'));

        const multiSwapAddress = this.envService.get('MULTI_SWAP_ADDRESS1');
        let wallet = Wallet.fromMnemonic(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(mainProvider);

        const balance = await wallet.getBalance();
        console.log(' - account address: ' + wallet.address);
        console.log(' - account balance: ' + balanceHuman(balance));

        console.log('multiSwapAddress=', multiSwapAddress);

        const multiSwapContract = ContractFactory.getContract(multiSwapAddress, MultiSwapAbi.abi, wallet);

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
        }[], blockNumber: number, timeStart: Date) => {
            console.log('get blockNumber', blockNumber, (new Date().getTime() - timeStart.getTime()) / 1000);
            const variants = [];
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
                                pairs: [pairX.address, pairY.address],
                                blockNumbers: [pairX.blockNumber, pairY.blockNumber]
                            });
                        }
                    }
                }
            }
            let success = [];
            for (const variant of variants) {
                const amountIn = variant.path[0] == BNB_CONTRACT.toLowerCase() ? utils.parseEther("0.1") : utils.parseEther("100");
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
                        amountOutsMin.push(getAmountOut(amountInCurrent, reserve0, reserve1));
                        reservers.push([reserve0, reserve1]);
                    }
                }
                const amountOut = BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
                const _gasPrice = gasPrice.add(gasPrice.mul(30).div(100));
                const gas = _gasPrice.mul(gasLimit);
                const profit = amountOut.sub(amountIn).sub(gas).mul(10000).div(amountIn);
                const real = amountIn.mul(profit).div(1000);//.div(100);
                if (status) {
                    success.push({
                        amountIn: amountIn.toString(),
                        amountOut: amountOut.toString(),
                        amountOutsMin: amountOutsMin.map(amountOutMin => amountOutMin.toString()),
                        reservers,
                        pairs: variant.pairs,
                        blockNumbers: variant.blockNumbers,
                        path: variant.path,
                        gasPrice: _gasPrice,
                        gasLimit: gasLimit,
                        profit: parseInt(profit.toString()) / 100,
                        profit_real: balanceHuman(real, variant.path[0])
                    });
                }
            }
            success = success.filter(item => item.profit > 0).sort((a, b) => (b.profit - a.profit));
            console.log('success', success);
            console.log('success', success.length, (new Date().getTime() - timeStart.getTime()) / 1000);

            if(success.length){
                const mostSuccess = success[0];

                console.log('mostSuccess', mostSuccess, [
                    mostSuccess.pairs,
                    mostSuccess.path,
                    mostSuccess.amountOutsMin,
                    wallet.address
                ]);

                console.log(success[0]);
                if(!openTrade){
                    openTrade = true;
                    makeTrade(success[0], pairs);
                }
            }
        }

        const makeTrade = async (mostSuccess, pairs) => {

            const pair0 = pairs.find(pair=>pair.address == mostSuccess.pairs[0]);
            const pair1 = pairs.find(pair=>pair.address == mostSuccess.pairs[1]);

            console.log('pair0', pair0);
            console.log('pair1', pair1);
            const pair0Contract = ContractFactory.getContract(mostSuccess.pairs[0], UniswapV2Pair.abi, wallet);
            const pair1Contract = ContractFactory.getContract(mostSuccess.pairs[1], UniswapV2Pair.abi, wallet);

            let reserves0 = await pair0Contract.getReserves();
            if(pair0.token0 == mostSuccess.path[1]){
                reserves0 = [reserves0[1], reserves0[0]];
            }
            let reserves1 = await pair1Contract.getReserves();
            if(pair1.token0 == mostSuccess.path[1]){
                reserves1 = [reserves1[1], reserves1[0]];
            }
            console.log('reserves00='+reserves0[0]+', '+mostSuccess.reservers[0][0]);
            console.log('reserves01='+reserves0[1]+', '+mostSuccess.reservers[0][1]);
            console.log('reserves10='+reserves1[0]+', '+mostSuccess.reservers[1][0]);
            console.log('reserves11='+reserves1[1]+', '+mostSuccess.reservers[1][1]);

            if(!reserves0[0].eq(mostSuccess.reservers[0][0])){
                console.log('fail 00');
            }
            if(!reserves0[1].eq(mostSuccess.reservers[0][1])){
                console.log('fail 010');
            }
            if(!reserves1[0].eq(mostSuccess.reservers[1][0])){
                console.log('fail 10');
            }
            if(!reserves1[1].eq(mostSuccess.reservers[1][1])){
                console.log('fail 11');
            }
            return;
            console.log();
            const gasLimit = BigNumber.from('500000');
            const gasPrice = BigNumber.from('6000000000');//6gwei
            let deadline = Math.floor(new Date().getTime() / 1000) + 3600;/*
            const balance1 = await WETH.balanceOf(multiSwapContract.address);
            console.log(' - account balance: ' + balanceHuman(balance1));

            const estimationGas = gasLimit.mul(gasPrice);
            console.log('estimationGas='+estimationGas);*/
            const tx = await multiSwapContract.connect(wallet).swap(
                mostSuccess.amountIn,
                mostSuccess.pairs,
                mostSuccess.path,
                mostSuccess.amountOutsMin,
                deadline, {
                    gasPrice,
                    gasLimit
                });

            console.log('tx send', tx.hash);
            const receipt = await tx.wait();
            console.log('tx receipt');

            openTrade = false;
            /*
            console.log(' - use: ' + balanceHuman(mostSuccess.amountIn));
            const receipt = await tx.wait();
            console.log('gasUsed='+ receipt.gasUsed);
            const gas = tx.gasPrice.mul(receipt.gasUsed);
            console.log(' - gas: '+ gas, balanceHuman(gas))
            const balance2 = (await WETH.balanceOf(multiSwap.address));
            console.log(' - account balance: ' + balanceHuman(balance2));
            const balanceDiff = balance2.sub(balance1);
            console.log('balanceDiff '+balanceDiff);
            const profitReal = balanceDiff.mul(100).div(amountIn).toString();
            console.log('profitReal', profitReal, balanceHuman(profitReal))*/
        }



        this.redisSubscriberClient.subscribe('pairs');
        this.redisSubscriberClient.on('message', (channel, data) => {
            const json = JSON.parse(data);
            processVariants(json.pairs, json.blockNumber, new Date(json.timeStart));
        });
        console.log('listening...');
    }


}
