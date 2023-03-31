import {BigNumber, utils} from "ethers";

export const BNB_PRICE_USD = 300;
export const BNB_CONTRACT = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

export const tokens = [
    BNB_CONTRACT.toLowerCase(),
    '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    //'0x55d398326f99059ff775485246999027b3197955',
    //'0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
];
export const sortTokens = (tokenA: string, tokenB: string): [string, string] => {
    return BigNumber.from(tokenA).lt(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];
}
const balanceHuman = (value: BigNumber | number | string, tokenAddress?: string) => {
    const price = !tokenAddress || tokenAddress.toLowerCase() == BNB_CONTRACT.toLowerCase() ? BNB_PRICE_USD : 1;
    const symbol = !tokenAddress || tokenAddress.toLowerCase() == BNB_CONTRACT.toLowerCase() ? 'BNB' : 'USD';
    if (symbol == 'BNB') {
        const totalSum = Math.ceil(100 * price * parseFloat(utils.formatEther(value))) / 100;
        return utils.formatEther(value) + ' BNB, ' + totalSum + ' USD';
    }
    return utils.formatEther(value) + ' ' + symbol;
}

export const calcInterestDiff = (value0: BigNumber, diff: BigNumber) => {
    return value0.eq(0) ? 0 : (parseInt(diff.mul(10000).div(value0).toString()) / 100);
}

const calcProfit = (buy: BigNumber, sell: BigNumber) => {
    const diff = sell.sub(buy);
    const profit = buy.eq(0) ? 0 : (parseInt(diff.mul(10000).div(buy).toString()) / 100);
    console.log('profit=' + profit + '%, ' + balanceHuman(diff));
    return profit;
}

const getAmountIn = (amountOut: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber, fee: number = 25, fee_scale: number = 10000) => {
    const numerator = reserveIn.mul(amountOut).mul(fee_scale);
    const denominator = reserveOut.sub(amountOut).mul(fee_scale - fee);//fee: 0.25 %
    return numerator.div(denominator).add(1);
}

const getAmountOut = (amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber, fee: number, fee_scale: number = 10000) => {
    const amountInWithFee = amountIn.mul(fee_scale - fee);//fee: 0.25 %
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(fee_scale).add(amountInWithFee);
    return numerator.div(denominator);
}

const calculate = (reserveIn: BigNumber, reserveOut: BigNumber, amountOutMin: BigNumber, amountIn: BigNumber, limit: BigNumber, fee: number, fee_scale: number) => {
    const amountOut = getAmountOut(amountIn, reserveOut, reserveIn, fee, fee_scale);
    let amountOutMy = amountOut.sub(amountOutMin).mul(Math.ceil((10 + Math.PI) * 100)).div(1000);
    if (amountOutMy.gt(reserveIn)) {
        amountOutMy = reserveIn.sub(1).sub(amountOutMin).div(2);
    }

    if (amountOutMy.lt(0)) {
        throw Error('amountOutMy less zero');
    }

    let amountInMy = getAmountIn(amountOutMy, reserveOut, reserveIn, fee, fee_scale);//ETH

    const amountInMyMax = amountInMy;
    const amountOutMyMax = amountOutMy;

    if (limit && limit.lt(amountInMy)) {
        amountInMy = limit;
        amountOutMy = getAmountOut(amountInMy, reserveOut, reserveIn, fee, fee_scale);
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
