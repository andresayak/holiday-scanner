const {ethers} = require("hardhat");
const {utils} = require("ethers");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    if (!process.env['ROUTER_ADDRESS'] || !process.env['WETH_ADDRESS'] || !process.env['TOKEN0_ADDRESS'] || !process.env['TOKEN1_ADDRESS']) {
        throw new Error('wrong env')
    }

    const [owner] = await ethers.getSigners();

    const factory = await ethers.getContractAt("UniswapV2Factory", process.env['FACTORY_ADDRESS']);

    const router = await ethers.getContractAt("UniswapV2Router02", process.env['ROUTER_ADDRESS']);
    const WETH = await ethers.getContractAt("WETH9", process.env['WETH_ADDRESS']);
    const token = await ethers.getContractAt("Token", process.env['TOKEN0_ADDRESS']);

    const pairAddress = await factory.getPair(WETH.address, token.address);
    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
    const token0 = await pair.token0();
    let reservers = await pair.getReserves();

    reservers = WETH.address == token0?reservers : [reservers[1], reservers[0]];
    console.log("\n");
    console.log('reserves0 before = ', reservers[0].toString(), balanceHuman(reservers[0]));
    console.log('reserves1 before = ', reservers[1].toString(), balanceHuman(reservers[1]));

    let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
    const amountIn = utils.parseEther("10");
    const amountOutMin = await router.getAmountOut(amountIn, reservers[0], reservers[1]);
    console.log('amountIn = '+amountIn, balanceHuman(amountIn));
    console.log('amountOutMin = '+amountOutMin);
    await token.approve(router.address, amountIn);
    const txSwap = await router.populateTransaction.swapExactTokensForETH(amountIn, amountOutMin, [
            token.address,
            WETH.address,
        ], owner.address,
        deadline
    );

    const txSwapSign = await owner.sendTransaction(txSwap);

    const receipt = await txSwapSign.wait();


    reservers = await pair.getReserves();
    reservers = WETH.address == token0?reservers : [reservers[1], reservers[0]];
    console.log("\n");
    console.log('reserves0 before = ', reservers[0].toString(), balanceHuman(reservers[0]));
    console.log('reserves1 before = ', reservers[1].toString(), balanceHuman(reservers[1]));


    console.log('Swapped! tx_hash=' + txSwapSign.hash);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
