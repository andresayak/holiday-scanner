const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");
const {BigNumber} = require("ethers");
const Confirm = require("prompt-confirm");

async function main() {

    const [owner, account] = await ethers.getSigners();

    const balance = await account.getBalance();

    console.log(' - account address: ' + owner.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    await new Promise(done => {
        new Confirm('What receiver address?')
            .ask(async (receiverAddress) => {
                console.log(' - receiver address: ' + receiverAddress);

                const gasPrice = BigNumber.from('3000000000');//3gwei
                const gasLimit = BigNumber.from('21000');
                const gas = gasPrice.mul(gasLimit);
                const amountIn = balance.sub(gas);
                console.log('amountIn=' + amountIn);

                await new Promise(done => {
                    new Confirm('Transfer ' + amountIn + ' BNB?')
                        .ask(async (answer) => {
                            if (answer) {
                                const tx = await account.sendTransaction({
                                    to: receiverAddress,
                                    value: amountIn,
                                    gasPrice,
                                    gasLimit
                                });
                                console.log('txHash', tx.hash);
                            }
                        });
                });
            })
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
