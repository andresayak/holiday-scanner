const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    if (!process.env['WETH_ADDRESS'] || !process.env['MULTI_SWAP_ADDRESS']) {
        throw new Error('wrong env')
    }

    const [owner, account] = await ethers.getSigners();

    const balance = await owner.getBalance();
    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', process.env['WETH_ADDRESS'], owner);

    console.log(await WETH.name());

    const balanceSwapBefore = await WETH.balanceOf(process.env['MULTI_SWAP_ADDRESS']);
    console.log(' - multiSwap balance: ' + balanceHuman(balanceSwapBefore));


    const multiSwap = await ethers.getContractAt('MultiSwap', process.env['MULTI_SWAP_ADDRESS'], owner);
    const tx1 = await multiSwap.connect(account).withdraw(WETH.address, balanceSwapBefore);

    await tx1.wait();

    const balanceSwapAfter = await WETH.balanceOf(process.env['MULTI_SWAP_ADDRESS']);
    console.log(' - multiSwap balance after: ' + balanceHuman(balanceSwapAfter));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
