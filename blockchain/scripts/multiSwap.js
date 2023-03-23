const {ethers} = require("hardhat");
const dataSource = require("./helpers/DataSource");
const {urls} = require("./helpers/provider");
const {balanceHuman} = require("./helpers/calc");
const {getAmountOut} = require("../test/helper");

const swapInterface = [
    'event Sync(uint112 reserve0, uint112 reserve1)'
];

const BNB_CONTRACT = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const tokens = [
    BNB_CONTRACT.toLowerCase(),
    '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    '0x55d398326f99059ff775485246999027b3197955',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
];

const iface = new ethers.utils.Interface(swapInterface);


async function main() {
    let lastBlock = 0;
    let maxVariants = 0;
    let gasPrice;
    const gasLimit = ethers.BigNumber.from('215000');
    const processBlock = (pair, block, reserve0, reserve1) =>{
        if (!pair.blockNumber
            || (block.blockNumber > pair.blockNumber)
            || (block.blockNumber == pair.blockNumber
                && pair.transactionIndex > pair.transactionIndex
            )
            || (block.blockNumber == pair.blockNumber
                && block.transactionIndex == pair.transactionIndex
                && block.logIndex > pair.logIndex
            )
        ) {
            pair.blockNumber = block.blockNumber;
            pair.transactionIndex = block.transactionIndex;
            pair.logIndex = block.logIndex;
            pair.reserve0 = reserve0;
            pair.reserve1 = reserve1;
        }
    }

    const processLogs  = (blockNumber, logs) => {
        lastBlock = blockNumber;
        const timeStart = new Date();
        for(const event of logs){
            try {
                const result = iface.decodeEventLog('Sync', event.data, event.topics);
                const pair = pairs.find(pair=>pair.address === event.address.toLowerCase());
                if(pair){
                    processBlock(pair, event, result[0], result[1]);
                }
            }catch (e) {

            }
        }
        console.log('logs', logs.length, (new Date().getTime() - timeStart)/1000);
        processVariants();
    }
    const countVariants = () => {
        const variants = [];
        const activePairs = pairs;
        console.log('activePairs', activePairs.length);
        let timeStart = new Date();
        for(const tokenIn of tokens){
            for (const x in activePairs) {
                const pairX = activePairs[x];
                if (pairX.token0 !== tokenIn && pairX.token1 !== tokenIn) {
                    continue;
                }
                const tokenOut = pairX.token0 == tokenIn ? pairX.token1 : pairX.token0;
                for (const y in activePairs) {
                    if (x === y) {
                        continue;
                    }
                    const pairY = activePairs[y];
                    if (
                        (pairY.token0 === tokenOut && pairY.token1 === tokenIn)
                        || (pairY.token1 === tokenOut && pairY.token0 === tokenIn)
                    ) {
                        variants.push({
                            path: [tokenIn, tokenOut, tokenIn],
                            pairs: [pairX.address, pairY.address]
                        });
                    }
                }
            }
        }
        console.log('countVariants', variants.length, (new Date().getTime() - timeStart) / 1000);
        return variants;
    }
    const processVariants = () => {
        const variants = [];
        const activePairs = pairs.filter(pair=>pair.blockNumber);
        console.log('activePairs', activePairs.length);
        let timeStart = new Date();
        for(const tokenIn of tokens) {
            for (const x in activePairs) {
                const pairX = activePairs[x];
                if (pairX.token0 !== tokenIn && pairX.token1 !== tokenIn) {
                    continue;
                }
                const tokenOut = pairX.token0 == tokenIn ? pairX.token1 : pairX.token0;
                for (const y in activePairs) {
                    if (x === y) {
                        continue;
                    }
                    const pairY = activePairs[y];
                    if (
                        (pairY.token0 === tokenOut && pairY.token1 === tokenIn)
                        || (pairY.token1 === tokenOut && pairY.token0 === tokenIn)
                    ) {
                        variants.push({
                            path: [tokenIn, tokenOut, tokenIn],
                            pairs: [pairX.address, pairY.address]
                        });
                    }
                }
            }
        }
        console.log('variants', variants.length+'/'+maxVariants, (new Date().getTime() - timeStart)/1000);

        timeStart = new Date();
        const amountIn = ethers.utils.parseEther("0.3");
        let success = [];
        for (const variant of variants) {
            const amountIn = variant.path[0] == BNB_CONTRACT.toLowerCase()?ethers.utils.parseEther("0.3"):ethers.utils.parseEther("100");
            let amountOutsMin = [];
            let reservers = [];
            let status = true;
            for (const index in variant.pairs) {
                const pairAddress = variant.pairs[index];
                const pair = pairs.find(pair => pair.address == pairAddress);
                if (pair) {
                    const token0 = variant.path[index];
                    const reserve0 = token0 == pair.token0 ? pair.reserve0 : pair.reserve1;
                    const reserve1 = token0 == pair.token0 ? pair.reserve1 : pair.reserve0;

                    const amountInCurrent = index == 0 ? amountIn : amountOutsMin[index - 1];

                    //if(amountInCurrent.gt(reserve0)){
                    //   console.log('not enouthr');
                    //   status = true;
                    //}

                    amountOutsMin.push(getAmountOut(amountInCurrent, reserve0, reserve1));
                    reservers.push([reserve0, reserve1]);
                }
            }
            //const amountInMax = ethers.BigNumber.from(reservers[0][1].sub(reservers[1][1]).div(620000).toString());

            const amountOut = ethers.BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
            const _gasPrice = gasPrice.add(gasPrice.mul(30).div(100));
            const gas = _gasPrice.mul(gasLimit);
            //const profit = parseInt(amountOut.sub(amountIn).mul(10000).div(amountIn).toString()) / 100;
            const profit = amountOut.sub(amountIn).sub(gas).mul(10000).div(amountIn);
            console.log('profit', parseInt(profit.toString())/100);
            console.log('gas',balanceHuman(gas));
            const real = amountIn.mul(profit).div(1000);//.div(100);
            if(status){
                success.push({
                    amountIn: amountIn.toString(),
                    amountOut: amountOut.toString(),
                    //amountInsMax: [amountInMax],
                    amountOutsMin: amountOutsMin.map(amountOutMin => amountOutMin.toString()),
                    reservers,
                    pairs: variant.pairs,
                    path: variant.path,
                    gasPrice: _gasPrice,
                    gasLimit: gasLimit,
                    profit: parseInt(profit.toString())/100,
                    profit_real: balanceHuman(real)
                });
            }
        }
        success = success.filter(item => item.profit > 0).sort((a, b) => (b.profit - a.profit));
        console.log('success', success);
        console.log('success', success.length, (new Date().getTime() - timeStart)/1000);
        console.log(success[0]);
    }


    const repository = dataSource.getRepository("Pair");
    const pairs = await repository.find();

    maxVariants = countVariants().length;

    const [account] = await ethers.getSigners();
    const balance = await account.getBalance();
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const [owner] = await ethers.getSigners();
    gasPrice = await ethers.provider.getGasPrice();
    urls.map((url, index)=>{
        const provider = new ethers.providers.JsonRpcProvider(url);
        provider.on("block", async (blockNumber) => {
            console.log(' --------- new block ['+index+'] [ ' + blockNumber + '] ');
            try{
                const logs = await provider.getLogs({
                    fromBlock: blockNumber,
                    toBlock: blockNumber
                });
                if(blockNumber > lastBlock){
                    processLogs(blockNumber, logs);
                }
            }catch (e) {
                //console.log('['+index+'] getLogs ');
            }
        });
    });

    try {
        ethers.provider.on("block",  async (blockNumber) => {
            console.log(' --------- new block  [ ' + blockNumber + '] ');
            new Promise(async (done)=>{
                const logs = await ethers.provider.getLogs({
                    fromBlock: blockNumber,
                    toBlock: blockNumber
                });
                if(blockNumber > lastBlock) {
                    processLogs(blockNumber, logs);
                }
                gasPrice = await ethers.provider.getGasPrice();
                console.log('gasPrice', gasPrice)
                done();
            });
            const used = process.memoryUsage().heapUsed / 1024 / 1024;
            console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
        });
    }catch (e) {

    }

    try{
        let currentBlock = await ethers.provider.getBlockNumber();
        for(const pair of pairs){
            try {
                currentBlock = Math.max(lastBlock, currentBlock);
                const pairContract = await ethers.getContractAt("UniswapV2Pair", pair.address, owner);
                const result = await pairContract.getReserves({blockTag: currentBlock});
                processBlock(pair, {
                    blockNumber: currentBlock,
                    transactionIndex: 0,
                    logIndex: 0,
                }, result[0], result[1]);
            }catch (e) {
                console.log('getReserves', e.toString());
            }

        }
    }catch (e) {

    }

    console.log('listen...');
}

dataSource
    .initialize()
    .then(main);

