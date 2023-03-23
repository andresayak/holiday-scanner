import {Contract, ContractFactory} from "ethers";
import * as UniswapV2Pair from "../../../contracts/UniswapV2Pair.json";
import {swapTokens} from "./swapTokens";
import {PairsType} from "./processVariants";
import {SuccessType} from "./processFindSuccess";

type PropsType = {
    target?;
    success: SuccessType;
    blockNumber: number;
    liveCount: number;
    pairs: PairsType;
    multiSwapContract: Contract
}

export const MakeTrade = async (props: PropsType) => {
    const {
        target = null, success, blockNumber, liveCount, pairs, multiSwapContract
    } = props;
    const pair0 = pairs.find(pair => pair.address == success.pairs[0]);
    const pair1 = pairs.find(pair => pair.address == success.pairs[1]);

    const minBlock = blockNumber - liveCount + 1;
    const livePairs = (pair0.blockNumber >= minBlock && pair1.blockNumber >= minBlock);
    console.log('pair0', pair0);
    console.log('pair1', pair1);
    console.log('livePairs', livePairs);
    let matchResources = true;
    if (!livePairs) {
        const pair0Contract = ContractFactory.getContract(success.pairs[0], UniswapV2Pair.abi, multiSwapContract.signer);
        const pair1Contract = ContractFactory.getContract(success.pairs[1], UniswapV2Pair.abi, multiSwapContract.signer);

        let reserves0 = await pair0Contract.getReserves();
        if (pair0.token0 == success.path[1]) {
            reserves0 = [reserves0[1], reserves0[0]];
        }
        let reserves1 = await pair1Contract.getReserves();
        if (pair1.token1 == success.path[1]) {
            reserves1 = [reserves1[1], reserves1[0]];
        }
        console.log('reserves00=' + reserves0[0] + ', ' + success.reservers0[0]);
        console.log('reserves01=' + reserves0[1] + ', ' + success.reservers0[1]);
        console.log('reserves10=' + reserves1[0] + ', ' + success.reservers1[0]);
        console.log('reserves11=' + reserves1[1] + ', ' + success.reservers1[1]);


        if (!reserves0[0].eq(success.reservers0[0])) {
            console.log('fail 00');
            matchResources = false;
        }
        if (!reserves0[1].eq(success.reservers0[1])) {
            console.log('fail 010');
            matchResources = false;
        }
        if (!reserves1[0].eq(success.reservers0[0])) {
            console.log('fail 10');
            matchResources = false;
        }
        if (!reserves1[1].eq(success.reservers0[1])) {
            console.log('fail 11');
            matchResources = false;
        }
        console.log('matchResources', matchResources);
    }

    return swapTokens({
        target, pairs: success.pairs, path: success.path,
        amountIn: success.amountIn, amountOutsMin: success.amountOutsMin,
        multiSwapContract
    });
}
