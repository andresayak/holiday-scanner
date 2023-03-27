import {BigNumber, Contract, ContractFactory, Signer, utils, Wallet} from "ethers";
import {balanceHuman, BNB_CONTRACT, getAmountIn, getAmountOut, sortTokens, tokens} from "../../helpers/calc";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {processFindSuccess, Swap} from "./processFindSuccess";
import {In, IsNull, MoreThan, Not, Repository} from "typeorm";
import {getVariants, VariantType} from "./getVariants";
import {PairEntity} from "../../entities/pair.entity";
import {updateReserves} from "./updateReserves";
import * as fs from 'fs';
import {RedisClient} from "redis";
import { JsonRpcProvider } from "@ethersproject/providers";

const blacklist = [
    '0xacfc95585d80ab62f67a14c566c1b7a49fe91167',
    '0xfb5b838b6cfeedc2873ab27866079ac55363d37e',
    '0x9d986a3f147212327dd658f712d5264a73a1fdb0',
    '0x477bc8d23c634c154061869478bce96be6045d12',
    '0xa57ac35ce91ee92caefaa8dc04140c8e232c2e50'
];
const baselist = [
    BNB_CONTRACT.toLowerCase(),
    '0xe9e7cea3dedca5984780bafc599bd69add087d56'
]
const swapInterface = [
    'event Sync(uint112 reserve0, uint112 reserve1)',
];
const iface = new utils.Interface(swapInterface);

const checkisWhitelist = (tokenAddress: string, redisPublisherClient: RedisClient) => {
    return new Promise((done)=> {
        redisPublisherClient.get('token_'+tokenAddress.toLowerCase(), (err, reply)=>{
            done(reply);
        });
    });
}
export const calculate = async (swap: {
    factory: string;
    target: TransactionResponse,
    json: {
        result: Swap,
        method: string;
    }
}, pairRepository: Repository<PairEntity>, network: string, startBlock: number, currentBlock: number,
        multiSwapContract: Contract, wallet: Wallet, timeStart: Date, redisPublisherClient: RedisClient, isTestMode: boolean,
        providers: JsonRpcProvider[],
        nonce: number, upNonce: ()=>void
) => {
    const {target} = swap;
    const token0 = swap.json.result.path[0].toLowerCase();
    const token1 = swap.json.result.path[1].toLowerCase();
    const token2 = swap.json.result.path[2]?.toLowerCase();

    const tokenInner = [];
    if (!tokens.includes(token0) && await checkisWhitelist(token0, redisPublisherClient)) {
        tokenInner.push(token0);
    }
    if (token1 && !tokens.includes(token1) && await checkisWhitelist(token1, redisPublisherClient)) {
        tokenInner.push(token1);
    }
    if (token2 && !tokens.includes(token2) && await checkisWhitelist(token2, redisPublisherClient)) {
        tokenInner.push(token2);
    }
    if(!tokenInner.length){
        return;
    }
    console.log('t1', (new Date().getTime() - timeStart.getTime())/1000);
    const pairs = await pairRepository.find({
        where: [{
            network,
            blockNumber: MoreThan(startBlock),
            fee: Not(IsNull()),
            token0: In(tokens),
            token1: In(tokenInner)
        }, {
            network,
            blockNumber: MoreThan(startBlock),
            fee: Not(IsNull()),
            token1: In(tokens),
            token0: In(tokenInner),
        }]
    });

    const timeFetch = (new Date().getTime() - timeStart.getTime())/1000;/*
    const pairs = [];
    const promises = [];
    for(const t1 of baselist){
        for(const t2 of tokenInner){
            const [token0, token1] = sortTokens(t1, t2);
            promises.push(new Promise((done)=> {
                redisPublisherClient.get('pair_'+token0+'_'+token1, (err, reply)=>{
                    if(reply){
                        const data = JSON.parse(reply);
                        if(data && data.blockNumber>=startBlock){
                            pairs.push(data);
                            return done(true);
                        }
                    }
                    done(true);
                });
            }));
        }
    }
    await Promise.all(promises);*/
    console.log('t2', (new Date().getTime() - timeStart.getTime())/1000);
    console.log('pairs', pairs.length);
    if (pairs.length > 1 && swap.json.result.path.length == 2 || swap.json.result.path.length == 3) {
        const pair1 = pairs.find((pair) => pair.factory == swap.factory && (
            (pair.token0 == token0 && pair.token1 == token1) || (pair.token1 == token0 && pair.token0 == token1)
        ));
        if (!pair1) {
            console.log('target pair1 not found');
            return;
        }

        const before: any = {
            pair0: JSON.parse(JSON.stringify(pair1))
        };
        const after: any = {}

        const amountIn = target.value.gt(0) ? target.value : (swap.json.result.amountIn ?? BigNumber.from(0));
        const amountOut = swap.json.result.amountOut ?? BigNumber.from(0);
        const amountOutMin = swap.json.result.amountOutMin ?? BigNumber.from(0);
        const amountInMax = swap.json.result.amountInMax ?? BigNumber.from(0);
        console.log('amountIn=' + amountIn, balanceHuman(amountIn));
        console.log('amountOut=' + amountOut, balanceHuman(amountOut));
        console.log('amountOutMin=' + amountOutMin, balanceHuman(amountOutMin));
        console.log('amountInMax=' + amountInMax, balanceHuman(amountInMax));
        let pair2;
        if (token2) {
            pair2 = pairs.find((pair) => pair.factory == swap.factory && (
                (pair.token0 == token1 && pair.token1 == token2) || (pair.token1 == token1 && pair.token0 == token2)
            ));
            if (!pair2) {
                console.log('target pair2 not found');
                return;
            }
            before.pair1 = JSON.parse(JSON.stringify(pair2));
            const {amountRealIn: amountRealIn0, amountRealOut: amountRealOut0}
                = updateReserves(pair1, token0, amountIn, BigNumber.from(0), amountInMax, BigNumber.from(0));
            after.amountRealIn0 = amountRealIn0.toString();
            after.amountRealOut0 = amountRealOut0.toString();
            after.reserves0 = [pair1.reserve0, pair1.reserve1];

            const {amountRealIn: amountRealIn1, amountRealOut: amountRealOut1}
                = updateReserves(pair2, token1, amountRealOut0, amountOut, BigNumber.from(0), amountOutMin);
            after.amountRealIn1 = amountRealIn1.toString();
            after.amountRealOut1 = amountRealOut1.toString();
            after.reserves1 = [pair2.reserve0, pair2.reserve1];
        } else {
            const {amountRealIn: amountRealIn0, amountRealOut: amountRealOut0}
                = updateReserves(pair1, token0, amountIn, amountOut, amountInMax, amountOutMin);
            after.amountRealIn0 = amountRealIn0.toString();
            after.amountRealOut0 = amountRealOut0.toString();
            after.reserves0 = [pair1.reserve0, pair1.reserve1];
        }
        const variants: VariantType[] = getVariants(pairs);
        const items = processFindSuccess({variants, pairs});
        const timeDiff0 = (new Date().getTime() - timeStart.getTime())/1000;
        console.log(' TIME DIFF0 = ', timeDiff0);
        if (items.length) {
            const success = items[0];
            const timeDiff1 = (new Date().getTime() - timeStart.getTime())/1000;
            console.log(' TIME DIFF1 = ', timeDiff1);
            let hash = '';
            let timing;
            if(isTestMode){
                console.log('TEST MODE ENABLED');
            }else{
                const sendResult = await calculateswapRaw(success, multiSwapContract, swap.target.gasPrice, nonce, providers);
                if(sendResult){
                    upNonce();
                    hash = sendResult.hash;
                    timing = sendResult.timing;
                }
            }
            const timeDiff2 = (new Date().getTime() - timeStart.getTime())/1000;
            console.log(' TIME DIFF2 = ', timeDiff2);
            const data = {
                times: {
                    timeFetch,
                    timeDiff0, timeDiff1, timeDiff2, timing
                },
                block: currentBlock,
                hash,
                target: {
                    hash: swap.target.hash,
                    from: swap.target.from,
                    to: swap.target.to,
                    gasPrice: swap.target.gasPrice.toString(),
                    gasLimit: swap.target.gasLimit.toString(),
                    method: swap.json.method,
                    params: {
                        amountIn: amountIn.toString(),
                        amountOut: amountOut.toString(),
                        amountOutMin: amountOutMin.toString(),
                        amountInMax: amountInMax.toString(),
                        path: swap.json.result.path,
                        deadline: swap.json.result.deadline.toString()
                    }
                }, before, after, success
            };
            console.log('data', JSON.stringify(data));
            fs.writeFileSync("/var/www/backend_app/storage/swaps/"+currentBlock+ "-" + (new Date().getTime()), JSON.stringify(data, null, "\t"));
            console.log('success', success);

            console.log('gasPrice=' + swap.target.gasPrice);
            console.log('gasLimit=' + swap.target.gasLimit);
            //process.exit(1);
            /*console.log('wait...');
            const receipt = await target.wait();

            console.log('token0=' + token0);
            console.log('token1=' + token1);
            console.log('pair1.token0=' + pair1.token0);
            console.log('pair1.token1=' + pair1.token1);


            let status = true;
            for (const pair of [pair1, pair2]) {
                for (const log of receipt.logs.filter(log => log.address.toLowerCase() == pair.address)) {
                    try {
                        const reserve_estimate = [BigNumber.from(pair.reserve0), BigNumber.from(pair.reserve1)];

                        const result = iface.decodeEventLog('Sync', log.data, log.topics);
                        console.log('log: ', log);
                        console.log('reserves_real0=' + result[0], balanceHuman(result[0]));
                        console.log('reserves_real1=' + result[1], balanceHuman(result[1]));

                        console.log('reserve_estimate0=' + reserve_estimate[0], balanceHuman(reserve_estimate[0]));
                        console.log('reserve_estimate1=' + reserve_estimate[1], balanceHuman(reserve_estimate[1]));
                        if (reserve_estimate[0].eq(result[0]) && reserve_estimate[1].eq(result[1])) {
                            console.log(colors.green('RESERVERS OK'))
                        } else {
                            console.log(colors.red('RESERVERS WRONG'));
                            //status = false;
                        }
                        console.log('');
                    } catch (e) {
                        process.exit(1);
                    }
                }
            }

            if (items.length || !status) {
                process.exit(1);
            }*/
        }
    }
}


export const calculateswap = async (success, multiSwapContract: Contract, gasPrice: BigNumber, nonce: number, providers: JsonRpcProvider[]) => {
    try {
        let params = {
            nonce,
            gasLimit: BigNumber.from('2500000'),
            gasPrice: gasPrice,
        };
        let fee1 = success.fees[0];
        let fee2 = success.fees[1];
/*
        if(fee1 >= 10){
            fee1++;
        }
        if(fee2 >= 10){
            fee2++;
        }*/
        const tx = await multiSwapContract.swap(
            success.amountIn,
            success.pairs,
            success.path,
            [fee1, fee2],
            success.feeScales,
            params
        );
        return tx.hash;
        //swap.hash = tx.hash;
        //swap.gasPrice = success[0].gasPrice.toString();
        //swap.timeAfterBlock = (new Date().getTime() - this.lastBlockTime) / 1000 + ' sec'
        //fs.writeFileSync("/var/www/backend_app/storage/swaps/" + (new Date().getTime()), JSON.stringify(swap, null, "\t"));
        //const receipt = await tx.wait();
        //console.log('receipt', receipt);
    } catch (e) {
        console.log('swap ERROR', e.toString());
    }
}

const calculateswapRaw = async (success, multiSwapContract: Contract, gasPrice: BigNumber, nonce: number, providers: JsonRpcProvider[]) =>{

    const timeStart = new Date().getTime();
    const timing:any = {
    };
    let params = {
        nonce,
        gasLimit: BigNumber.from('2500000'),
        gasPrice: gasPrice,
    };

    let fee1 = success.fees[0];
    let fee2 = success.fees[1];

    const txNotSigned = await multiSwapContract.populateTransaction.swap(
        success.amountIn,
        success.pairs,
        success.path,
        [fee1, fee2],
        success.feeScales,
        params
    );
    const signedTx = await multiSwapContract.signer.signTransaction(txNotSigned);
    timing.sign = (new Date().getTime() - timeStart)/1000;
    const tx = await Promise.any(providers.map(provider=>{
        return provider.sendTransaction(signedTx);
    })).catch(error=>{
        console.log('error', error);
    });
    if(tx){
        console.log('tx send', tx.hash);
        timing.send = (new Date().getTime() - timeStart)/1000;
        return {hash: tx.hash, timing};
    }
}