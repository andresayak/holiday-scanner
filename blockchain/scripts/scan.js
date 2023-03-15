const pairAbi = require('../artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json');
const factoryAbi = require('../artifacts/@uniswap/v2-core/contracts/UniswapV2Factory.sol/UniswapV2Factory.json');
const routerAbi = require('../artifacts/@uniswap/v2-periphery/contracts/UniswapV2Router02.sol/UniswapV2Router02.json');
const tokenAbi = require('../artifacts/contracts/Token.sol/Token.json');
const {balanceHuman, getAmountOut, getAmountIn, calculate, calcProfit} = require("./helpers/calc");

const axios = require("axios");
const colors = require('colors/safe');
const {ethers} = require("hardhat");
const dataSource = require("./helpers/DataSource");

const swapInterface = [
    'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)',
    'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)',
    'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] calldata path,address to,uint deadline)',
    'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path,address to,uint deadline)'
];

const PAN_ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const BNB_CONTRACT = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const iface = new ethers.utils.Interface(swapInterface);


async function main() {

    const tokenRepository = dataSource.getRepository("Token");
    const whitelist = (await tokenRepository.find()).map(item => item.address.toLowerCase());
    let lastBlock = {
        time: new Date(),
        number: 0,
    };
    let currentBuy = {};
    const provider = new ethers.providers.WebSocketProvider(`wss://rpc.ankr.com/bsc/ws/${process.env.ANKR_PROVIDER_KEY}`);

    const [account] = await ethers.getSigners();
    const balance = await account.getBalance();
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));
    const routerContract = new ethers.Contract(PAN_ROUTER_ADDRESS, routerAbi.abi, account);
    const factoryAddress = await routerContract.factory();
    console.log('factoryAddress', factoryAddress);
    const factoryContract = new ethers.Contract(factoryAddress, factoryAbi.abi, account);

    provider.on("pending", (txHash) => {
        processTxHash(txHash)
    });

    provider.on("block", async (blockNumber) => {
        const block = await provider.getBlock();
        console.log(' --------- new block [ ' + blockNumber + ' ('+block.transactions.length+') ] / ' + (new Date().getTime() - lastBlock.time.getTime()) / 1000 + ' sec.');
        lastBlock = {
            time: new Date(),
            number: blockNumber
        };
    });


    const processTxHash = (txHash) => {
        console.log('txHash', txHash);
        ethers.provider.getTransaction(txHash).then(json => {
            const timeStart = new Date();
            if (json && json.to == PAN_ROUTER_ADDRESS) {
                console.log(' - after block: ' + (new Date().getTime() - lastBlock.time.getTime()) / 1000);
                decodeTx(json, timeStart);
            } else {
                console.log(colors.grey('txHash'), colors.grey(txHash));
            }
        }).catch(error => {
            console.log('txHash', txHash, 'error', error);
        });
    }

    const parsePage = async (tokenAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c') => {
        const timeStart = new Date();
        const {data} = await axios.get(`https://bscscan.com/token/` + tokenAddress);
        const result = data.match(/<meta name="Description" content="(.*) Token Tracker on BscScan shows the price of the Token \$([\.\d]+), total supply ([\d\.\,]*), number of holders ([\d\,]*) and updated information of the token. The token tracker page also shows the analytics and historical data/i)
        console.log(' - parse time: ' + (new Date().getTime() - timeStart.getTime()) / 1000);
        const info = {
            title: result[1],
            price: parseFloat(result[2].replace(/\,/ig, '')),
            supply: parseFloat(result[3].replace(/\,/ig, '')),
            holders: parseInt(result[4].replace(/\,/ig, ''))
        };

        if (info.price === 0) {
            console.warn('price IS Zero');
        }
        if (info.holders <= 1000) {
            console.warn('not enough holders');
        }

        return info;
    }


    const decodeTx = (tx, timeStart) => {
        console.log('txHash', tx.hash, 'Swap');
        console.log(' - from:', tx.from);
        console.log(' - nonce:', tx.nonce);
        if (tx.value.lt(ethers.utils.parseEther('0.3'))) {//min 0.3 BNB
            return;
        }
        try {
            const result = iface.decodeFunctionData('swapExactETHForTokens', tx.data);
            console.log(' - amountOutMin: ' + result.amountOutMin, ', ' + ethers.utils.formatEther(result.amountOutMin));
            console.log(' - amountIn: ' + tx.value + ', ', balanceHuman(tx.value));
            console.log(' - path:', result.path);
            console.log(' - to:', tx.to);
            console.log(' - deadline:', result.deadline.toString());
            if (result) {
                const tokenAddress = result.path[result.path.length - 1].toLowerCase();
                Promise.all([
                    swapExactETHForTokens(tx, result, tokenAddress, timeStart),
                    parsePage(tokenAddress)
                ]).then(data => {
                    console.log('data', data);
return;
                    const {amountOutMy, amountInMy} = data[0];
                    buyTokens(tokenAddress, tx, amountOutMy, amountInMy).then(async () => {
                        currentBuy = {
                            tokenAddress,
                            amountOutMy,
                            amountInMy
                        };
                        const tokenContract = new ethers.Contract(tokenAddress, tokenAbi.abi, account);
                        await tokenContract.approve(PAN_ROUTER_ADDRESS, amountOutMy);

                        const reserves = await pairContract.getReserves();

                        await sellTokens(tokenAddress, amountOutMy, reserves[1], reserves[0]);

                    });
                }).catch(error => {
                    console.error('error', error.toString());
                });

            }
        } catch (error) {
            //console.log('error', error.toString());
        }
    }

    const buyTokens = (tokenAddress, tx, amountOutMy, amountInMy) => {
        let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
        return routerContract.swapExactETHForTokens(amountOutMy, [
                BNB_CONTRACT,
                tokenAddress,
            ], account.address,
            deadline,
            {value: amountInMy, gasPrice: parseInt(tx.gasPrice.mul(1.1).toString()).toString()}
        );
    }

    const sellTokens = (tokenAddress, tx, amountIn, reserveIn, reserveOut) => {
        let amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
        let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
        return routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(amountIn, amountOut, [
                tokenAddress,
                BNB_CONTRACT,
            ], account.address,
            deadline
        );
    }

    const swapExactETHForTokens = async (tx, result, tokenAddress, timeStart) => {
        console.log(' - gasPrice:', tx.gasPrice.toString());
        console.log(' - gasLimit:', tx.gasLimit.toString());
        console.log(' - token0:', result.path[0]);//bnb
        console.log(' - token1:', result.path[1]);
        if (result.path[2])
            console.log(' - token2:', result.path[2]);

        if (!whitelist.includes(tokenAddress)) {
            throw Error('not in whitelist');
        }
        if (result.path.length !== 2) {
            throw Error('not 2 tokens');
        }
        const pairAddress = await factoryContract.getPair(result.path[0], tokenAddress);
        console.log(' - pairAddress:', pairAddress);
        if (pairAddress == ZERO_ADDRESS) {
            throw Error('pairAddress is ZERO');
        }

        const pairContract = new ethers.Contract(pairAddress, pairAbi.abi, account);
        const reserves = await pairContract.getReserves();
        console.log(' - reservers:', ethers.utils.formatEther(reserves[0]), balanceHuman(reserves[1]));

        const amountOutMin = result.amountOutMin;
        const amountIn = tx.value;


        let {
            amountInMy,
            amountOutMy,
            amountInMyMax,
            amountOutMyMax
        } = calculate(reserves[0], reserves[1], amountOutMin, amountIn, ethers.utils.parseEther('0.05'));

        if (amountInMyMax.lt(0) || (amountOutMyMax.lt(0))) {
            console.debug('debug', {
                reserves0: reserves[0].toString(),
                reserves1: reserves[0].toString(),
                amountInMy: amountInMyMax.toString(),
                amountOutMy: amountOutMyMax.toString(),
                amountIn: amountIn.toString(),
                amountOutMin: amountOutMin.toString(),
            });

            return;
        }
        console.log(' - amountInMy:', balanceHuman(amountInMy));
        console.log(' - amountOutMy:', ethers.utils.formatEther(amountOutMy));

        console.log(' - amountInMyMax:', balanceHuman(amountInMyMax));
        console.log(' - amountOutMyMax:', ethers.utils.formatEther(amountOutMyMax));

        console.log(' - time diff: ' + (new Date().getTime() - timeStart.getTime()) / 1000 + ' sec');

        const reserves_after_buy = [
            reserves[0].sub(amountOutMy),
            reserves[1].add(amountInMy),//BNB
        ];
        console.log(' - reservers:', ethers.utils.formatEther(reserves_after_buy[0]), balanceHuman(reserves_after_buy[1]));


        const amountOutMin_after_buy = getAmountOut(amountIn, reserves_after_buy[1], reserves_after_buy[0]);
        const reserves_after_target = [
            reserves[0].sub(amountOutMin_after_buy),
            reserves[1].add(amountIn),//BNB
        ];

        console.log(' - reservers:', ethers.utils.formatEther(reserves_after_target[0]), balanceHuman(reserves_after_target[1]));

        const amountInMySell = amountOutMy;
        const amountOutMinSell = getAmountOut(amountInMySell, reserves_after_target[0], reserves_after_target[1]);//BNB

        const buy = amountInMy;
        const sell = amountOutMinSell;

        const targetGas = tx.gasPrice.mul(tx.gasLimit);
        console.log('targetGas=' + targetGas, balanceHuman(targetGas));

        const profit = calcProfit(buy, sell);
        if (profit < 1) {
            throw Error('low profit');
        }
        return {
            amountInMy, amountOutMy,
            profit,
            timeStart
        };
    }
}

dataSource
    .initialize()
    .then(main);
