import {Inject, Injectable} from "@nestjs/common";
import {EnvService} from "../../env/env.service";
import {IsNull, Repository} from "typeorm";
import {TokenEntity} from "../entities/token.entity";
import {EthProviderFactoryType} from "../uniswap.providers";
import {Command, Positional} from "nestjs-command";
import {BigNumber, ContractFactory, ethers, Signer, utils, Wallet} from 'ethers';
import {balanceHuman, BNB_CONTRACT} from "../helpers/calc";
import * as ERC20Abi from '../../contracts/ERC20.json';
import * as WETH9Abi from '../../contracts/WETH9.json';
import * as SwapRouter02Abi from '../../contracts/SwapRouter02.json';


const swapInterface = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
    'event Sync(uint112 reserve0, uint112 reserve1)'
];

const iface = new ethers.utils.Interface(swapInterface);

@Injectable()
export class TestTokensCommand {

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'test:tokens',
        autoExit: false
    })
    async create() {
        const provider = this.providers('ws', 'hardhat');

        const private_keys: string[] = [
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
            '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
            '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
            '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
            '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
            '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
            '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
            '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
            '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
            '0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897',
            '0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82',
            '0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1',
            '0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd',
            '0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa',
            '0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61',
            '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0',
            '0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd',
            '0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0',
            '0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e'
        ];
        let count = 0;
        while(true){
            const tokens = await this.tokenRepository.find({
                where:{
                    isTested: IsNull()
                },
                take: 100
            });
            if(!tokens.length){
                console.log('DONE');
                return;
            }
            const chunkSize = 1;
            for (let i = 0; i < tokens.length; i += chunkSize) {
                const chunk = tokens.slice(i, i + chunkSize);
                console.log('chunk', chunk, i, i + chunkSize);
                await Promise.all(chunk.map((token, index) => {
                    const account = new Wallet(private_keys[index], provider)
                        .connect(provider);
                    return new Promise(async (done) => {
                        if(token.address == BNB_CONTRACT.toLowerCase()){
                            token.isTested = true;
                            await this.tokenRepository.save(token);
                            return done(true);
                        }
                        console.log((++count)+') -- test '+token.address);
                        try{
                            await testToken(account, token.address);
                            token.isTested = true;
                        }catch (e){
                            console.log(e.toString());
                            if(!e.toString().match(/VM Exception while processing transaction/i)){
                                //process.exit(1);
                                await new Promise((done)=>setTimeout(()=>done(1),10000));
                                return done(true);
                            }
                            token.isTested = false;
                        }
                        await this.tokenRepository.save(token);
                        console.log('');
                        done(true);
                    })
                }));
            }
        }
    }
}

const testToken = async (account: Wallet, token1Address: string) => {

    const balance = await account.getBalance();
    console.log(' - account balance: '+balance, balanceHuman(balance));

    const routerAddress = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
    const token0Address = BNB_CONTRACT.toLowerCase();

    const amountIn = utils.parseEther("0.1");
    console.log('amountIn='+amountIn, balanceHuman(amountIn));
    let token0 = await ContractFactory.getContract(token0Address, WETH9Abi.abi, account);
    let token1 = await ContractFactory.getContract(token1Address, ERC20Abi.abi, account);

    const router = await ContractFactory.getContract(routerAddress, SwapRouter02Abi.abi, account);
    await token0.connect(account).deposit({
        value: amountIn.toString(),
        gasLimit: BigNumber.from('2000000'),
    });

    const buyTokens = async (amountIn) => {
        console.log(' - amountIn='+amountIn);
        const balance = await account.getBalance();
        console.log('balance='+balance);
        const balance00 = await token0.balanceOf(account.address);
        console.log('balance0='+balance00);
        const balance01 = await token1.balanceOf(account.address);
        console.log('balance01='+balance01);

        const tx = await router.connect(account)
            .swapExactETHForTokens(0, [token0.address, token1.address],
                account.address, Math.ceil(new Date().getTime()/1000) + 1000000000000, {
                    value: amountIn,
                    gasLimit: BigNumber.from('2000000'),
                });

        await tx.wait();
        const receipt = await tx.wait();
        for (const event of receipt.events) {
            //    console.log('event', event);
            try {
                const result = iface.decodeEventLog('Transfer', event.data, event.topics);
                console.log({
                    from: result.from.toLowerCase(),
                    to: result.to.toLowerCase(),
                    value: result.value.toString()
                });
            } catch (e) {
            }
        }
        const balance2 = await account.getBalance();
        console.log('balance='+balance2);
        const balance10 = await token0.balanceOf(account.address);
        console.log('balance10='+balance10);
        const balance11 = await token1.balanceOf(account.address);
        console.log('balance11='+balance11);
        const diff = balance2.sub(balance);
        const diff0 = balance10.sub(balance00);
        const diff1 = balance11.sub(balance01);
        return {
            diff, diff0, diff1
        }
    }

    const sellTokens = async (amountIn) => {
        console.log(' - amountIn='+amountIn);
        const balance = await account.getBalance();
        console.log('balance='+balance);
        const balance00 = await token0.balanceOf(account.address);
        console.log('balance0='+balance00);
        const balance01 = await token1.balanceOf(account.address);
        console.log('balance01='+balance01);
        await token1.approve(router.address, amountIn, {
            gasLimit: BigNumber.from('2000000'),
        });
        const tx = await router.connect(account)
            .swapExactTokensForETH(amountIn, 0, [token1.address, token0.address],
                account.address, Math.ceil(new Date().getTime()/1000) + 1000000000000,
                {
                    gasLimit: BigNumber.from('2000000'),
                }
            );

        await tx.wait();
        const balance2 = await account.getBalance();
        console.log('balance='+balance2);
        const balance10 = await token0.balanceOf(account.address);
        console.log('balance10='+balance10);
        const balance11 = await token1.balanceOf(account.address);
        console.log('balance11='+balance11);
        const diff = balance2.sub(balance);
        const diff0 = balance10.sub(balance00);
        const diff1 = balance11.sub(balance01);
        //await token0.withdraw(diff0);
        return {
            diff, diff0, diff1
        }
    }

    const {diff, diff0: diff00, diff1: diff10} = await buyTokens(amountIn);
    console.log('diff='+diff);
    console.log('diff00='+diff00);
    console.log('diff10='+diff10);
    console.log('');
    const {diff: diff2, diff0: diff01, diff1: diff11} = await sellTokens(diff10);
    console.log('diff='+diff2);
    console.log('diff01='+diff01);
    console.log('diff11='+diff11);
    const balanceLast = await account.getBalance();
    const diffTotal = balance.sub(balanceLast);
    console.log('diffTotal='+diffTotal, balanceHuman(diffTotal));
}
