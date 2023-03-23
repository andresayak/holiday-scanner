import {TransactionResponse} from "@ethersproject/abstract-provider";
import {BigNumber, Contract} from "ethers";
import {ContractTransaction} from "@ethersproject/contracts";

type PropsType = {
    target: TransactionResponse;
    token0: string;
    token1: string;
    pair: string;
    amountOut: BigNumber;
    amountIn: BigNumber;
    multiSwapContract: Contract
}

export const buyTokens = async (props: PropsType): Promise<ContractTransaction> => {
    const {target, token0, token1, pair, amountOut, amountIn, multiSwapContract} = props;

    console.log('Buy tokens: ');
    console.log(' - pair: '+pair);
    console.log(' - path: ', token0, token1);
    console.log(' - amountIn: '+amountIn);
    console.log(' - amountOut: '+amountOut);
    console.log(' - target gasPrice: '+target.gasPrice);

    let params:any = {
        gasLimit: BigNumber.from('200000'),
    };
    const gasPrice = target.gasPrice.add(10000000000);
    if (target.maxPriorityFeePerGas && target.maxFeePerGas) {
        const maxPriorityFeePerGas = target.maxPriorityFeePerGas.add(1000000000);
        const maxFeePerGas = target.maxFeePerGas.add(1000000000);
        params = {
            ...params,
            type: 2,
            accessList: [],
            maxPriorityFeePerGas,
            maxFeePerGas,
        }
        console.log(' - maxPriorityFeePerGas: '+maxPriorityFeePerGas);
        console.log(' - maxFeePerGas: '+maxFeePerGas);
    } else {
        params = {
            ...params,
            type: 0,
            gasPrice
        }
        console.log(' - gasPrice: '+gasPrice);
    }

    return await multiSwapContract.swap(
        [pair],
        [token0, token1],
        [amountIn, amountOut],
        params
    );
}
