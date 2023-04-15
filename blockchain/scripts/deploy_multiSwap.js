const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    const [ account] = await ethers.getSigners();

    const balance = await account.getBalance();
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const contact = await ethers.getContractFactory("MultiSwapV2");

    console.log('contact', contact.bytecode);
    return;
    const multiSwap = await contact.connect(account).deploy();
    await multiSwap.deployed();

    console.log('MULTI_SWAP_ADDRESS='+multiSwap.address);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
