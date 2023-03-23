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
        const provider = this.providers('ws', 'local');
        const account = new Wallet('0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e', provider)
            .connect(provider);

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
            for(const token of tokens){
                if(token.address == BNB_CONTRACT.toLowerCase()){
                    token.isTested = true;
                    await this.tokenRepository.save(token);
                    continue;
                }
                console.log((++count)+') -- test '+token.address);
                try{
                    await testToken(account, token.address);
                    token.isTested = true;
                }catch (e){
                    console.log(e.toString());
                    token.isTested = false;
                }
                await this.tokenRepository.save(token);
                console.log('');
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
                account.address, Math.ceil(new Date().getTime()/1000) + 1000, {
                    value: amountIn,
                    gasLimit: BigNumber.from('2000000'),
                });

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
        await token1.approve(router.address, amountIn);
        const tx = await router.connect(account)
            .swapExactTokensForETH(amountIn, 0, [token1.address, token0.address],
                account.address, Math.ceil(new Date().getTime()/1000) + 1000,
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
