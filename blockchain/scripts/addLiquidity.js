const {ethers} = require("hardhat");
const {utils} = require("ethers");

async function main() {
    if(!process.env['ROUTER_ADDRESS'] || !process.env['WETH_ADDRESS'] || !process.env['TOKEN0_ADDRESS'] || !process.env['TOKEN1_ADDRESS']){
        throw new Error('wrong env')
    }

    const [owner] = await ethers.getSigners();

    const router = await ethers.getContractAt("UniswapV2Router02", process.env['ROUTER_ADDRESS']);
    const token0 = await ethers.getContractAt("Token", process.env['TOKEN0_ADDRESS']);
    const token1 = await ethers.getContractAt("Token", process.env['TOKEN1_ADDRESS']);

    const amount0 = utils.parseEther("10");
    const amount1 = utils.parseEther("10");
    let deadline = Math.floor(new Date().getTime() / 1000) + 3600;


    console.log('Approve0 '+token0.address);
    await token0.approve(router.address, amount0);
    console.log('Approve1 '+token1.address);
    await token1.approve(router.address, amount1);
    console.log('addLiquidity '+router.address);
    const tx = await router.addLiquidity(
        token0.address,
        token1.address,
        amount0,
        amount1,
        amount0,
        amount1,
        owner.address,
        deadline,
        {
            gasLimit: '9000000'
        }
    );
    console.log('Added! tx_hash='+tx.hash);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.toString());
        process.exit(1);
    });
