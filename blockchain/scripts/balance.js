const {ethers} = require("hardhat");
const {Wallet} = require("ethers");
const {balanceHuman} = require("./helpers/calc");

async function main() {
    const account = new Wallet('', ethers.provider);
    const balance = await account.getBalance();
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
