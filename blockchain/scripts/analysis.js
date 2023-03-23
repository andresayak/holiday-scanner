const factoryAbi = require('../artifacts/@uniswap/v2-core/contracts/UniswapV2Factory.sol/UniswapV2Factory.json');
const routerAbi = require('../artifacts/@uniswap/v2-periphery/contracts/UniswapV2Router02.sol/UniswapV2Router02.json');
const {ethers} = require("hardhat");
const {balanceHuman, getAmountOut, calculate, calcProfit} = require("./helpers/calc");

const PAN_ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const BNB_PRICE_USD = 300;

const dataSource = require("./helpers/DataSource");

async function analysis() {
    const [account] = await ethers.getSigners();

    const routerContract = new ethers.Contract(PAN_ROUTER_ADDRESS, routerAbi.abi, account);
    const factoryAddress = await routerContract.factory();
    const factoryContract = new ethers.Contract(factoryAddress, factoryAbi.abi, account);

    const repository = dataSource.getRepository("Transaction");
    const count = await repository.count({
        where: {
            //id: 13348,
            method: 'swapExactETHForTokens',
            status: 1,
            //profit: IsNull()
        }
    });

    console.log('count', count);
    let index = 0;
    const chunkSize = 20;
    for (let i = 0; i < count; i += chunkSize) {
        const transactions = await repository.find({
            where: {
                //id: 13348,
                method: 'swapExactETHForTokens',
                status: 1,
                //profit: IsNull()
            },
            skip: i,
            take: chunkSize,
            order: {
                id: {
                    id: 'ASC'
                }
            }
        });
        console.log('transactions', transactions);
        await Promise.all(transactions.map((transaction) => {
            new Promise(async (done) => {
                try {
                    const reserves = [
                        ethers.BigNumber.from(transaction.reserves0),
                        ethers.BigNumber.from(transaction.reserves1)
                    ];
                    const amountOutMin = ethers.BigNumber.from(transaction.amount1);
                    const amountIn = ethers.BigNumber.from(transaction.amount0);

                    let {
                        amountOut,
                        amountInMy,
                        amountOutMy,
                        amountInMyMax,
                        amountOutMyMax
                    } = calculate(
                        reserves[0], reserves[1],
                        amountOutMin, amountIn);//, ethers.utils.parseEther('0.1'));
                    console.log(' - reservers before:', ethers.utils.formatEther(reserves[0]), balanceHuman(reserves[1]));

                    console.log(' - amountOutMin: ' + ethers.utils.formatEther(amountOutMin));
                    console.log(' - amountOut: ' + ethers.utils.formatEther(amountOut));
                    console.log(' - amountIn: ' + balanceHuman(amountIn));


                    console.log(' - amountOutMy: ' + ethers.utils.formatEther(amountOutMy));
                    console.log(' - amountInMy: ' + balanceHuman(amountInMy));

                    const reserves_after_estimated = [
                        reserves[0].sub(amountOut),
                        reserves[1].add(amountIn),//BNB
                    ];

                    //const amountOutReal = reserves[0].sub(ethers.BigNumber.from(transaction.reservesAfter0));
                    //const amountInReal = ethers.BigNumber.from(transaction.reservesAfter1).sub(reserves[1]);

                    const amountOutReal = reserves[0].sub(ethers.BigNumber.from(transaction.reservesAfter0));
                    const amountInReal = ethers.BigNumber.from(transaction.reservesAfter1).sub(reserves[1]);

                    if (!amountOutReal.eq(amountOut) || !amountInReal.eq(amountIn)) {
                        console.warn(' - amountOutReal: ' + (!amountOutReal.eq(amountOut) ? ethers.utils.formatEther(amountOutReal) : 'OK'));
                        console.warn(' - amountInReal: ' + (!amountInReal.eq(amountIn) ? balanceHuman(amountInReal) : 'OK'));

                        const diff0 = amountOut.sub(amountOutReal);
                        const diff1 = amountIn.sub(amountInReal).mul(-1);
                        console.warn('diff0', diff0.toString(), ethers.utils.formatEther(diff0));
                        console.warn('diff1', diff1.toString(), balanceHuman(diff1));
                        console.warn('reserves_after0_estimated', reserves_after_estimated[0].toString(), transaction.reservesAfter0.toString());
                        console.warn('reserves_after1_estimated', reserves_after_estimated[1].toString(), transaction.reservesAfter1.toString());
                    }


                    const reserves_after_buy = [
                        reserves[0].sub(amountOutMy),
                        reserves[1].add(amountInMy),//BNB
                    ];

                    console.log(' - reservers after buy:', ethers.utils.formatEther(reserves_after_buy[0]), balanceHuman(reserves_after_buy[1]));

                    const amountOutMin_after_buy = getAmountOut(amountIn, reserves_after_buy[1], reserves_after_buy[0]);
                    const reserves_after_target = [
                        reserves_after_buy[0].sub(amountOutMin_after_buy),
                        reserves_after_buy[1].add(amountIn),//BNB
                    ];

                    console.log(' - reservers after target:', ethers.utils.formatEther(reserves_after_target[0]), balanceHuman(reserves_after_target[1]));

                    const amountInMySell = amountOutMy;

                    const amountOutMinSell = getAmountOut(amountInMySell, reserves_after_target[0], reserves_after_target[1]);//BNB

                    const buy = amountInMy;
                    const sell = amountOutMinSell;

                    console.log('amountOutMinSell=' + transaction.gasUsed);
                    console.log('amountOutMinSell=' + transaction.gasLimit);
                    //const gasUsed = ethers.BigNumber.from(transaction.gasUsed);
                    //const gasLimit = ethers.BigNumber.from(transaction.gasLimit);
                    //const targetGas = gasUsed.mul(gasLimit);

                    const profit = calcProfit(buy, sell);
                    console.log(++index, transaction.id);

                    const amountInMyUsd = BNB_PRICE_USD * parseFloat(ethers.utils.formatEther(amountInMy))


                    transaction.max_amount = amountInMy.toString();
                    transaction.max_amount_usd = amountInMyUsd.toString();
                    transaction.reservesAfter0estimate = reserves_after_estimated[0].toString();
                    transaction.reservesAfter1estimate = reserves_after_estimated[1].toString();
                    transaction.profit = profit.toString();

                    await repository.save(transaction);

                } catch (e) {
                    console.log(e.toString())
                    console.log(++index, transaction.id);
                }
            });
        }));
    }
}


dataSource
    .initialize()
    .then(analysis);

