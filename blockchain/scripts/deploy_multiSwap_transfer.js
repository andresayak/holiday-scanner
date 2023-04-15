const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    const swapAddress = '0x12b4bedb20b2bdacaf6bc06d173d73cadbc138dd';
    const wethAddress = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';//process.env['WETH_ADDRESS'];
    const [owner, account] = await ethers.getSigners();

    const balance = await owner.getBalance();
    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', wethAddress, owner);

    console.log(await WETH.name());
    const balanceAccountBefore = await WETH.balanceOf(owner.address);
    console.log(' - WETH balance: ' + balanceHuman(balanceAccountBefore));
    console.log(' - swapAddress: '+swapAddress);
    const balanceSwapBefore = await WETH.balanceOf(swapAddress);
    console.log(' - multiSwap balance: ' + balanceHuman(balanceSwapBefore));
    //return;
    const amountIn = ethers.utils.parseEther("129");

    console.log('amountIn='+amountIn);
    //return;


    /*const tx1 = await WETH.deposit({
        value: amountIn.toString()
    });
    console.log('deposit tx');
    await tx1.wait();
    console.log('deposit receipt');*/
    const tx2 = await WETH.transfer(swapAddress, amountIn.toString());
    console.log('transfer tx');
    await tx2.wait();
    console.log('transfer receipt');

    const balanceSwapAfter = await WETH.balanceOf(swapAddress);
    console.log(' - multiSwap balance after: ' + balanceHuman(balanceSwapAfter));



}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
