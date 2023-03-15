const {ethers} = require("hardhat");
const {utils} = require("ethers");
const {expect} = require("chai");
const {keccak256} = require("@ethersproject/solidity");
const {setup} = require("./helper");

describe("tokenWithFee", () => {
    let token;
    it('tokenWithFee', async () => {
        const [owner, user1, user2] = await ethers.getSigners();

        token = await (await ethers.getContractFactory("TokenWithFee")).deploy("Token A", "TST", utils.parseEther("1"));
        await token.deployed();

        expect(await token.balanceOf(owner.address)).to.equal(utils.parseEther("1"));

        await token.setPair(user2.address);

        await token.transfer(user1.address, 100);
        expect(await token.balanceOf(user1.address)).to.equal(100);

        await token.transfer(user2.address, 100);
        expect(await token.balanceOf(user2.address)).to.equal(50);
        expect(await token.balanceOf(token.address)).to.equal(50);
    });


    it('swapExactTokensForTokensSupportingFeeOnTransferTokens(amountOut, amountInMax)', async () => {
        await setup(async ({token0, token1, owner, router, pair}) => {

            await token0.setPair(pair.address);
            let reservers = await pair.getReserves();
            console.log("\n");
            console.log('reservers before', reservers[0].toString(), reservers[1].toString());
            console.log('Price', reservers[1].div(reservers[0]).toString());

            console.log('token0 balance before', (await token0.balanceOf(owner.address)).toString());
            console.log('token1 balance before', (await token1.balanceOf(owner.address)).toString());

            let deadline = Math.floor(new Date().getTime() / 1000) + 3600;
            const amountIn = 10000*2, amountOutMin = 100500;
            await token0.approve(router.address, amountIn);
            const txSwap = await router.populateTransaction.swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, amountOutMin, [
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
            // +10000, -181322
            //after 110000, 1818678 / price 16
            //balances 999999999999780000 999999999998181322

            return swapReceipt;
        }, 'TokenWithFee')
    });
});

