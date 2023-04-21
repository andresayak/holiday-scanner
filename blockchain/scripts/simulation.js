const {ethers} = require("hardhat");
const {utils} = require("ethers");
const {balanceHuman} = require("./helpers/calc");

async function main() {

    const account = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', ethers.provider);
    console.log('account', account.address);
    const router = await ethers.getContractAt("UniswapV2Router02", '0x10ED43C718714eb63d5aA57B78B54704E256024E');
    const factoryAddress = await router.factory();
    const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddress);
    const token0Contract = await ethers.getContractAt("Token", '0x55d398326f99059ff775485246999027b3197955');
    const token1Contract = await ethers.getContractAt("Token", '0x9F8a75436e7E808F3Fb348182E0ea42d2dd467Cd');
    const pairAddress = await factory.getPair(token0Contract.address, token1Contract.address);
    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
    const token0 = await pair.token0();
    let reservers = await pair.getReserves();

    reservers = token0Contract.address == token0?reservers : [reservers[1], reservers[0]];
    console.log("\n");
    console.log('reserves0 before = ', reservers[0].toString(), balanceHuman(reservers[0]));
    console.log('reserves1 before = ', reservers[1].toString(), balanceHuman(reservers[1]));
    let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
    const amountIn = utils.parseEther("200000");
    const amountOutMin = '0';(await router.getAmountOut(amountIn, reservers[0], reservers[1])).div(10);
    console.log('amountIn = '+amountIn, balanceHuman(amountIn));
    console.log('amountOutMin = '+amountOutMin);
    const nonce = await ethers.provider.getTransactionCount(account.address)
    //await token0Contract.approve(router.address, amountIn);
    const txSwap = await router.connect(account).populateTransaction.swapExactTokensForTokens(amountIn, amountOutMin, [
            token0Contract.address,
            token1Contract.address,
        ], account.address,
        deadline,
        {
            nonce,
            gasPrice: ethers.BigNumber.from('5000000000'),
            gasLimit: '9000000'
        }
    );

    console.log('txSwap', txSwap);
    const txSwapSign = await account.signTransaction(txSwap);
    const tx = await ethers.provider.sendTransaction(txSwapSign);
    console.log('txSwapSign', txSwapSign);


    const receipt = await txSwapSign.wait();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
