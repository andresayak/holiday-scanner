import {TransactionResponse} from "@ethersproject/abstract-provider";
import {BigNumber, Contract} from "ethers";
import {ContractTransaction} from "@ethersproject/contracts";

type PropsType = {
    target: TransactionResponse;
    token0: string;
    token1: string;
    pair: string;
    amountIn: BigNumber;
    amountOut: BigNumber;
    multiSwapContract: Contract;
    fee: string;
    fee_scale: string;
}

export const sellTokens = async (props: PropsType): Promise<ContractTransaction> =>  {
    const {target, token0, token1, pair, fee, fee_scale, amountIn, amountOut, multiSwapContract} = props;

    console.log('Sell tokens: ');
    console.log(' - pair: '+pair);
    console.log(' - path: ', token0, token1);
    console.log(' - amountIn: '+amountIn);
    console.log(' - amountOut: '+amountOut);
    console.log(' - target gasPrice: '+target.gasPrice);

    let params:any = {
        gasLimit: BigNumber.from('300000'),
    };
    const min = 0;//1000000000;
    const gasPrice = target.gasPrice.sub(min);
    let maxPriorityFeePerGas = target.maxPriorityFeePerGas;
    let maxFeePerGas = target.maxFeePerGas;
    if (maxPriorityFeePerGas && maxFeePerGas) {
        maxPriorityFeePerGas = maxPriorityFeePerGas.sub(min);
        maxFeePerGas = maxFeePerGas.sub(min);
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
    return await multiSwapContract.swapExactTokensForETH([pair], [token0, token1],
        fee, fee_scale, params);
    /*
    return await multiSwapContract.swap(
        [pair],
        [token0, token1],
        [amountIn, amountOut],
        params
    );*/
}
