const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");
const Confirm = require('prompt-confirm');
const {Wallet} = require("ethers");
const {secretPromptAndDecrypt} = require("./helpers/secret");

async function main() {

    const decrypted = await secretPromptAndDecrypt();
    const account = new Wallet(decrypted, ethers.provider);

    const balance = await account.getBalance();
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const nameName = 'MultiSwapV3';
    const contact = await ethers.getContractFactory(nameName);
    await new Promise(done => {
        new Confirm('Deploy '+nameName+'?')
            .ask(async (answer) => {
                if (answer) {
                    const multiSwap = await contact.connect(account).deploy();
                    await multiSwap.deployed();
                    console.log('MULTI_SWAP_ADDRESS=' + multiSwap.address);
                }
                done();
            });
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
