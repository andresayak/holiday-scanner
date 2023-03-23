const { ethers, waffle } = require("hardhat");
const { utils } = require("ethers");
const { bytecode } = require('../artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json');
const { keccak256 } = require('@ethersproject/solidity');

describe("Swap",  () => {
    const provider = waffle.provider;

    it('swapExactETHForTokens(amountOutMin) + value', async () => {
        await setup(async ({WETH, token0, token1, router, pair0})=>{

            const [owner, user1, user2] = await ethers.getSigners();

            let reservers_before = await pair0.getReserves();
            let balance_before = [
                await owner.getBalance(),
                await WETH.balanceOf(owner.address),
                await token0.balanceOf(owner.address),
                await token1.balanceOf(owner.address)
            ];
            let balanceMy_before = [
                await user1.getBalance(),
                await WETH.balanceOf(user1.address),
                await token0.balanceOf(user1.address),
                await token1.balanceOf(user1.address)
            ];
            console.log("---------------------------\n");
            console.log('reservers ETH before', utils.formatEther(reservers_before[0])+' token', utils.formatEther(reservers_before[1])+' ETH');
            console.log('Price', reservers_before[1].mul(100).div(reservers_before[0]).toNumber()/100);

            let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
            const amountOutMin = utils.parseEther("4"), amountIn = utils.parseEther("10");

            const {amountInMy, amountOutMy} = calculate(ethers.BigNumber.from(reservers_before[0]),
                ethers.BigNumber.from(reservers_before[1]),
                ethers.BigNumber.from(amountOutMin),
                ethers.BigNumber.from(amountIn),//ETH
            );
            let spendMy = amountInMy;
            const txSwapMyBuy = await router.connect(user1).swapExactETHForTokens(amountOutMy, [
                    WETH.address,
                    token0.address,
                ], user1.address,
                deadline,
                { value: amountInMy }
            );

            const swapReceiptMyBuy = await txSwapMyBuy.wait();
            const ethGasMyBuy = swapReceiptMyBuy.cumulativeGasUsed.mul(swapReceiptMyBuy.effectiveGasPrice);
            spendMy = spendMy.add(ethGasMyBuy);
            console.log(' - BUY - ');
            const reservers3_after = await pair0.getReserves();
            console.log('reservers ETH after BUY', utils.formatEther(reservers3_after[0]) + ' token', utils.formatEther(reservers3_after[1])+' ETH');
            console.log('Price', reservers3_after[1].mul(100).div(reservers3_after[0]).toNumber()/100);

            const txSwap = await router.swapExactETHForTokens(amountOutMin, [
                    WETH.address,
                    token0.address,
                ], owner.address,
                deadline,
                { value: amountIn }
            );

            const swapReceipt = await txSwap.wait();

            console.log("\n");
            console.log(' - Target Swap - ');

            const ethGas = swapReceipt.cumulativeGasUsed.mul(swapReceipt.effectiveGasPrice);

            let balance_after = [
                await owner.getBalance(),
                await WETH.balanceOf(owner.address),
                await token0.balanceOf(owner.address),
                await token1.balanceOf(owner.address)
            ];

            let balanceMy_after = [
                await user1.getBalance(),
                await WETH.balanceOf(user1.address),
                await token0.balanceOf(user1.address),
                await token1.balanceOf(user1.address)
            ];

            const reservers2_after = await pair0.getReserves();
            console.log('reservers ETH after swap', utils.formatEther(reservers2_after[0]) + ' token', utils.formatEther(reservers2_after[1])+' ETH');
            console.log('Price', reservers2_after[1].mul(100).div(reservers2_after[0]).toNumber()/100);
            console.log("\n");
            console.log(' - diff in pair: ', utils.formatEther(reservers2_after[0].sub(reservers_before[0])) + ' token', utils.formatEther(reservers2_after[1].sub(reservers_before[1]))+' ETH');
            console.log(' - diff in user: ', utils.formatEther(balance_after[2].sub(balance_before[2])) + ' token', utils.formatEther(balance_after[0].sub(balance_before[0]).add(ethGas))+' ETH');
            console.log(' - diff in my: ', utils.formatEther(balanceMy_after[2].sub(balanceMy_before[2])) + ' token', utils.formatEther(balanceMy_after[0].sub(balanceMy_before[0]).add(ethGasMyBuy))+' ETH');
            console.log(' - gas user: -'+utils.formatEther(ethGas)+' ETH');
            console.log(' - gas my: -'+utils.formatEther(ethGasMyBuy)+' ETH');
            console.log("\n");

            const amountInMySell = amountOutMy;
            const amountOutMinSell = router.getAmountOut(amountInMySell, reservers2_after[0], reservers2_after[1]);
            const approveMySell =  await token0.connect(user1).approve(router.address, amountInMySell);
            const approveReceiptMySell = await approveMySell.wait();
            const txSwapMySell = await router.connect(user1).swapExactTokensForETH(amountInMySell, amountOutMinSell, [
                    token0.address,
                    WETH.address,
                ], user1.address,
                deadline,
            );

            const swapReceiptMySell = await txSwapMySell.wait();
            const ethGasMySell = swapReceiptMySell.cumulativeGasUsed.mul(swapReceiptMySell.effectiveGasPrice);
            const ethGasMyApproveSell = approveReceiptMySell.cumulativeGasUsed.mul(approveReceiptMySell.effectiveGasPrice);
            spendMy = spendMy.add(ethGasMySell).add(ethGasMyApproveSell);

            balance_after = [
                await owner.getBalance(),
                await WETH.balanceOf(owner.address),
                await token0.balanceOf(owner.address),
                await token1.balanceOf(owner.address)
            ];

            balanceMy_after = [
                await user1.getBalance(),
                await WETH.balanceOf(user1.address),
                await token0.balanceOf(user1.address),
                await token1.balanceOf(user1.address)
            ];

            const reservers_after = await pair0.getReserves();
            const ethGasMyTotal = ethGasMyBuy.add(ethGasMySell).add(ethGasMyApproveSell);
            const income = balanceMy_after[0].sub(balanceMy_before[0]).sub(ethGasMyTotal);

            console.log(' - BUY - ');
            console.log('reservers ETH after Sell', utils.formatEther(reservers_after[0]) + ' token', utils.formatEther(reservers_after[1])+' ETH');
            console.log('Price', reservers_after[1].mul(100).div(reservers_after[0]).toNumber()/100);
            console.log("\n");
            console.log(' - diff in pair: ', utils.formatEther(reservers_after[0].sub(reservers_before[0])) + ' token', utils.formatEther(reservers_after[1].sub(reservers_before[1]))+' ETH');
            console.log(' - diff in user: ', utils.formatEther(balance_after[2].sub(balance_before[2])) + ' token', utils.formatEther(balance_after[0].sub(balance_before[0]).add(ethGas))+' ETH');
            console.log(' - diff in my: ', utils.formatEther(balanceMy_after[2].sub(balanceMy_before[2])) + ' token', utils.formatEther(income)+' ETH');
            console.log(' - gas user: -'+utils.formatEther(ethGas)+' ETH');
            console.log(' - gas my: -'+utils.formatEther(ethGasMyTotal)+' ETH');

            console.log("\n");
            console.log('------PROFIT-----------');

            console.log(' - used: '+utils.formatEther(spendMy));
            console.log(' - income: '+utils.formatEther(income));
            console.log(' - profit: '+spendMy.sub(income).mul(100).div(spendMy)+'%');

        });
    });

    it('swapTokensForExactTokens(amountOut, amountInMax)', async () => {
        await setup(async ({token0, token1, owner, router, pair}) => {

            let reservers = await pair.getReserves();
            console.log("\n");
            console.log('reservers before', reservers[0].toString(), reservers[1].toString());
            console.log('Price', reservers[1].div(reservers[0]).toString());

            console.log('token0 balance before', (await token0.balanceOf(owner.address)).toString());
            console.log('token1 balance before', (await token1.balanceOf(owner.address)).toString());

            let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
            const amountIn = 10000, amountInMax = 100500;
            await token0.approve(router.address, amountOut);
            const txSwap = await router.populateTransaction.swapTokensForExactTokens(amountIn, amountInMax, [
                    token0.address,
                    token1.address,
                ], owner.address,
                deadline
            );

            const txSwapSign = await owner.sendTransaction(txSwap);
            const swapReceipt = await txSwapSign.wait();

            console.log('token0 balance', (await token0.balanceOf(owner.address)).toString());
            console.log('token1 balance', (await token1.balanceOf(owner.address)).toString());
            reservers = await pair.getReserves();
            console.log('reservers after swap', reservers[0].toString(), reservers[1].toString());

            //balances 999999999999900000  999999999998000000
            //before 100000 2000000 / price: 20
            // change
            // +505, -10000
            //after 100505, 1990000 / price 19.80000995
            //balances 999999999999890000 999999999998181322

            return swapReceipt;
        })
    });

    it('swapExactTokensForTokens(amountIn, amountOutMin)', async () => {
        await setup(async ({token0, token1, owner, router, pair}) => {

            let reservers = await pair.getReserves();
            console.log("\n");
            console.log('reservers before', reservers[0].toString(), reservers[1].toString());
            console.log('Price', reservers[1].div(reservers[0]).toString());

            console.log('token0 balance before', (await token0.balanceOf(owner.address)).toString());
            console.log('token1 balance before', (await token1.balanceOf(owner.address)).toString());

            let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
            const amountIn = 100000, amountOutMin = 4748;
            await token1.approve(router.address, amountIn);
            const txSwap = await router.populateTransaction.swapExactTokensForTokens(amountIn, amountOutMin, [
                    token1.address,
                    token0.address,
                ], owner.address,
                deadline
            );
            const txSwapSign = await owner.sendTransaction(txSwap);
            const swapReceipt = await txSwapSign.wait();

            console.log('token0 balance', (await token0.balanceOf(owner.address)).toString());
            console.log('token1 balance', (await token1.balanceOf(owner.address)).toString());
            reservers = await pair.getReserves();
            console.log('reservers after swap', reservers[0].toString(), reservers[1].toString());

            //swapExactTokensForTokens
            checkProfit({
                reserver0: 100000, reserver1: 2000000,
                amountOut: 2000000, amountInMax: 0,
                amountIn: 0, amountOutMin: 0,
            },100000, 2000000, 0,0, 100000, 4748);

            //before 100000 2000000 / price: 20
            //balances 999999999999900000  999999999998000000
            //change
            //-4748 +100000
            //after 95252 2100000 / price: 22.04678117
            //balances 999999999999904748 999999999997900000

            return swapReceipt;
        })
    });

    const createPair = async(factory, tokenA, tokenB) => {
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

    const decode = (txSwap) =>{
        const iface = new ethers.utils.Interface(['function swapExactTokensForTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)'])
        console.log('txSwap', txSwap);

        const decode =  iface.decodeFunctionData('swapExactTokensForTokens', txSwap.data);
        console.log('decode', decode);
    }
});
