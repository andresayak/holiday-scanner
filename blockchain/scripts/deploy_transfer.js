const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");
const {secretPromptAndDecrypt} = require("./helpers/secret");
const {Wallet} = require("ethers");
const Confirm = require("prompt-confirm");

async function main() {

    const decrypted = await secretPromptAndDecrypt();
    const account = new Wallet(decrypted, ethers.provider);

    const wethAddress = '0x55d398326f99059ff775485246999027b3197955';
    const walletAddress = '0x58dea14686c56919bbf18c52ffc67dc4de9eaf32';

    const balance = await account.getBalance();
    console.log(' - wallet address: ' + walletAddress);
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const WETH = await ethers.getContractAt('WETH9', wethAddress, account);
    const tokenName = await WETH.name();
    const balanceAccountBefore = await WETH.balanceOf(account.address);
    console.log(' - token address: ' + wethAddress);
    console.log(' - token balance: ' + balanceHuman(balanceAccountBefore));

    await new Promise(done => {
        new Confirm('Transfer ' + balanceAccountBefore+' '+tokenName + '?')
            .ask(async (answer) => {
                if (answer) {
                    const amountIn = balanceAccountBefore;
                    console.log('amountIn='+amountIn);
                    const tx = await WETH.transfer(walletAddress, amountIn.toString());
                    console.log('transfer tx', tx.hash);
                    await tx.wait();
                    console.log('transfer receipt');
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
