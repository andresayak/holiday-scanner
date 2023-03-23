import { BigNumber } from "ethers";
import {ethers} from "hardhat";
const helpers =  require("@nomicfoundation/hardhat-network-helpers");
const {checkAmounts} = require('./checkAmounts.js');

import * as swapData from './data/swapExactTokensForTokens-2.json';

const BNB_CONTRACT = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const holders = {
    [BNB_CONTRACT.toLowerCase()]: '0xf977814e90da44bfa03b6295a0616a897441acec',
    '0xe9e7cea3dedca5984780bafc599bd69add087d56': '0xd2f93484f2d319194cba95c5171b18c1d8cfd6c4',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
};


describe.only("MultiSwap", () => {

    it.only('test success', async () => {

        if (!process.env['WETH_ADDRESS'] || !process.env['MULTI_SWAP_ADDRESS']) {
            throw new Error('wrong env')
        }
        console.log('swapExactTokensForTokensData', swapData);
        await checkAmounts(swapData);

        const [owner, user1] = await ethers.getSigners();
        const {success, block, target, after, before} = swapData;

        const multiSwapContract = await (await ethers.getContractFactory("MultiSwapV2")).connect(owner).deploy();
        await multiSwapContract.deployed();

        const params = {
            gasLimit: BigNumber.from('700000'),
            gasPrice: target.gasPrice
        };

        const amountIn = success.amountIn;
        let token;
        if (success.path[0] == BNB_CONTRACT) {
            token = await ethers.getContractAt('WETH9', success.path[0], user1);

            const tx1 = await token.connect(user1).deposit({
                value: amountIn.toString(),
            });
            await tx1.wait();
            const tx2 = await token.connect(user1).transfer(multiSwapContract.address, amountIn.toString());
            await tx2.wait();

        } else {
            const address = holders[success.path[0]];
            await helpers.impersonateAccount(address);
            const impersonatedSigner = await ethers.getSigner(address);

            token = await ethers.getContractAt('Token', success.path[0], user1);
            const tx2 = await token.connect(impersonatedSigner).transfer(multiSwapContract.address, amountIn.toString());
            await tx2.wait();
        }

        const balance1 = await token.balanceOf(multiSwapContract.address);
        console.log('success', success);

        const b0 = '78531332176747735216';
        const b1 = '9374666979737106315222';

        const amount0In = BigNumber.from(b0).gt(BigNumber.from(success['reservers1'][0]).sub(success['amountOutsMin'][1]))
            ? BigNumber.from(b0).sub(BigNumber.from(success['reservers1'][0]).sub(success['amountOutsMin'][1])) : 0;

        const amount1In = BigNumber.from(b1).gt(BigNumber.from(success['reservers1'][1]).sub(success['amountOutsMin'][0]))
            ? BigNumber.from(b1).sub(BigNumber.from(success['reservers1'][1]).sub(success['amountOutsMin'][0])) : 0;

        const balance0Adjusted = BigNumber.from(b0).mul(10000).sub(BigNumber.from(amount0In).mul(25));
        const balance1Adjusted = BigNumber.from(b1).mul(10000).sub(BigNumber.from(amount1In).mul(25));

        console.log('amount0In='+amount0In);
        console.log('amount1In='+amount1In);

        console.log('balance0Adjusted='+balance0Adjusted);
        console.log('balance1Adjusted='+balance1Adjusted);

        const left = balance0Adjusted.mul(balance1Adjusted);
        const right = BigNumber.from(success['reservers1'][0]).mul(success['reservers1'][1]).mul(1000**2);
        console.log('left ='+left);
        console.log('right='+right)
        if(left.gte(right)){
            console.log('K');
        }

        //return;

        const tx = await multiSwapContract.swap(
            success.amountIn,
            success.pairs,
            success.path,
            [2, 26],//success.fees,
            success.feeScales,
            params
        );

        const receipt = await tx.wait();
        //console.log('receipt', receipt);
        const balance2 = await token.balanceOf(multiSwapContract.address);

        console.log('balance1='+balance1);
        console.log('balance2='+balance2);
    }, 600000);
});
