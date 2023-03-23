const {ethers, waffle} = require("hardhat");
const {utils, BigNumber} = require("ethers");
const {bytecode} = require('../artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json');
const {keccak256} = require('@ethersproject/solidity');
const {getAmountIn, getAmountOut, calculate, setup} = require("./helper");
const {balanceHuman} = require("../scripts/helpers/calc");
const {expect} = require("chai");
const pairs = require("./pairs.json");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const pairAbi = require("../artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json");
const path = require("path");

const BNB_CONTRACT = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const tokens = [
    BNB_CONTRACT.toLowerCase(),
    '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    '0x55d398326f99059ff775485246999027b3197955',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
];

const holders = {
    [BNB_CONTRACT.toLowerCase()]: '0xf977814e90da44bfa03b6295a0616a897441acec',
    '0xe9e7cea3dedca5984780bafc599bd69add087d56': '0xd2f93484f2d319194cba95c5171b18c1d8cfd6c4',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
};

const swapInterface = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
    'event Sync(uint112 reserve0, uint112 reserve1)'
];

const gasLimit = ethers.BigNumber.from('500000');
const gasPrice = ethers.BigNumber.from('6000000000');

const iface = new ethers.utils.Interface(swapInterface);

const createPair = async (factory, tokenA, tokenB) => {
    const tx = await factory.createPair(tokenA, tokenB);
    const receipt = await tx.wait();
    const event = receipt.events.find(event => event.event == 'PairCreated');

    return event.args.pair;
}
describe("MultiSwap", () => {
    const provider = waffle.provider;

    const fee = 3;
    const feeScale = 1000;
    it('', async () => {
        const variant = {
            amountIn: '100000000000000000',
            amountOut: '100597272790697089',
            amountInsMax: ["579914596316492885"],
            amountOutsMin: ['8596814441307403868', '100597272790697089'],
            reservers: [
                [
                    ethers.BigNumber.from("4213446430434254961698"),
                    ethers.BigNumber.from("363320704345357402579744")
                ],
                [
                    ethers.BigNumber.from("321511918439820845711816"),
                    ethers.BigNumber.from("3773654629131813877295")
                ]
            ],
            pairs: [
                '0x0a1bcb59bbae506bc9c35b5074765c0850482f83',
                '0x89a41a0e00e5661dfc94d725e6b2e076a07cf2fb'
            ],
            path: [
                '0xe9e7cea3dedca5984780bafc599bd69add087d56',
                '0xc598275452fa319d75ee5f176fd3b8384925b425',
                '0xe9e7cea3dedca5984780bafc599bd69add087d56'
            ],
            profit: 0.59
        };

        const price0 = (variant.reservers[0][1]).mul(1000).div(variant.reservers[0][0]).toString();
        const price1 = (variant.reservers[1][0]).mul(1000).div(variant.reservers[1][1]).toString();

        console.log('price0=' + price0);
        console.log('price1=' + price1);
        const amountIn = ethers.BigNumber.from(variant.reservers[0][1].sub(variant.reservers[1][1]).div(620000).toString());

        console.log('amountIn=' + amountIn, balanceHuman(amountIn));
        let amountOutsMin = [];
        for (const index in variant.pairs) {
            const reserve0 = variant.reservers[index][0];
            const reserve1 = variant.reservers[index][1];

            console.log('reserve0=' + reserve0);
            console.log('reserve1=' + reserve1, balanceHuman(reserve1));
            const amountInCurrent = index == 0 ? amountIn : amountOutsMin[index - 1];
            amountOutsMin.push(getAmountOut(amountInCurrent, reserve0, reserve1, fee, feeScale));
        }
        const amountOut = ethers.BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
        const profit = amountOut.sub(amountIn).mul(10000).div(amountIn);
        console.log('profit', parseInt(profit.toString()) / 100);
        const real = amountIn.mul(profit).div(1000);//.div(100);
        console.log('amountOut=' + amountOut);
        console.log('amountOutsMin', amountOutsMin);

        console.log('real=' + real, balanceHuman(real));
    })
    it('MultiSwap', async () => {
        const pairs = [];
        const [owner, user1] = await ethers.getSigners();

        const WETH = await (await ethers.getContractFactory("WETH9")).deploy();
        await WETH.deployed();

        const token0 = await (await ethers.getContractFactory("Token")).deploy("Token A", "TST", utils.parseEther("1000"));
        await token0.deployed();

        const token1 = await (await ethers.getContractFactory("Token")).deploy("Token B", "TST", utils.parseEther("1000"));
        await token1.deployed();

        for (let i = 0; i < 5; i++) {
            const factory = await (await ethers.getContractFactory("UniswapV2Factory")).deploy(owner.address);
            await factory.deployed();

            const router = await (await ethers.getContractFactory("UniswapV2Router02")).deploy(factory.address, WETH.address);

            const pairAddress = await createPair(factory, token0.address, token1.address);
            const pair0Address = await createPair(factory, WETH.address, token0.address);
            const pair1Address = await createPair(factory, WETH.address, token1.address);

            pairs.push({
                address: pairAddress, token0: token0.address, token1: token1.address,
            });
            pairs.push({
                address: pair0Address, token0: WETH.address, token1: token0.address,
            });
            pairs.push({
                address: pair1Address, token0: WETH.address, token1: token1.address,
            });

            const amount0 = utils.parseEther(Math.ceil(10 + Math.random() * 10).toString());
            const amount1 = utils.parseEther(Math.ceil(10 + Math.random() * 10).toString());
            const amount0WETH = utils.parseEther(Math.ceil(10 + Math.random() * 10).toString());
            const amount1WETH = utils.parseEther(Math.ceil(10 + Math.random() * 10).toString());
            let deadline = Math.floor(new Date().getTime() / 1000) + 3600;

            await WETH.approve(router.address, amount0WETH);
            await token0.approve(router.address, amount0);
            await router.addLiquidityETH(
                token0.address,
                amount0,
                amount0,
                amount0WETH,
                owner.address,
                deadline,
                {value: amount0WETH}
            );

            await WETH.approve(router.address, amount1WETH);
            await token1.approve(router.address, amount1);
            await router.addLiquidityETH(
                token1.address,
                amount1,
                amount1,
                amount1WETH,
                owner.address,
                deadline,
                {value: amount1WETH}
            );

            const amount00 = Math.ceil(1000000 + Math.random() * 100000);
            const amount01 = Math.ceil(1000000 + Math.random() * 100000);

            await token0.approve(router.address, amount00);
            await token1.approve(router.address, amount01);
            await router.addLiquidity(
                token0.address,
                token1.address,
                amount00,
                amount01,
                amount00,
                amount01,
                owner.address,
                deadline
            );
        }

        for (const index in pairs) {
            const pair = pairs[index];
            const pairContract = await ethers.getContractAt("UniswapV2Pair", pair.address);
            const reservers = await pairContract.getReserves();
            pair.reserve0 = reservers[0];
            pair.reserve1 = reservers[1];
            pair.token0 = await pairContract.token0();
            pair.token1 = await pairContract.token1();
        }

        const timeStart = new Date();

        const tokenIn = WETH.address;

        const variants = [];
        for (const x in pairs) {
            const pairX = pairs[x];
            if (pairX.token0 !== tokenIn && pairX.token1 !== tokenIn) {
                continue;
            }
            const tokenOut = pairX.token0 == tokenIn ? pairX.token1 : pairX.token0;
            for (const y in pairs) {
                if (x === y) {
                    continue;
                }
                const pairY = pairs[y];

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

        console.log('variants', variants.length);

        const amountIn = utils.parseEther("0.1");

        let success = [];
        for (const variant of variants) {
            let amountOutsMin = [];
            let status = true;
            let reserves = [];
            for (const index in variant.pairs) {
                const pairAddress = variant.pairs[index];
                const pair = pairs.find(pair => pair.address == pairAddress);
                if (pair) {
                    const token0 = variant.path[index];
                    const reserve0 = token0 == pair.token0 ? pair.reserve0 : pair.reserve1;
                    const reserve1 = token0 == pair.token0 ? pair.reserve1 : pair.reserve0;

                    const amountInCurrent = index == 0 ? amountIn : amountOutsMin[index - 1];
                    if (amountInCurrent.gt(reserve0)) {
                        console.log('not enouthr');
                        status = true;
                    }
                    reserves[index] = [reserve0, reserve1];
                    amountOutsMin.push(getAmountOut(amountInCurrent, reserve0, reserve1, fee, feeScale));
                }
            }
            if (status) {
                const amountOut = ethers.BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
                const profit = parseFloat(amountOut.sub(amountIn).mul(10000).div(amountIn).toString()) / 100;
                success.push({
                    amountIn: amountIn.toString(),
                    amountOut: amountOut.toString(),
                    amountOutsMin: amountOutsMin.map(amountOutMin => amountOutMin.toString()),
                    pairs: variant.pairs,
                    reserves,
                    path: variant.path,
                    profit
                });
            }
        }
        console.log('Diff = ' + ((new Date().getTime() - timeStart) / 1000));
        success = success.filter(item => item.profit > 2).sort((a, b) => (b.profit - a.profit));

        const multiSwap = await (await ethers.getContractFactory("MultiSwap")).connect(user1).deploy();
        await multiSwap.deployed();

        const mostSuccess = success[0];
        console.log('mostSuccess', mostSuccess, [
            mostSuccess.pairs,
            mostSuccess.path,
            mostSuccess.amountOutsMin,
            user1.address
        ]);

        await WETH.deposit({
            value: amountIn
        });
        await WETH.transfer(multiSwap.address, amountIn.toString());

        for (const pair of mostSuccess.pairs) {
            console.log(' - pair: ' + pair);
            const balance = await WETH.balanceOf(pair);
            const token0balance = await token0.balanceOf(pair);
            const token1balance = await token1.balanceOf(pair);
            console.log(' - WETH ' + WETH.address + ' balance: ' + balanceHuman(balance));
            console.log(' - token0 ' + token0.address + ' balance: ' + balanceHuman(token0balance));
            console.log(' - token1 ' + token1.address + ' balance: ' + balanceHuman(token1balance));
        }
        console.log('');

        const balanceBefore = (await WETH.balanceOf(multiSwap.address));
        console.log(' - multiSwap balanceBefore: ' + balanceHuman(balanceBefore));
        const tx = await multiSwap.connect(user1).swap(
            mostSuccess.pairs,
            mostSuccess.path,
            [amountIn, ...mostSuccess.amountOutsMin],
            {
                gasPrice,
                gasLimit
            });
        console.log(' - use: ' + balanceHuman(mostSuccess.amountIn));

        const balanceAfter = await WETH.balanceOf(multiSwap.address);
        console.log(' - multiSwap balanceAfter: ' + balanceHuman(balanceAfter));

        const receipt = await tx.wait();

        const profitReal = parseInt((balanceAfter.sub(balanceBefore)).mul(100).div(amountIn).toString());
        console.log('profitReal', profitReal + '%', balanceHuman(profitReal))

        console.log('');

        let diffs = [];
        for (const index in mostSuccess.pairs) {
            const pairAddress = mostSuccess.pairs[index];
            const pairContract = await ethers.getContractAt("UniswapV2Pair", pairAddress);
            const reservers = await pairContract.getReserves();
            const token0 = await pairContract.token0();

            const reserve0 = BigNumber.from(token0 == mostSuccess.path[index] ? reservers[0] : reservers[1]);
            const reserve1 = BigNumber.from(token0 == mostSuccess.path[index] ? reservers[1] : reservers[0]);

            diffs[index] = [
                reserve0.sub(mostSuccess.reserves[index][0]).toString(),
                reserve1.sub(mostSuccess.reserves[index][1]).toString()
            ];
            console.log('diff' + index + '0', diffs[index][0]);
            console.log('diff' + index + '1', diffs[index][1]);
        }
        expect(diffs[0][0]).to.equal(mostSuccess.amountIn);
        expect(diffs[0][1]).to.equal('-' + mostSuccess.amountOutsMin[0]);
        expect(diffs[1][0]).to.equal(mostSuccess.amountOutsMin[0]);
        expect(diffs[1][1]).to.equal('-' + mostSuccess.amountOutsMin[1]);
    });

    it('MultiSwap Fork Test', async () => {
        /*
                const result = getAmountOut(BigNumber.from('275663894295740050695'), BigNumber.from('0x0000000000000000000000000000000000000000000008a31ea5a7848d9bd104'), BigNumber.from('11985568732274'),
                    1, 100);
                console.log('result='+result);
                return;*/

        const [owner, user1] = await ethers.getSigners();

        const block = await ethers.provider.getBlockNumber();
        console.log('block', block);


        //let alltokens = [...pairs.map(pair=>pair.token0), ...pairs.map(pair=>pair.token1)];

        //alltokens = alltokens.filter((value, index, array) => array.indexOf(value) === index);
        //console.log('alltokens', alltokens);
        const variants = processVariants(tokens, pairs);//.filter((item, index)=>index < 5);

        for (const variant of variants) {
            for(const pairAddress of variant.pairs){
                const pair = pairs.find(pair=>pair.address == pairAddress);
                const pairContract = await ethers.getContractAt("UniswapV2Pair", pair.address);
                try {
                    const reservers = await pairContract.getReserves();
                    const reserve0 = reservers[0];
                    const reserve1 = reservers[1];
                    pair.reserve0 = reservers[0];
                    pair.reserve1 = reservers[1];
                } catch (e) {
                    console.log('pair error', pair.address, e.toString());
                }
            }
            const success = processSuccess(variant, pairs);
            if (!success) {
                continue;
            }
            const multiSwap = await (await ethers.getContractFactory("MultiSwap")).connect(user1).deploy();
            await multiSwap.deployed();
            try {
                const amountIn = success.amountIn;
                let token;
                if (success.path[0] == BNB_CONTRACT) {
                    token = await ethers.getContractAt('WETH9', success.path[0], user1);

                    const tx1 = await token.connect(user1).deposit({
                        value: amountIn.toString(),
                    });
                    await tx1.wait();
                    const tx2 = await token.connect(user1).transfer(multiSwap.address, amountIn.toString());
                    await tx2.wait();

                } else {
                    const address = holders[success.path[0]];//"0xf977814e90da44bfa03b6295a0616a897441acec";
                    await helpers.impersonateAccount(address);
                    const impersonatedSigner = await ethers.getSigner(address);

                    token = await ethers.getContractAt('Token', success.path[0], user1);
                    const tx2 = await token.connect(impersonatedSigner).transfer(multiSwap.address, amountIn.toString());
                    await tx2.wait();
                }
                //console.log(await token.name());
                console.log('pairs: ' + success.pairs[0] + ' : ' + success.pairs[1]);
                const balanceBefore = (await token.balanceOf(multiSwap.address));
                console.log(' - multiSwap balanceBefore: ' + balanceHuman(balanceBefore));

                const tx = await multiSwap.connect(user1).swap(
                    success.pairs,
                    success.path,
                    [amountIn, ...success.amountOutsMin],
                    {
                        gasPrice,
                        gasLimit
                    });
                console.log(' - use: ' + balanceHuman(success.amountIn));

                const balanceAfter = await token.balanceOf(multiSwap.address);
                console.log(' - multiSwap balanceAfter: ' + balanceHuman(balanceAfter));

                const receipt = await tx.wait();

                const transfers = [];
                const swaps = [];
                for (const event of receipt.logs) {
                    //    console.log('event', event);
                    try {
                        const result = iface.decodeEventLog('Transfer', event.data, event.topics);
                        transfers.push({
                            from: result.from.toLowerCase(),
                            to: result.to.toLowerCase(),
                            value: result.value.toString()
                        });
                    } catch (e) {
                    }
                    try {
                        const result = iface.decodeEventLog('Swap', event.data, event.topics);
                        swaps.push({
                            sender: result.sender.toLowerCase(),
                            to: result.to.toLowerCase(),
                            amount0In: result.amount0In.toString(),
                            amount1In: result.amount1In.toString(),
                            amount0Out: result.amount0Out.toString(),
                            amount1Out: result.amount1Out.toString(),
                        });
                    } catch (e) {
                    }
                }

                console.log('gasUsed', receipt.gasUsed.toString());
                const profit = parseInt((balanceAfter.sub(balanceBefore)).mul(10000).div(amountIn).toString());
                const profitReal = profit / 100;
                console.log('profitReal', profitReal + '%')
                console.log('profitEstimate', success.profit + '%')
                try {
                    //expect(transfers.length).to.equal(3);
                    //expect(swaps.length).to.equal(2);
                    //expect(transfers[0].value).to.equal(amountIn.toString());
                    /*expect(swaps[0].amount1In).to.equal(amountIn.toString());
                    expect(swaps[0].amount0Out).to.equal(success.amountOutsMin[0].toString());

                    expect(swaps[1].amount0In).to.equal(success.amountOutsMin[0].toString());
                    expect(swaps[1].amount1Out).to.equal(success.amountOutsMin[1].toString());*/
                    expect(swaps[0].sender).to.equal(multiSwap.address.toLowerCase());
                    expect(swaps[0].to).to.equal(success.pairs[1]);
                    expect(swaps[1].sender).to.equal(multiSwap.address.toLowerCase());
                    expect(swaps[1].to).to.equal(multiSwap.address.toLowerCase());

                    expect(transfers[1].value).to.equal(success.amountOutsMin[0].toString());
                    expect(transfers[2].value).to.equal(success.amountOutsMin[1].toString());

                    expect(transfers[0].from).to.equal(multiSwap.address.toLowerCase());
                    expect(transfers[1].from).to.equal(success.pairs[0]);
                    expect(transfers[2].from).to.equal(success.pairs[1]);

                    expect(transfers[0].to).to.equal(success.pairs[0]);
                    expect(transfers[1].to).to.equal(success.pairs[1]);
                    expect(transfers[2].to).to.equal(multiSwap.address.toLowerCase());
                } catch (e) {
                    console.log('amounts', [amountIn, ...success.amountOutsMin]);
                    console.log('transfers', transfers);
                    console.log('swaps', swaps);
                    console.log(success);
                    console.error(e);
                }
            } catch (e) {
                console.log(success);
                console.log('swap error', e.toString())
            }
            console.log(' ---------------- ');
            console.log();
        }
    }).timeout(3600 * 1000);
});

const processVariants = (tokens, activePairs) => {
    const variants = [];
    for (const tokenIn of tokens) {
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
                    pairY.fee && pairY.fee_scale && (
                        (pairY.token0 === tokenOut && pairY.token1 === tokenIn)
                        || (pairY.token1 === tokenOut && pairY.token0 === tokenIn)
                    )
                ) {
                    variants.push({
                        path: [tokenIn, tokenOut, tokenIn],
                        pairs: [pairX.address, pairY.address]
                    });
                }
            }
        }
    }
    return variants;
}
const processSuccess = (variant, activePairs) => {
    //5gwei
    const amountIn = variant.path[0] == BNB_CONTRACT.toLowerCase() ? ethers.utils.parseEther("0.3") : ethers.utils.parseEther("300");
    let amountOutsMin = [];
    let reservers = [];
    let status = true;
    for (const index in variant.pairs) {
        const pairAddress = variant.pairs[index];
        const pair = activePairs.find(pair => pair.address == pairAddress);
        if (!pair.fee) {
            pair.fee = '1';
            pair.fee_scale = '100';
        }
        if (status && pair && pair.fee) {
            const token0 = variant.path[index];
            const reserve0 = token0 == pair.token0 ? pair.reserve0 : pair.reserve1;
            const reserve1 = token0 == pair.token0 ? pair.reserve1 : pair.reserve0;
            const amountInCurrent = index == 0 ? amountIn : amountOutsMin[index - 1];
            amountOutsMin.push(getAmountOut(amountInCurrent, reserve0, reserve1, parseInt(pair.fee), parseInt(pair.fee_scale)));
            reservers.push([reserve0, reserve1]);
        } else {
            status = false;
        }
    }
    //if (variant.path[1] == '0x3019bf2a2ef8040c242c9a4c5c4bd4c81678b2a1'.toLowerCase()) {
    //    console.log('variant', variant, status);
    //}
    if (!status) {
        return;
    }

    const amountOut = ethers.BigNumber.from(amountOutsMin[amountOutsMin.length - 1]);
    const gas = gasPrice.mul(gasLimit);
    const gasInTokens = variant.path[0] == BNB_CONTRACT.toLowerCase() ? gas : gas.div(300);
    const profit = parseInt(amountOut.sub(amountIn).sub(gasInTokens).mul(10000).div(amountIn).toString()) / 100;
    //const real = parseInt(amountIn.mul(profit).div(100).toString());
    //if (profit>0){//variant.path[1].toLowerCase() == ('0x3019bf2a2ef8040c242c9a4c5c4bd4c81678b2a1').toLowerCase()) {
        return {
            amountIn: amountIn.toString(),
            amountOut: amountOut.toString(),
            //amountInsMax: [amountInMax],
            amountOutsMin: amountOutsMin.map(amountOutMin => amountOutMin.toString()),
            reservers,
            pairs: variant.pairs,
            path: variant.path,
            gasPrice: gasPrice,
            gasLimit: gasLimit,
            profit,
            //profit_real: balanceHuman(real)
        };
    //}
}
