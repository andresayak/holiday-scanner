const {ethers} = require("hardhat");

async function main() {
    if(!process.env['FACTORY_ADDRESS'] || !process.env['WETH_ADDRESS'] || !process.env['TOKEN0_ADDRESS'] || !process.env['TOKEN1_ADDRESS']){
        throw new Error('wrong env')
    }

    const factory = await ethers.getContractAt("UniswapV2Factory", process.env['FACTORY_ADDRESS']);
    const WETH = await ethers.getContractAt("WETH9", process.env['WETH_ADDRESS']);
    const token0 = await ethers.getContractAt("Token", process.env['TOKEN0_ADDRESS']);
    const token1 = await ethers.getContractAt("Token", process.env['TOKEN1_ADDRESS']);

    const router = await (await ethers.getContractFactory("UniswapV2Router02")).deploy(factory.address, WETH.address);

    const pairAddress =  await createPair(factory, token0.address, token1.address);
    const pair0Address =  await createPair(factory, WETH.address, token0.address);
    const pair1Address =  await createPair(factory, WETH.address, token1.address);

    console.log('ROUTER_ADDRESS='+router.address);
    console.log('pair Token0/token1 address: '+pairAddress);
    console.log('pair WETH/token0 address: '+pair0Address);
    console.log('pair WETH/token1 address: '+pair1Address);
}

const createPair = async(factory, tokenA, tokenB) => {
    const tx = await factory.createPair(tokenA, tokenB);
    const receipt = await tx.wait();
    const event = receipt.events.find(event => event.event == 'PairCreated');

    return event.args.pair;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
