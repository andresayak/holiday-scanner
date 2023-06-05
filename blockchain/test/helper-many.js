const {ethers} = require("hardhat");
const {utils} = require("ethers");

const getAmountIn = (amountOut, reserveIn, reserveOut, fee = 3, feeScale = 1000) => {
    const numerator = reserveIn.mul(amountOut).mul(feeScale);
    const denominator = reserveOut.sub(amountOut).mul(feeScale - fee);
    return numerator.div(denominator).add(1);
}
module.exports.getAmountIn = getAmountIn;

const getAmountOut = (amountIn, reserveIn, reserveOut, fee = 3, feeScale = 1000) => {
    const amountInWithFee = amountIn.mul(feeScale - fee);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(feeScale).add(amountInWithFee);
    return numerator.div(denominator);
}
module.exports.getAmountOut = getAmountOut;
module.exports.setupMany = async (inner, tokenContract = 'Token') => {
    const [owner] = await ethers.getSigners();

    const factory1 = await (await ethers.getContractFactory("UniswapV2Factory")).deploy(owner.address);
    await factory1.deployed();

    const factory2 = await (await ethers.getContractFactory("UniswapV2Factory")).deploy(owner.address);
    await factory2.deployed();

    const WETH = await (await ethers.getContractFactory("WETH9")).deploy();
    await WETH.deployed();

    const tokenA = await (await ethers.getContractFactory("TokenWithFee")).deploy("Token A", "TST", utils.parseEther("10000"));
    await tokenA.deployed();

    const tokenB = await (await ethers.getContractFactory("Token")).deploy("Token B", "TST", utils.parseEther("10000"));
    await tokenB.deployed();

    const pair01Address = await createPair(factory1, tokenA.address, tokenB.address);
    const pair02Address = await createPair(factory2, tokenA.address, tokenB.address);

    const pair01 = await ethers.getContractAt("UniswapV2Pair", pair01Address);
    const pair02 = await ethers.getContractAt("UniswapV2Pair", pair02Address);
    const router1 = await (await ethers.getContractFactory("UniswapV2Router02")).deploy(factory1.address, WETH.address);
    await router1.deployed();
    const router2 = await (await ethers.getContractFactory("UniswapV2Router02")).deploy(factory2.address, WETH.address);
    await router2.deployed();

    const token0Address = await pair01.token0();
    const token1Address = await pair01.token1();
    const token0 = tokenA.address === token0Address ? tokenA : tokenB
    const token1 = tokenA.address === token1Address ? tokenA : tokenB

    const addLiquidity = async (router, pair, amount0, amount1, amountWETH) => {
        await WETH.approve(router.address, amountWETH);
        let deadline = Math.floor(new Date().getTime() / 1000) + 3600;

        let reservers = await pair.getReserves();

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
    }
    await addLiquidity(router1, pair01, utils.parseEther("90"), utils.parseEther("200"), utils.parseEther("10"));
    await addLiquidity(router2, pair02, utils.parseEther("1100"), utils.parseEther("2100"), utils.parseEther("10"));

    await inner({WETH, token0, token1, owner, router1, router2, pair01, pair02});
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
    const amountOutMy = amountOut.sub(amountOutMin).mul(Math.ceil((10 + Math.PI) * 100)).div(1000);
    const amountInMy = getAmountIn(amountOutMy, reserve1, reserve0);//ETH
    return {
        amountInMy: amountInMy,
        amountOutMy: amountOutMy
    }
}
