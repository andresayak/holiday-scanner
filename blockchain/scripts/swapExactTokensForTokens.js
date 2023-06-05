const {ethers} = require("hardhat");
const {utils} = require("ethers");
const {balanceHuman} = require("./helpers/calc");

async function main() {


    const [owner] = await ethers.getSigners();

    const balance = await owner.getBalance();
    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const router = await ethers.getContractAt("UniswapV2Router02", '0x10ed43c718714eb63d5aa57b78b54704e256024e');
    const factoryAddress = await router.factory();
    const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddress);
    const WETH = await ethers.getContractAt("WETH9", '0xba2ae424d960c26247dd6c32edc70b295c744c43');
    const token = await ethers.getContractAt("Token", '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56');

    const pairAddress = await factory.getPair(WETH.address, token.address);
    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
    const token0 = await pair.token0();
    let reservers = await pair.getReserves();

    reservers = WETH.address != token0?reservers : [reservers[1], reservers[0]];
    console.log("\n");
    console.log('reserves0 = ', reservers[0].toString(), balanceHuman(reservers[0]));
    console.log('reserves1 = ', reservers[1].toString(), balanceHuman(reservers[1]));


    const amountIn = utils.parseEther("100");
    const amountOutMin = (await router.getAmountOut(amountIn, reservers[0], reservers[1])).mul(996).div(1000);//0.4% slipping
    console.log('amountIn = '+amountIn);
    console.log('amountOutMin = '+amountOutMin);
    //return;

    const approveTx = await WETH.approve(router.address, amountIn);
    const receiptTx = await approveTx.wait();
    let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
    const txSwap = await router.populateTransaction.swapExactTokensForTokens(amountIn, amountOutMin, [
            WETH.address,
            token.address,
        ], owner.address,
        deadline,
        {
            gasPrice: '5000000000',
        }
    );

    const txSwapSign = await owner.sendTransaction(txSwap);
    console.log('Swapped! tx_hash=' + txSwapSign.hash);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
