const {ethers} = require("hardhat");
const {utils} = require("ethers");
const {bytecode} = require('../artifacts/@uniswap/v2-core/contracts/UniswapV2Pair.sol/UniswapV2Pair.json');
const {keccak256} = require("@ethersproject/solidity");

async function main() {

    const COMPUTED_INIT_CODE_HASH = keccak256(['bytes'], [`0x${bytecode.replace('0x', '')}`]).replace('0x', '');
    console.log('COMPUTED_INIT_CODE_HASH='+COMPUTED_INIT_CODE_HASH);

    const [owner] = await ethers.getSigners();

    factory = await (await ethers.getContractFactory("UniswapV2Factory")).deploy(owner.address);
    WETH = await (await ethers.getContractFactory("WETH9")).deploy();
    tokenA = await (await ethers.getContractFactory("Token")).deploy("Token A", "TST", utils.parseEther("1000"));
    tokenB = await (await ethers.getContractFactory("Token")).deploy("Token B", "TST", utils.parseEther("1000"));
    await factory.deployed();
    console.log('FACTORY_ADDRESS='+factory.address);
    await WETH.deployed();
    console.log('WETH_ADDRESS='+WETH.address);
    await tokenA.deployed();
    console.log('TOKEN0_ADDRESS='+tokenA.address);
    await tokenB.deployed();
    console.log('TOKEN1_ADDRESS='+tokenB.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
