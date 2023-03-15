const {ethers} = require("hardhat");

async function main() {
    if(!process.env['FACTORY_ADDRESS'] || !process.env['WETH_ADDRESS'] || !process.env['TOKEN0_ADDRESS'] || !process.env['TOKEN1_ADDRESS']){
        throw new Error('wrong env')
    }
    const factory = await ethers.getContractAt("UniswapV2Factory", process.env['FACTORY_ADDRESS']);
    const WETH = await ethers.getContractAt("WETH9", process.env['WETH_ADDRESS']);
    const token0 = await ethers.getContractAt("Token", process.env['TOKEN0_ADDRESS']);
    const token1 = await ethers.getContractAt("Token", process.env['TOKEN1_ADDRESS']);

    const pairAddress = await factory.getPair(token0.address, token1.address);
    const pair0Address = await factory.getPair(WETH.address, token0.address);
    const pair1Address = await factory.getPair(WETH.address, token1.address);

    const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
    const pair0 = await ethers.getContractAt("UniswapV2Pair", pair0Address);
    const pair1 = await ethers.getContractAt("UniswapV2Pair", pair1Address);

    let reserves = await pair.getReserves();
    let reserves0 = await pair0.getReserves();
    let reserves1 = await pair1.getReserves();

    console.log('reserves Token0/token1: '+reserves[0]+' / '+reserves[1]);
    console.log('reserves WETH/token0 address: '+reserves0[0]+' / '+reserves0[1]);
    console.log('reserves WETH/token1 address: '+reserves1[0]+' / '+reserves1[1]);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
