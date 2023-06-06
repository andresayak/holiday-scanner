const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");
const Confirm = require("prompt-confirm");
const {secretPromptAndDecrypt} = require("./helpers/secret");
const {Wallet} = require("ethers");

async function main() {

    const decrypted = await secretPromptAndDecrypt();
    const swapAddress = '0x3ddfE16bfE47Cc07b1B5F36A0e5cc4cA0AaC2477';
    const wethAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    const account = new Wallet(decrypted, ethers.provider);

    const balance = await account.getBalance();
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', wethAddress, account);

    const nameName = await WETH.name();
    console.log(' - WETH name: '+nameName);
    console.log(' - WETH address: '+wethAddress);
    const balanceAccountBefore = await WETH.balanceOf(account.address);
    console.log(' - WETH balance: ' + balanceHuman(balanceAccountBefore));
    console.log(' - swapAddress: '+swapAddress);
    const balanceSwapBefore = await WETH.balanceOf(swapAddress);
    console.log(' - multiSwap balance: ' + balanceHuman(balanceSwapBefore));
    const amountIn = ethers.utils.parseEther("1");
    console.log('amountIn='+balanceHuman(amountIn));

    await new Promise(done => {
        new Confirm('Deposit and transfer ' + nameName + '?')
            .ask(async (answer) => {
                if (answer) {
                    const tx1 = await WETH.deposit({
                        value: amountIn.toString()
                    });
                    console.log('deposit tx:', tx1.hash);
                    await tx1.wait();
                    console.log('deposit receipt');
                    const tx2 = await WETH.transfer(swapAddress, amountIn.toString());
                    console.log('transfer tx:', tx2.hash);
                    await tx2.wait();
                    console.log('transfer receipt');

                    const balanceSwapAfter = await WETH.balanceOf(swapAddress);
                    console.log(' - multiSwap balance after: ' + balanceHuman(balanceSwapAfter));
                }
            });
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
