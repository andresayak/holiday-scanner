const {ethers} = require("hardhat");

async function main() {
    if(!process.env['FACTORY_ADDRESS'] || !process.env['WETH_ADDRESS'] || !process.env['TOKEN0_ADDRESS'] || !process.env['TOKEN1_ADDRESS']){
        throw new Error('wrong env')
    }
    const [owner] = await ethers.getSigners();

    const WETH = await ethers.getContractAt("WETH9", process.env['WETH_ADDRESS']);
    const token0 = await ethers.getContractAt("Token", process.env['TOKEN0_ADDRESS']);
    const token1 = await ethers.getContractAt("Token", process.env['TOKEN1_ADDRESS']);

    console.log('balance WETH: '+await WETH.balanceOf(owner.address));
    console.log('balance token0 address: '+await token0.balanceOf(owner.address));
    console.log('balance token1 address: '+await token1.balanceOf(owner.address));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
