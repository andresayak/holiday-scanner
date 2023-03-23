import {tokens} from "../../helpers/calc";
import {processFindSuccess} from "./processFindSuccess";
import {BigNumber} from "ethers";

export type VariantType = {
    path: string[],
    pairs: string[],
    //blockNumbers: number[]
}
export type PairsType = {
    id: number,
    address: string,
    factory: string,
    token0: string,
    token1: string,
    reserve0: string,
    reserve1: string,
   // blockNumber: number,
    transactionIndex: number,
    logIndex: number,
    fee: number | null,
    fee_scale: number | null
}[];
export const getVariants = (pairs: {
    address: string,
    token0: string,
    token1: string,
    //blockNumber: number;
    fee: string,
    fee_scale: string
}[]): VariantType[] => {
    const variants: VariantType[] = [];
    let i = 0;
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
                    ((pairY.token0 === tokenOut && pairY.token1 === tokenIn)
                        || (pairY.token1 === tokenOut && pairY.token0 === tokenIn))
                ) {
                    variants.push({
                        path: [tokenIn, tokenOut, tokenIn],
                        pairs: [pairX.address, pairY.address],
                        //blockNumbers: [pairX.blockNumber, pairY.blockNumber]
                    });
                }
            }
        }
    }
    return variants;
}
