import {balanceHuman, calculate, getAmountOut} from "../../helpers/calc";
import {BigNumber, ethers} from "ethers";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {PairEntity} from "../../entities/pair.entity";
import * as colors from "colors";

type PropsType = {
    target: TransactionResponse;
    result: any;
    token0: string;
    token1: string;
    timeStart: Date;
    pairs: PairEntity[];
    pair: PairEntity;
    amountMaxIn: BigNumber;
}
export const swapExactETHForTokens = async (props: PropsType) => {
    const {
        target, result,
        token0, token1, timeStart,
        pairs, pair, amountMaxIn
    } = props;
    console.log(' - gasPrice:', target.gasPrice.toString());
    console.log(' - gasLimit:', target.gasLimit.toString());
    console.log(' - token0:', token0);//bnb
    console.log(' - token1:', token1);

    const amountOutMin = result.amountOutMin;
    const amountIn = target.value;
    console.log('wait pairs...');


    const fee = parseInt(pair.fee);
    const fee_scale = parseInt(pair.fee_scale);
    console.log('pair', pair.address);
    const reserves = pair.token1 === token0
        ? [BigNumber.from(pair.reserve0), BigNumber.from(pair.reserve1)] : [BigNumber.from(pair.reserve1), BigNumber.from(pair.reserve0)];
    console.log('reserve0=' + reserves[0]);
    console.log('reserve1=' + reserves[1]);
    let {
        amountInMy,
        amountOutMy,
        amountInMyMax,
        amountOutMyMax
    } = calculate(reserves[0], reserves[1], amountOutMin, amountIn, amountMaxIn, fee, fee_scale);
    if (amountInMyMax.lt(0) || (amountOutMyMax.lt(0))) {
        console.debug('debug', {
            reserves0: reserves[0].toString(),
            reserves1: reserves[0].toString(),
            amountInMy: amountInMyMax.toString(),
            amountOutMy: amountOutMyMax.toString(),
            amountIn: amountIn.toString(),
            amountOutMin: amountOutMin.toString(),
        });

        return;
    }
    console.log(' - amountInMy:', balanceHuman(amountInMy));
    console.log(' - amountOutMy:', ethers.utils.formatEther(amountOutMy));

    console.log(' - amountInMyMax:', balanceHuman(amountInMyMax));
    console.log(' - amountOutMyMax:', ethers.utils.formatEther(amountOutMyMax));


    const reserves_after_buy = [
        reserves[0].sub(amountOutMy),
        reserves[1].add(amountInMy),//BNB
    ];
    console.log(' - reserves0 after buy=' + reserves_after_buy[0]);
    console.log(' - reserves1 after buy=' + reserves_after_buy[1]);

    const amountOut_after_buy = getAmountOut(amountIn, reserves_after_buy[1], reserves_after_buy[0], fee, fee_scale);

    const reserves_after_target = [
        reserves_after_buy[0].sub(amountOut_after_buy),
        reserves_after_buy[1].add(amountIn),//BNB
    ];

    const amountSellIn = amountOutMy;

    const actualPairs = pairs.filter(pair =>
        (pair.token0 == token1 && pair.token1 == token0) || (pair.token1 == token1 && pair.token0 == token0)
    );

    let sell;
    for (const actualPair of actualPairs) {
        console.log('actualPair=' + actualPair.address);
        const fee = parseInt(actualPair.fee);
        const fee_scale = parseInt(actualPair.fee_scale);
        let reserves_before_sell;
        if (actualPair.address === pair.address) {
            reserves_before_sell = reserves_after_target;
        } else {
            reserves_before_sell = actualPair.token0 == token1
                ? [BigNumber.from(actualPair.reserve0), BigNumber.from(actualPair.reserve1)] : [BigNumber.from(actualPair.reserve1), BigNumber.from(actualPair.reserve0)];
        }
        console.log(' - reserves0 before sell=' + reserves_before_sell[0]);
        console.log(' - reserves1 before sell=' + reserves_before_sell[1]);

        const amountSellOut = getAmountOut(amountSellIn, reserves_before_sell[0], reserves_before_sell[1], fee, fee_scale);
        console.log(' - amountSellIn=' + amountSellIn);
        console.log(' - amountSellOut=' + amountSellOut);

        const amountBuy = amountInMy;
        const amountSell = amountSellOut;

        const targetGas = target.gasPrice.mul(target.gasLimit);
        console.log(' - targetGas=' + targetGas, balanceHuman(targetGas));

        const profitAmount = amountSell.sub(amountBuy);
        const profit = amountBuy.eq(0) ? 0 : (parseInt(profitAmount.mul(10000).div(amountBuy).toString()) / 100);
        if(profit>0)
            console.log(colors.bgGreen('profit=' + profit + '%, ' + balanceHuman(profitAmount)));
        else
            console.log(colors.bgRed('profit=' + profit + '%, ' + balanceHuman(profitAmount)));
        if (!sell || profit > sell.profit) {
            sell = {
                pair: actualPair,
                reserves,
                profit,
                profitAmount,
                amountIn: amountSellIn,
                amountOut: amountSellOut
            };
        }
    }
    const variants = [];
    /*for (const pairY of pairs) {
        if (pairY.address == pair.address) {
            continue
        }
        if (
            pairY.fee && pairY.fee_scale &&
            ((pairY.token0 === token1 && pairY.token1 === token0)
                || (pairY.token1 === token1 && pairY.token0 === token0))
        ) {
            variants.push({
                path: [token0, token1, token0],
                pairs: [pair.address, pairY.address],
                blockNumbers: [pair.blockNumber, pairY.blockNumber]
            });
        }
    }*/

    return {
        variants,
        buy: {
            pair,
            amountIn: amountInMy,
            amountOut: amountOutMy,
        },
        sell,
        timeStart
    };
}
