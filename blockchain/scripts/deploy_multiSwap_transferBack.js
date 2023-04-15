const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    const swapAddress = '0x3e958e0212b659cecf20e1a8de40cc24ceff83df';//process.env['MULTI_SWAP_ADDRESS'];
    const wethAddress = '0xe9e7cea3dedca5984780bafc599bd69add087d56';//process.env['WETH_ADDRESS'];
    const [owner] = await ethers.getSigners();

    const balance = await owner.getBalance();
    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', wethAddress, owner);

    console.log(await WETH.name());

    const balanceSwapBefore = await WETH.balanceOf(swapAddress);
    console.log(' - multiSwap balance: ' + balanceHuman(balanceSwapBefore));
return;
    const multiSwap = await ethers.getContractAt('MultiSwap', swapAddress, owner);
    const tx1 = await multiSwap.withdraw(WETH.address, balanceSwapBefore, {
        gasLimit: '50000'
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
