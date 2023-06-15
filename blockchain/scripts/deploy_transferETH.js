const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");
const {secretPromptAndDecrypt} = require("./helpers/secret");
const {Wallet, BigNumber} = require("ethers");
const Confirm = require("prompt-confirm");

async function main() {

    const decrypted = await secretPromptAndDecrypt();
    const account = new Wallet(decrypted, ethers.provider);

    const walletAddress = '0x58dea14686c56919bbf18c52ffc67dc4de9eaf32';

    const balance = await account.getBalance();
    console.log(' - wallet address: ' + walletAddress);
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));
    if(balance.eq(0)){
        return;
    }

    const gasPrice = BigNumber.from(5000000000);// 5 gwei
    const gasLimit = 21000;
    const gas = gasPrice.mul(gasLimit);

    const amountIn = balance.sub(gas);

    await new Promise(done => {
        new Confirm('Transfer ' + amountIn+' ETH?')
            .ask(async (answer) => {
                if (answer) {
                    const tx = await account.sendTransaction({
                        to: walletAddress,
                        value: amountIn,
                        gasPrice,
                        gasLimit
                    })
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
