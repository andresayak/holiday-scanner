const {ethers, waffle} = require("hardhat");
const {expect} = require("chai");
const {setupMany} = require("./helper-many");
const {utils, BigNumber} = require("ethers");
const {urls} = require("../scripts/helpers/provider");
const axios = require("axios");

describe("Swap", async() => {
    it('test', async() => {

        const wallet = new ethers.Wallet('');
        const [owner] = await ethers.getSigners();
console.log('owner', owner.address);

        await setupMany(async ({WETH, token0, token1, router1, router2, pair01, pair02})=>{


            let reserveA = await pair01.getReserves();

            console.log('reservers 1', utils.formatEther(reserveA[0])+' token', utils.formatEther(reserveA[1])+' token');
            let reserveB = await pair02.getReserves();
            console.log('reservers2', utils.formatEther(reserveB[0])+' token', utils.formatEther(reserveB[1])+' token');


            const token0A = await pair01.token0();
            const token1A = await pair01.token1();
            const token0B = await pair02.token0();
            const token1B = await pair02.token1();

            let priceA = 0;
            let priceB = 0;

            if (token0A == token1A) {
                priceA = reserveA[1].mul(10**8).div(reserveA[0]);
            } else {
                priceA = reserveA[0].mul(10**8).div(reserveA[1]);
            }

            if (token0B == token1B) {
                priceB = reserveB[1].mul(10**8).div(reserveB[0]);
            } else {
                priceB = reserveB[0].mul(10**8).div(reserveB[1]);
            }

            console.log('priceA='+ priceA);
            console.log('priceB='+ priceB);

            const ratio0 = reserveB[0].mul(10**8).div(reserveA[0]);//.toNumber() / 10**8;
            const ratio1 = reserveB[1].mul(10**8).div(reserveA[1]);//.toNumber() / 10**8;
            console.log('ratio0=', ratio0, ratio0.toNumber() / 10**8);
            console.log('ratio1=', ratio1, ratio1.toNumber() / 10**8);
            //const prop1 = reserveA[1].mul(10**8).div(reserveB[1]).toNumber() / 10**8;
            const prop0 = reserveB[0].mul(10**8).div(reserveA[0]);// / 10**8;
            const prop1 = reserveB[1].mul(10**8).div(reserveA[1]);// / 10**8;
            console.log('prop0='+prop0);
            console.log('prop1='+prop1);
            const d = priceB.sub(priceA);//.mul(prop1+prop2);
            const step0 = d.mul(10**8).div(ratio0.add(10**8));//.div(ratio);
            const step1 = d.mul(10**8).div(ratio1.add(10**8));//.div(ratio);
            const mid0Price = priceA.add(step0.mul(ratio0).div(10**8));
            const mid1Price = priceA.add(step1.mul(ratio1).div(10**8));
            console.log('mid='+mid0Price);
            console.log('mid='+mid1Price);
            console.log('d='+d);
            let amountIn, amountOut, amountIn2, amountOut2;
            const balanceBefore = await token0.balanceOf(owner.address);
            if (priceA > priceB) {


            } else if (priceA < priceB) {
                //const diff = priceB.sub(priceA);
                //const prop = reserveA[1].mul(10**8).div(reserveB[1]);
                amountIn = utils.parseEther("6.2");
                amountOut = await router1.getAmountOut(amountIn, reserveA[0], reserveA[1]);
                console.log('amountIn1='+amountIn);
                console.log('amountOut1='+amountOut);
                let currentPrice1 = amountIn.mul(10**8).div(amountOut).toNumber() / 10**8;
                console.log('currentPrice='+currentPrice1);
                const reserveAAfter = [
                    reserveA[0].add(amountIn),
                    reserveA[1].sub(amountOut)
                ];
                console.log("\n");
                console.log('reserveAAfter='+reserveAAfter[0]);
                const priceA = reserveAAfter[0].mul(10**8).div(reserveAAfter[1]);
                console.log('priceA='+priceA);

                amountIn2 = amountOut;
                amountOut2 = await router2.getAmountOut(amountIn2, reserveB[1], reserveB[0]);
                console.log('amountIn2='+amountIn2);
                console.log('amountOut2='+amountOut2);
                let currentPrice2 = amountOut2.mul(10**8).div(amountIn2).toNumber() / 10**8;
                console.log('currentPrice='+currentPrice2);
                const reserveBAfter = [
                    reserveB[0].sub(amountIn2),
                    reserveB[1].add(amountIn2)
                ];

                const priceB = reserveBAfter[0].mul(10**8).div(reserveBAfter[1]);
                console.log('priceB='+priceB);

                const amount = amountOut2.sub(amountIn);
                const profit = amountOut2.sub(amountIn).mul(10**4).div(amountIn).toNumber() / 10**2;
                console.log('amount='+amount+', profit='+profit+'%');

                await token0.approve(router1.address, amountIn);
                await router1.swapExactTokensForTokens(amountIn, amountOut, [token0A, token1A], owner.address, Math.floor(new Date().getTime() / 1000) + 3600);
                await token1.approve(router2.address, amountIn2);


                const providers = [];
                for (const url of urls) {
                    const provider = new ethers.providers.JsonRpcProvider(url);
                    providers.push(provider);
                }

                const nonce = await ethers.provider.getTransactionCount(wallet.address);
                const txNotSigned = await router2.connect(wallet).populateTransaction.swapExactTokensForTokens(amountIn2, amountOut2, [token1A, token0A], owner.address, Math.floor(new Date().getTime() / 1000) + 3600, {
                    gasLimit: BigNumber.from('2500000'),
                    gasPrice: BigNumber.from('5000000000'),
                    from: wallet.address,
                    nonce
                });

                txNotSigned.chainId = 56;

                const signedTx = await wallet.signTransaction(txNotSigned);

                const time = new Date().getTime();
                const tx = await Promise.all(providers.map(provider => {
                    console.log('send', provider.connection.url);
                    return axios.post(provider.connection.url, {
                        method: 'eth_sendRawTransaction',
                        params: [signedTx],
                        id: 46,
                        jsonrpc: '2.0'
                    }).then(({data})=>{
                        console.log('data', new Date().getTime() - time, provider.connection.url, data);
                    }).catch(error=>{
                        console.log('error', error);
                    })
                }));

//                console.log('diff='+ diff);
//                console.log('prop='+ prop, prop.toNumber() / (10**8));
                //uniswapPairB.swap(amountOutA, amountA, address(this), "");
            }
            const balanceAfter = await token0.balanceOf(owner.address);

            const diff = balanceAfter.sub(balanceBefore);
            console.log('\n');
            console.log('diff='+diff);

        });
    });
});
