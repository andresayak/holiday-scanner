const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    const swapAddress = '0x12b4bedb20b2bdacaf6bc06d173d73cadbc138dd';//process.env['MULTI_SWAP_ADDRESS'];
    const wethAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';//process.env['WETH_ADDRESS'];
    const [owner] = await ethers.getSigners();

    const balance = await owner.getBalance();
    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', wethAddress, owner);

    console.log(await WETH.name());

    const balanceSwapBefore = await WETH.balanceOf(swapAddress);
    console.log(' - multiSwap balance: ' + balanceHuman(balanceSwapBefore));

    const multiSwap = await ethers.getContractAt('MultiSwap', swapAddress, owner);
    const tx1 = await multiSwap.withdraw(WETH.address, balanceSwapBefore, {
        gasLimit: '500000'
    });

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
