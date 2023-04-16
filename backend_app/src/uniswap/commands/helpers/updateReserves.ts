import {BigNumber} from "ethers";
import {getAmountIn, getAmountOut} from "../../helpers/calc";

export const updateReserves = (pair, token0: string, amountIn: BigNumber, amountOut: BigNumber, amountOutMin: BigNumber, amountInMax: BigNumber) => {

    const reserves = pair.token0 === token0
        ? [pair.reserve0, pair.reserve1] : [pair.reserve1, pair.reserve0];


    if(pair.token0 !== token0 && pair.token1 !== token0){
        throw Error('invalid pair, not have tokens');
    }
    let amountRealIn, amountRealOut;
    let reserves_after;
    if (amountIn && amountIn.gt(0)) {
        amountRealIn = amountIn;
        amountRealOut = getAmountOut(amountIn, reserves[0], reserves[1], pair.fee, pair.fee_scale);
        if (amountOutMin && amountOutMin.gt(0) && amountOutMin.gt(amountRealOut)) {
            throw new Error('amountRealOut less amountOutMin');
            return;
        }
    }else if (amountOut && amountOut.gt(0)) {
        amountRealOut = amountOut;
        amountRealIn = getAmountIn(amountOut, reserves[0], reserves[1], pair.fee, pair.fee_scale);
        if (amountInMax && amountInMax.gt(0) && amountInMax.lt(amountRealIn)) {
            console.log('amountIn='+amountIn);
            console.log('amountOut='+amountOut);
            throw new Error('amountInReal more amountInMax');
            return;
        }
    }else {
        throw new Error('amountIn and amountOut not present');
    }
    console.log('amountRealIn='+amountRealIn);
    console.log('amountRealOut='+amountRealOut);

    reserves_after = [
        reserves[0].add(amountRealIn),//.sub(amountRealOut),
        reserves[1].sub(amountRealOut),//.add(amountRealIn),//BNB
    ];

    if (pair.token0 === token0) {
        pair.reserve0 = reserves_after[0];
        pair.reserve1 = reserves_after[1];
    } else {
        pair.reserve0 = reserves_after[1];
        pair.reserve1 = reserves_after[0];
    }
    return {amountRealIn, amountRealOut, pair};
}
