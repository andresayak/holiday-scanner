const {ethers} = require("hardhat");
const {utils} = require("ethers");
describe("BackRunner", () => {
    it('', async () => {

        const [owner, user1, user2] = await ethers.getSigners();

        const nonce = await ethers.provider.getTransactionCount(owner.address);
        const token0 = await (await ethers.getContractFactory("Token")).deploy("Token A", "TST", utils.parseEther("1000"));
        await token0.deployed();

        const amountIn = utils.parseEther("1");

        await token0.transfer(owner.address, amountIn);
        await ethers.provider.send("evm_setAutomine", [false]);
        await ethers.provider.send("evm_setIntervalMining", [5000]);

        const target = await token0.transfer(user1.address, amountIn.toString(), {
            gasPrice: '2770868472'
        });
        console.log('target', target)
        const gasPrice = target.gasPrice;
        const chainId = target.chainId;
        console.log('chainId', chainId)
        const maxPriorityFeePerGas = target.maxPriorityFeePerGas;
        const maxFeePerGas = target.maxFeePerGas;
        const targetHash = target.hash;
        console.log('targetHash', targetHash, ethers.BigNumber.from(targetHash));
        console.log(' - gasPrice: '+gasPrice);
        let status = true;
        let gasLimit = 667212;
        let count = 0;
        const timeStart = new Date();
        const attack = await token0.connect(owner).transfer(user2.address, amountIn.toString(), {
            type: 0,
            gasLimit: gasLimit,
            gasPrice: maxFeePerGas,
            nonce
        });
        await ethers.provider.send("evm_setAutomine", [true]);
        await attack.wait();
        await target.wait();

        console.log('Diff: '+((new Date().getTime()-timeStart)/1000)+' sec');
        const tx1 = await ethers.provider.getTransaction(attack.hash);
        const tx0 = await ethers.provider.getTransaction(target.hash);


        console.log('attack', tx1.hash, tx1.blockNumber, tx1.transactionIndex, 'gasPrice: '+tx1.gasPrice);
        console.log('target', tx0.hash, tx0.blockNumber, tx0.transactionIndex, 'gasPrice: '+tx0.gasPrice);

        console.log(count, 'attackHash >  targetHash', ethers.BigNumber.from(attack.hash).gt(target.hash));
        console.log('test');
    });
})
