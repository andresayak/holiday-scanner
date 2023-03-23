import {BigNumber, Contract, ContractFactory, ethers, utils} from "ethers";
import {balanceHuman, calcInterestDiff} from "../../helpers/calc";
import {swapExactETHForTokens} from "./swapExactETHForTokens";
import {buyTokens} from "./buyTokens";
import {sellTokens} from "./sellTokens";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {ContractTransaction} from "@ethersproject/contracts";
import * as ERC20Abi from "../../../contracts/ERC20.json";
import {PairEntity} from "../../entities/pair.entity";
import * as colors from 'colors';
import {Repository} from "typeorm";
import {RouterEntity} from "../../entities/router.entity";
import * as SwapRouter02Abi from "../../../contracts/SwapRouter02.json";

const swapInterface = [
    'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)',
    'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)',
    'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] calldata path,address to,uint deadline)',
    'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path,address to,uint deadline)',
    'event Sync(uint112 reserve0, uint112 reserve1)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
];

const methods = ['swapExactETHForTokens', 'swapETHForExactTokens', 'swapExactETHForTokensSupportingFeeOnTransferTokens', 'swapExactTokensForETHSupportingFeeOnTransferTokens'];
const iface = new utils.Interface(swapInterface);

type PropsType = {
    target: TransactionResponse;
    timeStart: Date;
    whitelist: string[];
    factories: any;
    multiSwapContract: Contract;
    getPairs: () => Promise<PairEntity[]>;
    callbackBuy?: (tx: ContractTransaction) => any;
    callbackSell?: (tx: ContractTransaction) => any;
    checkBeforeStart: (tx: ContractTransaction) => boolean;
    amountMaxIn: BigNumber;
    amountMinProfit: BigNumber;
    profitMin: number;
    routerRepository: Repository<RouterEntity>;
    network: string;
}

export const processRouterTx = (props: PropsType) => {
    return new Promise(async (done, reject) => {
        try {
            const {
                target, timeStart, whitelist, factories,
                callbackBuy, callbackSell, multiSwapContract,
                getPairs, amountMaxIn, checkBeforeStart,
                amountMinProfit, routerRepository, network
            } = props;
            if (target.value.eq(0)) {
                //console.log((colors.red('empty value')));
                return;
            }

            const getMethod = () =>{
                for(const method of methods){
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
            if (json) {
                const routerAddress = target.to.toLowerCase();
                let router = await routerRepository.findOne({
                    where: {
                        address: routerAddress
                    }
                });
                if(!router){
                    try{
                        const routerContract = ContractFactory.getContract(routerAddress, SwapRouter02Abi.abi, multiSwapContract.signer);
                        const WETH = await routerContract.WETH();
                        const factory = await routerContract.factory();
                        router = await routerRepository.save(new RouterEntity({
                            address: routerAddress,
                            factory: factory.toLowerCase(),
                            weth: WETH.toLowerCase(),
                            network
                        }));
                    }catch (e) {
                        console.log(e);
                        return;
                    }
                }


                const {result, method} = json;
                console.log('method', method);
                console.log('txHash', target.hash, 'Swap');
                console.log(' - from: ', target.from);
                console.log(' - to: ', target.to);
                console.log(' - value: ' + target.value);
                console.log(' - method: '+method);
                if(method != 'swapExactETHForTokens' && method!='swapExactETHForTokensSupportingFeeOnTransferTokens'){
                    console.log(colors.red('wrong method'));
                }

                console.log(' - amountOutMin: ' + result.amountOutMin, ', ' + ethers.utils.formatEther(result.amountOutMin));
                console.log(' - amountIn: ' + target.value + ', ', balanceHuman(target.value));
                console.log(' - path:', result.path);
                console.log(' - to:', target.to);
                console.log(' - deadline:', result.deadline.toString());

                if (result.path.length !== 2) {
                    console.log(colors.red('not 2 tokens'));
                    return;
                }
                const token0 = result.path[0].toLowerCase();
                const token1 = result.path[1].toLowerCase();
                if(token0 !== '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'){
                    console.log(colors.red('wrong WETH '+token0));
                //    return
                }
                if (!whitelist.includes(token0)) {
                    console.log(colors.red('not in whitelist '+token0));
                    //return
                }
                if (!whitelist.includes(token1)) {
                    console.log(colors.red('not in whitelist '+token1));
                    //return
                }
                const factoryAddress = router.factory;

                const pairs = await getPairs();
                if (!pairs) {
                    console.log(colors.red('empty pairs'));
                    return;
                }
                const pair = pairs.find(pair => pair.factory == factoryAddress
                    && (
                        (pair.token0 == token1 && pair.token1 == token0) || (pair.token1 == token1 && pair.token0 == token0)
                    )
                );
                if (!pair) {
                    console.log(colors.red('pair not found'));
                    return;
                }
                if (!(pair.fee && pair.fee_scale)) {
                    console.log(colors.red('pair without fee'));
                    return;
                }

                const data = await swapExactETHForTokens({
                        target, pair, pairs,
                        result, token0, token1, timeStart,
                        amountMaxIn
                    }
                );
                console.log('Calculate: ' + ((new Date().getTime() - timeStart.getTime()) / 1000) + ' sec');
                if (!data) {
                    console.log('error');
                    return;
                }
                const {buy, sell} = data;
                if (!sell) {
                    return;
                }
                /*if(sell.profit < profitMin){
                    console.log('small profit');
                    return;
                }*/
                if (sell.profitAmount.lt(amountMinProfit)) {
                    console.log(colors.red('small profit amount'));
                    return;
                }
                if (!checkBeforeStart(target)) {
                    console.log('busy');
                    return;
                }
                const txBuy: ContractTransaction = await buyTokens({
                    target, token0, token1,
                    pair: buy.pair.address,
                    amountOut: buy.amountOut,
                    amountIn: buy.amountIn,
                    multiSwapContract
                });
                callbackBuy(txBuy);
                const txSell: ContractTransaction = await sellTokens({
                    target, token0: token1, token1: token0, pair: sell.pair.address,
                    amountIn: sell.amountIn, amountOut: sell.amountOut,
                    multiSwapContract, fee: sell.pair.fee, fee_scale: sell.pair.fee_scale
                });

                callbackSell(txSell);
                console.log('Sell hash', txSell.hash, BigNumber.from(target.hash).lt(txSell.hash));
                console.log('Sell after: ' + ((new Date().getTime() - timeStart.getTime()) / 1000) + ' sec');
                const token0Contract = ContractFactory.getContract(token0, ERC20Abi.abi, multiSwapContract.signer);
                const token1Contract = ContractFactory.getContract(token1, ERC20Abi.abi, multiSwapContract.signer);
                const balance0Before = await token0Contract.balanceOf(multiSwapContract.address);
                const balance1Before = await token1Contract.balanceOf(multiSwapContract.address);
                console.log('balance0Before=' + balance0Before);
                console.log('balance1Before=' + balance1Before);

                const receiptBuy = await txBuy.wait();
                const receiptSell = await txSell.wait();
                console.log('Buy events:');
                decodeEvents(receiptBuy.events);
                console.log('Sell events:');
                decodeEvents(receiptSell.events);

                const balance0After = await token0Contract.balanceOf(multiSwapContract.address);
                const balance1After = await token1Contract.balanceOf(multiSwapContract.address);
                console.log('balance0After=' + balance0After);
                console.log('balance1After=' + balance1After);
                const balanceDiff0 = balance0After.sub(balance0Before);
                const balanceDiff1 = balance1After.sub(balance1Before);

                const diffInterest = calcInterestDiff(buy.amountIn, balanceDiff0);
                if (balanceDiff0) {
                    console.log('balance0 diff=' + balanceDiff0 + ' (' + diffInterest + '%)');
                    console.log('balance1 diff=' + balanceDiff1);
                }

                done({...data, receiptBuy, receiptSell});
            }
        } catch (e) {
            reject(e);
        }
    });
}


const decodeEvents = (events) => {
    for (const event of events) {
        try {
            const result = iface.decodeEventLog('Sync', event.data, event.topics);
            console.log(' - Sync ' + event.address)
            console.log(' - - reserve0: ' + result.reserve0)
            console.log(' - - reserve1: ' + result.reserve1)
        } catch (e) {
        }
        try {
            const result = iface.decodeEventLog('Transfer', event.data, event.topics);
            console.log(' - Transfer ' + event.address)
            console.log(' - - from: ' + result.from)
            console.log(' - - to: ' + result.to)
            console.log(' - - value: ' + result.value)
        } catch (e) {
        }
        try {
            const result = iface.decodeEventLog('Swap', event.data, event.topics);
            console.log(' - Swap ' + event.address)
            console.log(' - - sender: ' + result.sender)
            console.log(' - - amount0In: ' + result.amount0In)
            console.log(' - - amount1In: ' + result.amount1In)
            console.log(' - - amount0Out: ' + result.amount0Out)
            console.log(' - - amount1Out: ' + result.amount1Out)
            console.log(' - - to: ' + result.to)
        } catch (e) {
        }
    }
}
