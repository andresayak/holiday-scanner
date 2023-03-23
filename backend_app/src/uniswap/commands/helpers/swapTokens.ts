import {BigNumber, Contract} from "ethers";
import {TransactionResponse} from "@ethersproject/abstract-provider";

type PropsType ={
    target: TransactionResponse;
    pairs: string[];
    path: string[];
    amountIn: string;
    amountOutsMin: string[];
    multiSwapContract: Contract
}

export const swapTokens = async (props:PropsType) => {
    const {target, pairs, path, amountIn, amountOutsMin, multiSwapContract} = props;
    let params;
    if (target) {
        const gasPrice = target.gasPrice;
        const maxPriorityFeePerGas = target.maxPriorityFeePerGas;
        const maxFeePerGas = target.maxFeePerGas;
        if (maxPriorityFeePerGas && maxFeePerGas) {
            params = {
                type: 2,
                accessList: [],
                maxPriorityFeePerGas,
                maxFeePerGas,
            }
        } else {
            params = {
                gasPrice
            }
        }
    } else {
        params = {
            gasLimit: BigNumber.from('500000'),
            gasPrice: BigNumber.from('5000000000'),
        };
    }
    const tx = await multiSwapContract.swap(
        pairs,
        path,
        [amountIn, ...amountOutsMin],
        params
    );

    console.log('tx send', tx.hash);
    return tx.wait();
}
