const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");
const Confirm = require("prompt-confirm");
const {secretPromptAndDecrypt} = require("./helpers/secret");
const {Wallet} = require("ethers");

async function main() {

    const decrypted = await secretPromptAndDecrypt();
    const account = new Wallet(decrypted, ethers.provider);

    const swapAddress = '0x3ddfE16bfE47Cc07b1B5F36A0e5cc4cA0AaC2477';//process.env['MULTI_SWAP_ADDRESS'];
    const wethAddress = '0x55d398326f99059ff775485246999027b3197955';
    console.log('wethAddress', wethAddress);

    const balance = await account.getBalance();
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', wethAddress, account);

    const tokenName = await WETH.name();
    const balanceSwapBefore = await WETH.balanceOf(swapAddress);
    console.log(' - multiSwap address: ' + swapAddress);
    console.log(' - multiSwap balance: ' + balanceSwapBefore);

    const multiSwap = await ethers.getContractAt('MultiSwap', swapAddress, account);
    await new Promise(done => {
        new Confirm('Transfer ' + tokenName + '?')
            .ask(async (answer) => {
                if (answer) {
                    const tx1 = await multiSwap.withdraw(WETH.address, balanceSwapBefore, {
                        gasLimit: '500000'
                    });

                    await tx1.wait();

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
