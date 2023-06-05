const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    const wethAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';//process.env['WETH_ADDRESS'];
    const walletAddress = '0x58dea14686c56919bbf18c52ffc67dc4de9eaf32';
    const [owner, account] = await ethers.getSigners();

    const balance = await owner.getBalance();
    console.log(' - wallet address: ' + walletAddress);
    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', wethAddress, owner);

    console.log(await WETH.name());
    const balanceAccountBefore = await WETH.balanceOf(owner.address);
    console.log(' - WETH balance: ' + balanceHuman(balanceAccountBefore));

    //return;
    const amountIn = balanceAccountBefore;//ethers.utils.parseEther("129");

    console.log('amountIn='+amountIn);
    //return;
    const tx2 = await WETH.transfer(walletAddress, amountIn.toString());
    console.log('transfer tx', tx2.address);
    await tx2.wait();
    console.log('transfer receipt');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
