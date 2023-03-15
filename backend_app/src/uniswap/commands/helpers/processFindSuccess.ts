import {balanceHuman, BNB_CONTRACT, getAmountOut} from "../../helpers/calc";
import {BigNumber, utils} from "ethers";
import {PairsType, VariantType} from "./processVariants";

export type SuccessType = {
    amountIn: string;
    amountOut: string;
    amountOutsMin: string[];
    reservers0: [string, string];
    reservers1: [string, string];
    pairs: string[];
    blockNumbers: number[];
    path: string[];
    gasPrice: BigNumber;
    gasLimit: BigNumber;
    profit: number;
    profit_real: string;
}
type PropsType = {
    variants: VariantType[];
    pairs: PairsType;
    gasPrice: BigNumber;
    gasLimit: BigNumber;
}

export const processFindSuccess = (props: PropsType): SuccessType[] => {
    const {variants, pairs, gasPrice, gasLimit} = props;
    let success: SuccessType[] = [];
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
                amountOutsMin.push(getAmountOut(amountInCurrent, reserve0, reserve1, pair.fee, pair.fee_scale));
                reservers.push([reserve0, reserve1]);
            }
        }
        const amountOut = BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
        const _gasPrice = gasPrice.add(gasPrice.mul(30).div(100));
        const gas = _gasPrice.mul(gasLimit);
        const profit = amountOut.sub(amountIn).sub(gas).mul(10000).div(amountIn);
        const real = amountIn.mul(profit).div(1000);
        if (status) {
            success.push({
                amountIn: amountIn.toString(),
                amountOut: amountOut.toString(),
                amountOutsMin: amountOutsMin.map(amountOutMin => amountOutMin.toString()),
                reservers0: [reservers[0][0].toString(), reservers[0][1].toString()],
                reservers1: [reservers[1][0].toString(), reservers[1][1].toString()],
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
    console.log('success', success.length);

    if (success.length) {
        const mostSuccess = success[0];
        console.log('mostSuccess', mostSuccess, [
            mostSuccess.pairs,
            mostSuccess.path,
            mostSuccess.amountOutsMin,
        ]);
    }
    return success;
}
