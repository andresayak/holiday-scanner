const {ethers} = require("hardhat");
const {utils} = require("ethers");
const {expect} = require("chai");
const helpers =  require("@nomicfoundation/hardhat-network-helpers");
const swapInterface = [
    'event Sync(uint112 reserve0, uint112 reserve1)',
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
];
const iface = new utils.Interface(swapInterface);

const checkPairTarget = async (pairAddress, reserves, token) => {
    const pair0Contract = await ethers.getContractAt("UniswapV2Pair", pairAddress);
    const reservesContract = await pair0Contract.getReserves();
    const token0 = await pair0Contract.token0();
    const token1 = await pair0Contract.token1();
    console.log('reservesContract0=' + reservesContract[0]);
    console.log('reservesContract1=' + reservesContract[1]);
    if (token0.toLowerCase() == token) {
        expect(reserves[0]).to.equal(reservesContract[0]);
        expect(reserves[1]).to.equal(reservesContract[1]);
    } else {
        expect(token1.toLowerCase()).to.equal(token);
        expect(reserves[0]).to.equal(reservesContract[1]);
        expect(reserves[1]).to.equal(reservesContract[0]);
    }
}

const checkAmounts = async (data) => {
    const [owner] = await ethers.getSigners();
    const {success, block, target, after, before} = data;

    const currentBlock = await ethers.provider.getBlockNumber();
    expect(currentBlock).to.equal(block);

    await checkPairTarget(before['pair0']['address'], [before['pair0']['reserve0'], before['pair0']['reserve1']], before['pair0']['token0']);
    if (before['pair1'])
        await checkPairTarget(before['pair1']['address'], [before['pair1']['reserve0'], before['pair1']['reserve1']], before['pair1']['token0']);

    await helpers.impersonateAccount(target.from);
    const targetSigner = await ethers.getSigner(target.from);
    const router = await ethers.getContractAt('UniswapV2Router02', target.to, owner);

    let txSwap;
    if (target.method == 'swapExactTokensForTokens') {
        txSwap = await router.connect(targetSigner).swapExactTokensForTokens(
            target.params.amountIn,
            target.params.amountOutMin,
            target.params.path,
            owner.address,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );
    } else if (target.method == 'swapExactTokensForETH') {
        txSwap = await router.connect(targetSigner).swapExactTokensForETH(
            target.params.amountIn,
            target.params.amountOutMin,
            target.params.path,
            owner.address,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );
    } else if(target.method == 'swapExactETHForTokens') {
        txSwap = await router.connect(targetSigner).swapExactETHForTokens(
            target.params.amountOutMin,
            target.params.path,
            owner.address,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                value: target.params.amountIn,
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );
    }else if(target.method == 'swapTokensForExactTokens') {
        txSwap = await router.connect(targetSigner).swapTokensForExactTokens(
            target.params.amountOut,
            target.params.amountInMax,
            target.params.path,
            owner.address,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                value: target.params.amountIn,
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );
    }else{
        throw Error('wrong method [' + target.method + '] ');
    }

    console.log('tx', txSwap.hash);
    const txSwapReceipt = await txSwap.wait();

    console.log('amounts pair0:');
    const events0 = txSwapReceipt.events.filter((log) => log.address.toLowerCase() == before.pair0.address);
    for (const log of events0) {
        let result;
        try {
            result = iface.decodeEventLog('Swap', log.data, log.topics);
            console.log('result', result);
        } catch (e) {
        }
        if (result) {
            console.log('amount1In=' + after.amountRealIn0);
            console.log('amount0Out=' + after.amountRealOut0);
            if(before.pair0.token0 == target.params.path[0].toLowerCase()){
                expect(result['amount0In']).to.equal(after.amountRealIn0);
                expect(result['amount1Out']).to.equal(after.amountRealOut0);
            }else {
                expect(result['amount1In']).to.equal(after.amountRealIn0);
                expect(result['amount0Out']).to.equal(after.amountRealOut0);
            }
            continue;
        }
    }
    if (before['pair1']) {
        console.log('amounts pair1:');
        const events1 = txSwapReceipt.events.filter((log) => log.address.toLowerCase() == before.pair1.address);
        for (const log of events1) {
            let result;
            try {
                result = iface.decodeEventLog('Swap', log.data, log.topics);
                console.log('result', result);
            } catch (e) {
            }
            if (result) {
                console.log('amount1In=' + after.amountRealIn1);
                console.log('amount0Out=' + after.amountRealOut1);
                if (before.pair1.token0 == target.params.path[1].toLowerCase()) {
                    expect(result['amount0In']).to.equal(after.amountRealIn1);
                    expect(result['amount1Out']).to.equal(after.amountRealOut1);
                } else {
                    expect(result['amount1In']).to.equal(after.amountRealIn1);
                    expect(result['amount0Out']).to.equal(after.amountRealOut1);
                }
                continue;
            }
        }
    }

    await checkPairTarget(before['pair0']['address'], after['reserves0'], before['pair0']['token0']);
    if (before['pair1'])
        await checkPairTarget(before['pair1']['address'], after['reserves1'], before['pair1']['token0']);
}

module.exports = {
    checkPairTarget, checkAmounts
};
