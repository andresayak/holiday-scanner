const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    if (!process.env['WETH_ADDRESS'] || !process.env['MULTI_SWAP_ADDRESS']) {
        throw new Error('wrong env')
    }

    const swapAddress = process.env['MULTI_SWAP_ADDRESS'];
    const wethAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';//process.env['WETH_ADDRESS'];
    const [owner] = await ethers.getSigners();

    const balance = await owner.getBalance();
    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', wethAddress, owner);

    console.log(await WETH.name());

    const balanceSwapBefore = await WETH.balanceOf(swapAddress);
    console.log(' - multiSwap balance: ' + balanceHuman(balanceSwapBefore));

    const multiSwap = await ethers.getContractAt('MultiSwap', swapAddress, owner);
    const tx1 = await multiSwap.withdraw(WETH.address, balanceSwapBefore);

    await tx1.wait();

    const balanceSwapAfter = await WETH.balanceOf(swapAddress);
    console.log(' - multiSwap balance after: ' + balanceHuman(balanceSwapAfter));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
