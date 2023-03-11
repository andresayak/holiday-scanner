import {BigNumber, utils} from "ethers";

const BNB_PRICE_USD = 300;

const balanceHuman = (value: BigNumber | number | string) => {
    const totalSum = BNB_PRICE_USD * parseFloat(utils.formatEther(value));
    return utils.formatEther(value) + ' BNB, ' + totalSum + ' USD';
}

const calcProfit = (buy: BigNumber, sell: BigNumber) => {
    console.log('buy=' + buy, balanceHuman(buy));
    console.log('sell=' + sell, balanceHuman(sell));

    const diff = sell.sub(buy);
    const profit = parseInt(diff.mul(10000).div(buy).toString()) / 100;
    console.log('profit=' + profit + '%, ' + balanceHuman(diff));
    return profit;
}

const getAmountIn = (amountOut: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber) => {
    const numerator = reserveIn.mul(amountOut).mul(10000);
    const denominator = reserveOut.sub(amountOut).mul(9975);//fee: 0.25 %
    return numerator.div(denominator).add(1);
}

const getAmountOut = (amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber) => {
    const amountInWithFee = amountIn.mul(9975);//fee: 0.25 %
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(10000).add(amountInWithFee);
    return numerator.div(denominator);
}

const calculate = (reserve0: BigNumber, reserve1: BigNumber, amountOutMin: BigNumber, amountIn: BigNumber, limit?: BigNumber) => {
    const amountOut = getAmountOut(amountIn, reserve1, reserve0);
    let amountOutMy = amountOut.sub(amountOutMin).mul(Math.ceil((10 + Math.PI) * 100)).div(1000);
    if (amountOutMy.gt(reserve0)) {
        amountOutMy = reserve0.sub(1).sub(amountOutMin).div(2);
    }
    console.log('amountOut=' + amountOut);
    console.log('amountOutMy=' + amountOutMy);
    console.log('amountOutMin=' + amountOutMin);

    if (amountOutMy.lt(0)) {
        throw Error('amountOutMy less zero');
    }
    console.log('amountOutMy=' + amountOutMy);
    console.log('reserve0=' + reserve0);
    console.log('reserve1=' + reserve1);
    let amountInMy = getAmountIn(amountOutMy, reserve1, reserve0);//ETH
    console.log('amountInMy=' + amountInMy);

    const amountInMyMax = amountInMy;
    const amountOutMyMax = amountOutMy;

    if (limit && limit.lt(amountInMy)) {
        amountInMy = limit;
        amountOutMy = getAmountOut(amountInMy, reserve1, reserve0);
    }
    return {
        amountOut,
        amountInMy,
        amountOutMy,
        amountInMyMax,
        amountOutMyMax,
    };
}

export {
    calculate,
    getAmountOut,
    getAmountIn,
    calcProfit,
    balanceHuman
};
