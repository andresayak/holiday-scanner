const {ethers} = require("hardhat");
const {utils} = require("ethers");

const getAmountIn  = (amountOut, reserveIn, reserveOut, fee = 3, feeScale = 1000)=>{
    const numerator = reserveIn.mul(amountOut).mul(feeScale);
    const denominator = reserveOut.sub(amountOut).mul(feeScale - fee);
    return numerator.div(denominator).add(1);
}
module.exports.getAmountIn = getAmountIn;

const getAmountOut = (amountIn, reserveIn, reserveOut, fee = 3, feeScale = 1000)=>{
    const amountInWithFee = amountIn.mul(feeScale - fee);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(feeScale).add(amountInWithFee);
    return numerator.div(denominator);
}
module.exports.getAmountOut = getAmountOut;
module.exports.setup = async (inner, tokenContract = 'Token') => {
    const [owner] = await ethers.getSigners();

    const factory = await (await ethers.getContractFactory("UniswapV2Factory")).deploy(owner.address);
    await factory.deployed();

    const WETH = await (await ethers.getContractFactory("WETH9")).deploy();
    await WETH.deployed();

    const tokenA = await (await ethers.getContractFactory("TokenWithFee")).deploy("Token A", "TST", utils.parseEther("1000"));
    await tokenA.deployed();

    console.log('tokenA balance', (await tokenA.balanceOf(owner.address)).toString());
    const tokenB = await (await ethers.getContractFactory("Token")).deploy("Token B", "TST", utils.parseEther("1000"));
    await tokenB.deployed();

    console.log('token0', tokenB.address);
    console.log('token1', tokenA.address);
    console.log('WETH', WETH.address);

    console.log("\n");

    const pairAddress = await createPair(factory, tokenA.address, tokenB.address);

    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
    const router = await (await ethers.getContractFactory("UniswapV2Router02")).deploy(factory.address, WETH.address);
    await router.deployed();
    console.log('pairAddress', pairAddress);
    console.log('factory', factory.address);

    const token0Address = await pair.token0();
    const token1Address = await pair.token1();
    const token0 = tokenA.address === token0Address ? tokenA : tokenB
    const token1 = tokenA.address === token1Address ? tokenA : tokenB

    const pair0Address = await createPair(factory, WETH.address, token0.address);
    const pair1Address = await createPair(factory, WETH.address, token1.address);
    const pair0 = await ethers.getContractAt("UniswapV2Pair", pair0Address);
    const pair1 = await ethers.getContractAt("UniswapV2Pair", pair1Address);

    const amount0 = utils.parseEther("100");
    const amount1 = utils.parseEther("100");
    const amountWETH = utils.parseEther("10");
    await WETH.approve(router.address, amountWETH);
    let deadline = Math.floor(new Date().getTime() / 1000) + 3600;

    console.log("\n");
    let reservers = await pair.getReserves();
    console.log('getReservers', reservers[0].toString(), reservers[1].toString());
    console.log("\n");
    console.log('addLiquidityETH');

    await token0.approve(router.address, amount0);
    await (router.addLiquidityETH(
            token0.address,
            amount0,
            amount0,
            amountWETH,
            owner.address,
            deadline,
            {value: amountWETH})
    );
    let reservers0 = await pair0.getReserves();
    console.log('getReservers0 ETH', reservers0[0].toString(), reservers0[1].toString());

    console.log("\n");
    console.log('addLiquidity');
    await token0.approve(router.address, amount0);
    await token1.approve(router.address, amount1);
    await router.addLiquidity(
        token0.address,
        token1.address,
        amount0,
        amount1,
        amount0,
        amount1,
        owner.address,
        deadline
    );


    //swapExactTokensForETH(amountIn, amountOutMin)
    //swapETHForExactTokens(amountOut) + value
    //swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, amountOutMin)
    //const txSwap = await swapExactTokensForTokensSupportingFeeOnTransferTokens([token0, token1], owner, router);
    //swapExactETHForTokensSupportingFeeOnTransferTokens(amountOutMin) + value
    //swapExactTokensForETHSupportingFeeOnTransferTokens(amountIn, amountOutMin)

    await inner({WETH, token0, token1, owner, router, pair, pair0, pair1});
}

const createPair = async (factory, tokenA, tokenB) => {
    const tx = await factory.createPair(tokenA, tokenB);
    const receipt = await tx.wait();
    const event = receipt.events.find(event => event.event == 'PairCreated');

    return event.args.pair;
}

function checkProfit({
                         reserver0, reserver1,
                         amountOut, amountInMax,
                         amountIn, amountOutMin,
                     }, path) {

}

const decode = (txSwap) => {
    const iface = new ethers.utils.Interface(['function swapExactTokensForTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)'])
    console.log('txSwap', txSwap);

    const decode = iface.decodeFunctionData('swapExactTokensForTokens', txSwap.data);
    console.log('decode', decode);
}


module.exports.calculate = (reserve0, reserve1, amountOutMin, amountIn) => {
    const amountOut = getAmountOut(amountIn, reserve1, reserve0);
    const amountOutMy = amountOut.sub(amountOutMin).mul(Math.ceil((10 + Math.PI)*100)).div(1000);
    const amountInMy = getAmountIn(amountOutMy, reserve1, reserve0);//ETH
    return {
        amountInMy: amountInMy,
        amountOutMy: amountOutMy
    }
}
