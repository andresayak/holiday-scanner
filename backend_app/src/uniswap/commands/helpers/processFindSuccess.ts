import {balanceHuman, BNB_CONTRACT, BNB_PRICE_USD, getAmountOut} from "../../helpers/calc";
import {BigNumber, utils} from "ethers";
import {PairEntity} from "../../entities/pair.entity";
import {VariantType} from "./getVariants";

export type SuccessType = {
    amountIn: string;
    amountOut: string;
    amountOutsMin: string[];
    reservers0: [string, string];
    reservers1: [string, string];
    pairs: string[];
    //blockNumbers: number[];
    path: string[];
    gasPrice?: BigNumber;
    //gasLimit: BigNumber;
    profit: number;
    fees: any[];
    feeScales: any[];
    profit_real: string;
    swaps?: any[];
    amountInUsd: number;
}
type PropsType = {
    variants: VariantType[];
    pairs: { [k: string]: PairEntity };
    onlyPairs?: string[];
    amount0: string;
    amount1: string;
    //gasPrice: BigNumber;
    //gasLimit: BigNumber;
}

type SwapPropsType = {
    variants: VariantType[];
    pairs: PairEntity[];
    swaps: Swap[];
    //gasPrice: BigNumber;
    //gasLimit: BigNumber;
}

export type Swap = {
    hash: string;
    factory: string;
    path: string[],
    amountOutMin?: BigNumber;
    amountOut?: BigNumber;
    amountInMax?: BigNumber;
    amountIn?: BigNumber;
    gasPrice: BigNumber;
    deadline: number;
}

const updateReserves = (prev, factory, updatePairs, token0: string, token1: string, amountIn, amountOut) => {
    const pair = prev.find(pair => pair.factory == factory
        && (
            (pair.token0 == token0 && pair.token1 == token1) || (pair.token1 == token0 && pair.token0 == token1)
        )
    );
    if (pair) {
        console.log('pair', pair);
        const reserves = pair.token1 === token0
            ? [BigNumber.from(pair.reserve0), BigNumber.from(pair.reserve1)] : [BigNumber.from(pair.reserve1), BigNumber.from(pair.reserve0)];

        let amountInReal, amountRealOut;
        if (amountIn && amountIn.gte(0)) {
            amountRealOut = getAmountOut(amountIn, reserves[1], reserves[0], pair.fee, pair.fee_scale);
            if (amountRealOut.lt(0)) {
                console.log('amountIn=' + amountIn);
                console.log('reserves0=' + reserves[0]);
                console.log('reserves1=' + reserves[1]);
                throw Error('amountOut less zero');
            }
        }

        const reserves_after = [
            reserves[0].sub(amountRealOut),
            reserves[1].add(amountInReal),//BNB
        ];
        console.log('reserves_after0=' + reserves_after[0]);
        console.log('reserves_after1=' + reserves_after[1]);
        prev = prev.map((item) => {
            if (item.id == pair.id) {
                if (pair.token1 === token0) {
                    return {
                        ...item,
                        reserve0: reserves_after[0].toString(),
                        reserve1: reserves_after[1].toString()
                    }
                } else {
                    return {
                        ...item,
                        reserve0: reserves_after[1].toString(),
                        reserve1: reserves_after[0].toString()
                    }
                }
            }
            return item;
        });
        updatePairs.push(pair.address);
        return {amountInReal, amountRealOut};
    }
    return null;
}
/*
export const processSwap = (props: SwapPropsType): SuccessType[] => {
    const {variants, pairs, swaps} = props;
    let success: SuccessType[] = [];
    let prev = pairs;
    const items = processFindSuccess({variants, pairs: prev});
    for (const item of items) {
        success.push({
            ...item,
            gasPrice: BigNumber.from('9000000000')
        });
    }
    return success;

    let updatePairs = [];
    for (const index in swaps) {
        const swap = swaps[index];
        const token0 = swap.path[0].toLowerCase();
        const token1 = swap.path[1].toLowerCase();
        const token2 = swap.path[2]?.toLowerCase();
        if(token2){
            const result = updateReserves(prev , swap.factory, updatePairs, token0, token1, swap.amountIn, 0);
            if(!result){
                console.log('pair not found, stop process swaps');
                return [];
            }
            updateReserves(prev , swap.factory, updatePairs, token1, token2, result.amountRealOut, swap.amountOut);
        }else{
            const result = updateReserves(prev , swap.factory, updatePairs, token1, token2, swap.amountIn, swap.amountOut);
            if(!result){
                console.log('pair not found, stop process swaps');
                return [];
            }
        }
        const items = processFindSuccess({variants, pairs: prev, onlyPairs: updatePairs});
        for (const item of items) {
            success.push({
                ...item,
                swaps: swaps.filter((item, i) => i <= parseInt(index)).map(swap => {
                    return {
                        ...swap,
                        amountOutMin: swap.amountOutMin?.toString(),
                        amountIn: swap.amountIn?.toString(),
                        gasPrice: swap.gasPrice?.toString(),
                        amountInMax: swap.amountInMax?.toString(),
                        amountOut: swap.amountOut?.toString(),
                    };
                }),
                gasPrice: swap.gasPrice
            });
        }
    }
    return success
        .sort((a, b) => (b.profit - a.profit));
}*/
export const processFindSuccess = (props: PropsType): SuccessType[] => {
    const {variants, pairs, amount0, amount1} = props;
    let success: SuccessType[] = [];
    let cases = [];
    for (const variant of variants) {
        const reserves = [];
        const fees = [];
        const feeScales = [];
        for (const index in variant.pairs) {
            const pairAddress = variant.pairs[index];
            if (pairs[pairAddress]) {
                const pair = pairs[pairAddress];
                if(pair.fee){
                    const token0 = variant.path[index];
                    const reserve0 = BigNumber.from(token0 == pair.token0 ? pair.reserve0 : pair.reserve1);
                    const reserve1 = BigNumber.from(token0 == pair.token0 ? pair.reserve1 : pair.reserve0);
                    reserves.push([reserve0, reserve1]);
                    fees.push(pair.fee);
                    feeScales.push(pair.fee_scale);
                }
            } else {
                break;
            }
        }
        if (reserves.length == variant.pairs.length) {
            cases.push({
                variant,
                reserves,
                fees,
                feeScales
            });
        }
    }

    console.log('cases', cases.length);
    for (const item of cases) {
        const {variant, reserves, fees, feeScales} = item;
        const maxAmountIn = variant.path[0] == BNB_CONTRACT.toLowerCase() ? utils.parseEther(amount0) : utils.parseEther(amount1);
        let maxProfit = BigNumber.from('0');
        let maxRealProfit = BigNumber.from('0');
        let optimalAmountIn = BigNumber.from('0');
        let optimalAmountOut = BigNumber.from('0');
        let optimalAmountOutsMin = [];
        const step = maxAmountIn.div(10);
        for (let amountIn = step; amountIn.lte(maxAmountIn); amountIn = amountIn.add(step)) {
            let amountOutsMin = [];
            for (const index in variant.pairs) {
                const amountInCurrent = parseInt(index) == 0 ? amountIn : amountOutsMin[parseInt(index) - 1];
                amountOutsMin.push(getAmountOut(amountInCurrent, reserves[index][0], reserves[index][1], fees[index], feeScales[index]));
            }
            const amountOut = BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
            const profit = amountOut.sub(amountIn).mul(10000).div(amountIn);
            const real = amountIn.mul(profit).div(10000);

            if (real.gt(maxRealProfit)) {
                maxProfit = profit;
                maxRealProfit = real;
                optimalAmountIn = amountIn;
                optimalAmountOut = amountOut;
                optimalAmountOutsMin = amountOutsMin;
            }
            if(real.gt(0) && !real.gt(maxRealProfit)){
                break;
            }
        }
        const profitNumber = parseInt(maxProfit.toString()) / 100;
        if (profitNumber > 0 && maxRealProfit) {
            console.log('profitNumber=' + profitNumber);
            console.log('maxRealProfit=' + maxRealProfit);
            const price = variant.path[0] == BNB_CONTRACT.toLowerCase() ? BNB_PRICE_USD : 1;
            const amountInUsd = price * parseFloat(utils.formatEther(maxRealProfit));
            if (profitNumber >= 0.5 && amountInUsd > 1) {
                success.push({
                    amountIn: optimalAmountIn.toString(),
                    amountOut: optimalAmountOut.toString(),
                    amountOutsMin: optimalAmountOutsMin.map(amountOutMin => amountOutMin.toString()),
                    reservers0: [reserves[0][0].toString(), reserves[0][1].toString()],
                    reservers1: [reserves[1][0].toString(), reserves[1][1].toString()],
                    pairs: variant.pairs,
                    //blockNumbers: variant.blockNumbers,
                    path: variant.path,
                    fees,
                    feeScales,
                    profit: profitNumber,
                    profit_real: balanceHuman(maxRealProfit, variant.path[0]),
                    amountInUsd
                });
            }
        }
    }
    /*
    for (const variant of variants) {
        const amountIn = variant.path[0] == BNB_CONTRACT.toLowerCase() ? utils.parseEther(amount0) : utils.parseEther(amount1);
        let amountOutsMin = [];
        let fees = [];
        let feeScales = [];
        let reservers = [];
        for (const index in variant.pairs) {
            const pairAddress = variant.pairs[index];
            if (pairs[pairAddress]) {
                const pair = pairs[pairAddress];
                const token0 = variant.path[index];
                const reserve0 = BigNumber.from(token0 == pair.token0 ? pair.reserve0 : pair.reserve1);
                const reserve1 = BigNumber.from(token0 == pair.token0 ? pair.reserve1 : pair.reserve0);
                const amountInCurrent = parseInt(index) == 0 ? amountIn : amountOutsMin[parseInt(index) - 1];
                amountOutsMin.push(getAmountOut(amountInCurrent, reserve0, reserve1, parseInt(pair.fee), parseInt(pair.fee_scale)));
                reservers.push([reserve0, reserve1]);
                fees.push(pair.fee);
                feeScales.push(pair.fee_scale);
            }else{
                break;
            }
        }
        if(amountOutsMin.length == 0 || reservers.length!=2){
            continue;
        }
        const amountOut = BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
        //const _gasPrice = gasPrice.add(gasPrice.mul(30).div(100));
        //const gas = _gasPrice.mul(gasLimit);
        const profit = amountOut.sub(amountIn).mul(10000).div(amountIn);
        const real = amountIn.mul(profit).div(1000);
        const profitNumber = parseInt(profit.toString()) / 100;
        if (profitNumber >= 0.5) {
            success.push({
                amountIn: amountIn.toString(),
                amountOut: amountOut.toString(),
                amountOutsMin: amountOutsMin.map(amountOutMin => amountOutMin.toString()),
                reservers0: [reservers[0][0].toString(), reservers[0][1].toString()],
                reservers1: [reservers[1][0].toString(), reservers[1][1].toString()],
                pairs: variant.pairs,
                //blockNumbers: variant.blockNumbers,
                path: variant.path,
                fees,
                feeScales,
                //gasPrice: _gasPrice,
                //gasLimit: gasLimit,
                profit: profitNumber,
                profit_real: balanceHuman(real, variant.path[0])
            });
        }
    }*/
    return success
        .sort((a, b) => (b.amountInUsd - a.amountInUsd));
}
