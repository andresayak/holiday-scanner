const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    const walletAddress = '0x58dea14686c56919bbf18c52ffc67dc4de9eaf32';
    const [owner, account] = await ethers.getSigners();

    const balance = await owner.getBalance();
    console.log(' - wallet address: ' + walletAddress);
    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));


    const amountIn = ethers.utils.parseEther("0.3");

    console.log('amountIn='+amountIn);
    //return;

    const tx2 = await owner.sendTransaction({
        to: walletAddress,
        value: amountIn
    })
    console.log('transfer tx', tx2.hash);
    await tx2.wait();
    console.log('transfer receipt');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
