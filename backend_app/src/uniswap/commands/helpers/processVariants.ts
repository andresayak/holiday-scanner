import {tokens} from "../../helpers/calc";
import {processFindSuccess} from "./processFindSuccess";
import {BigNumber} from "ethers";
import {VariantType} from "./getVariants";

export type PairsType = {
    id: number,
    address: string,
    factory: string,
    token0: string,
    token1: string,
    reserve0: string,
    reserve1: string,
    blockNumber: number,
    transactionIndex: number,
    logIndex: number,
    fee: number | null,
    fee_scale: number | null
}[];
export const processVariants = (props: {
    pairs: PairsType, gasPrice: BigNumber, gasLimit: BigNumber
}) => {
    const {pairs, gasPrice, gasLimit} = props;
    const variants: VariantType[] = [];
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
                    pairY.fee && pairY.fee_scale &&
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
    console.log('variants', variants.length);
    //return processFindSuccess({variants, pairs, gasPrice, gasLimit});


}
