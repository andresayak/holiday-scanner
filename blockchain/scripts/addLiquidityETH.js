const {ethers} = require("hardhat");
const {utils} = require("ethers");

async function main() {
    if (!process.env['ROUTER_ADDRESS'] || !process.env['WETH_ADDRESS'] || !process.env['TOKEN0_ADDRESS'] || !process.env['TOKEN1_ADDRESS']) {
        throw new Error('wrong env')
    }
    const [owner] = await ethers.getSigners();

    const router = await ethers.getContractAt("UniswapV2Router02", process.env['ROUTER_ADDRESS']);
    const WETH = await ethers.getContractAt("WETH9", process.env['WETH_ADDRESS']);
    const token0 = await ethers.getContractAt("Token", process.env['TOKEN0_ADDRESS']);

    const amount0 = utils.parseEther("10");
    const amountWETH = utils.parseEther("10");

    let deadline = Math.floor(new Date().getTime() / 1000) + 3600;

    console.log('Approve0');
    await WETH.approve(router.address, amountWETH);
    console.log('Approve1');
    await token0.approve(router.address, amount0);
    console.log('addLiquidityETH')
    const tx = await router.addLiquidityETH(
        token0.address,
        amount0,
        amount0,
        amountWETH,
        owner.address,
        deadline,
        {value: amountWETH, gasLimit: '9000000'}
    );

    console.log('Added! tx_hash=' + tx.hash);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
