import {Inject, Injectable} from "@nestjs/common";
import {EnvService} from "../../env/env.service";
import {IsNull, Repository} from "typeorm";
import {TokenEntity} from "../entities/token.entity";
import {EthProviderFactoryType} from "../uniswap.providers";
import {Command, Positional} from "nestjs-command";
import {BigNumber, ContractFactory, ethers, Signer, utils, Wallet} from 'ethers';
import * as fs from "fs";
import * as MultiSwapV2Abi from '../../contracts/MultiSwapV2.json';
import * as UniswapV2PairAbi from '../../contracts/UniswapV2Pair.json';
import * as WETH9Abi from '../../contracts/WETH9.json';
import * as ERC20Abi from '../../contracts/ERC20.json';
import * as SwapRouter02Abi from '../../contracts/SwapRouter02.json';

import {expect} from "chai";
import {BaseProvider, JsonRpcProvider} from "@ethersproject/providers";

const BNB_CONTRACT = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const holders = {
    [BNB_CONTRACT.toLowerCase()]: '0xf977814e90da44bfa03b6295a0616a897441acec',
    '0xe9e7cea3dedca5984780bafc599bd69add087d56': '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
};


const swapInterface = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
    'event Sync(uint112 reserve0, uint112 reserve1)'
];

const iface = new ethers.utils.Interface(swapInterface);

@Injectable()
export class TestSwapCommand {

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'test:swaps <filename>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'filename',
            type: 'string'
        })
            filename: string,
    ) {
        const provider = this.providers('http', 'hardhat');

        const swapData = JSON.parse(fs.readFileSync('/var/www/backend_app/storage/swaps/'+filename, 'utf-8'));

        await provider.send('hardhat_reset', [
                {
                    forking: {
                        jsonRpcUrl: `https://rpc.ankr.com/bsc/${this.envService.get('ANKR_PROVIDER_KEY')}`,
                        blockNumber: swapData.block,
                    },
                },
            ]);

        const currentBlock = await provider.getBlockNumber();
        console.log('currentBlock=',currentBlock);
        const wallet = new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);

        await checkAmounts(swapData, provider, wallet);

        const multiSwapContract = await (await new ContractFactory(MultiSwapV2Abi.abi, MultiSwapV2Abi.bytecode)).connect(wallet).deploy();
        await multiSwapContract.deployed();

        const {success, block, target, after, before} = swapData;

        const params = {
            gasLimit: BigNumber.from('700000'),
            gasPrice: target.gasPrice
        };

        const amountIn = success.amountIn;
        let token;
        if (success.path[0] == BNB_CONTRACT) {
            token = await ContractFactory.getContract(success.path[0], WETH9Abi.abi, wallet);

            const tx1 = await token.connect(wallet).deposit({
                value: amountIn.toString(),
            });
            await tx1.wait();
            const tx2 = await token.connect(wallet).transfer(multiSwapContract.address, amountIn.toString());
            await tx2.wait();
        } else {
            const address = holders[success.path[0]];
            console.log('holder = '+address);

            await provider.send('hardhat_impersonateAccount',[address]);

            const impersonatedSigner = await provider.getSigner(address);

            token = await ContractFactory.getContract(success.path[0], ERC20Abi.abi, wallet);
            const tx2 = await token.connect(impersonatedSigner)
                .transfer(multiSwapContract.address, amountIn.toString());
            await tx2.wait();
        }

        const balance1 = await token.balanceOf(multiSwapContract.address);
        console.log('success', success);

        console.log('swapData', swapData);

        let fee1 = success.fees[0];
        let fee2 = success.fees[1];

        console.log('balance1='+balance1);
        console.log('swap');
        const tx = await multiSwapContract
            .connect(wallet)
            .swap(
                success.amountIn,
                success.pairs,
                success.path,
                [fee1, fee2],
                success.feeScales,
                params
            );

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
        const balance2 = await token.balanceOf(multiSwapContract.address);

        const diff = balance2.sub(balance1);
        console.log('balance2='+balance2);
        console.log('diff='+diff);
        const profit = parseInt(diff.mul(10000).div(success.amountIn).toString())/100;
        console.log('profit='+profit+'%');

    }
}


const checkPairTarget = async (pairAddress: string, reserves, tokenAddress: string, wallet: Wallet) => {
    const pair0Contract = await ContractFactory.getContract(pairAddress, UniswapV2PairAbi.abi, wallet);
    const reservesContract = await pair0Contract.getReserves();
    const token0 = await pair0Contract.token0();
    const token1 = await pair0Contract.token1();

    console.log('reservesContract0=' + reservesContract[0]);
    console.log('reservesContract1=' + reservesContract[1]);
    if (token0.toLowerCase() == tokenAddress) {
        expect(reserves[0].toString()).to.equal(reservesContract[0].toString());
        expect(reserves[1].toString()).to.equal(reservesContract[1].toString());
    } else {
        expect(token1.toLowerCase()).to.equal(tokenAddress);
        expect(reserves[0].toString()).to.equal(reservesContract[1].toString());
        expect(reserves[1].toString()).to.equal(reservesContract[0].toString());
    }
}

const checkAmounts = async (data, provider: JsonRpcProvider, wallet: Wallet) => {
    const {success, block, target, after, before} = data;

    const currentBlock = await provider.getBlockNumber();
    console.log('currentBlock', block);
    expect(currentBlock).to.equal(block);

    await checkPairTarget(before['pair0']['address'], [before['pair0']['reserve0'], before['pair0']['reserve1']], before['pair0']['token0'], wallet);
    if (before['pair1'])
        await checkPairTarget(before['pair1']['address'], [before['pair1']['reserve0'], before['pair1']['reserve1']], before['pair1']['token0'], wallet);

    await provider.send('hardhat_impersonateAccount',[target.from]);

    const targetSigner = await provider.getSigner(target.from);
    const router = await ContractFactory.getContract(target.to, SwapRouter02Abi.abi, targetSigner);

    console.log('swap', target.method );
    let txSwap;
    if (target.method == 'swapExactTokensForTokens') {
        txSwap = await router.connect(targetSigner).swapExactTokensForTokens(
            target.params.amountIn,
            target.params.amountOutMin,
            target.params.path,
            target.from,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );
    } else if (target.method == 'swapExactTokensForETH') {
        txSwap = await router.connect(targetSigner).swapExactTokensForETH(
            target.params.amountIn,
            target.params.amountOutMin,
            target.params.path,
            target.from,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );
    } else if(target.method == 'swapExactETHForTokens') {
        txSwap = await router.connect(targetSigner).swapExactETHForTokens(
            target.params.amountOutMin,
            target.params.path,
            target.from,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                value: target.params.amountIn,
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );
    }else if(target.method == 'swapTokensForExactTokens') {
        txSwap = await router.connect(targetSigner).swapTokensForExactTokens(
            target.params.amountOut,
            target.params.amountInMax,
            target.params.path,
            target.from,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                value: target.params.amountIn,
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );
    }else if(target.method == 'swapTokensForExactETH') {
        txSwap = await router.connect(targetSigner).swapTokensForExactETH(
            target.params.amountOut,
            target.params.amountInMax,
            target.params.path,
            target.from,
            target.params.deadline + Math.ceil(new Date().getTime() / 1000),
            {
                value: target.params.amountIn,
                gasLimit: target.gasLimit,
                gasPrice: target.gasPrice
            }
        );

    }else{
        throw Error('wrong method [' + target.method + '] ');
    }

    console.log('tx', txSwap.hash);
    const txSwapReceipt = await txSwap.wait();

    console.log('amounts pair0:');
    const events0 = txSwapReceipt.events.filter((log) => log.address.toLowerCase() == before.pair0.address);
    for (const log of events0) {
        let result;
        try {
            result = iface.decodeEventLog('Swap', log.data, log.topics);
            console.log('result', result);
        } catch (e) {
        }
        if (result) {
            console.log('amount1In=' + after.amountRealIn0);
            console.log('amount0Out=' + after.amountRealOut0);
            if(before.pair0.token0 == target.params.path[0].toLowerCase()){
                expect(result['amount0In'].toString()).to.equal(after.amountRealIn0);
                expect(result['amount1Out'].toString()).to.equal(after.amountRealOut0);
            }else {
                expect(result['amount1In'].toString()).to.equal(after.amountRealIn0);
                expect(result['amount0Out'].toString()).to.equal(after.amountRealOut0);
            }
            continue;
        }
    }
    if (before['pair1']) {
        console.log('amounts pair1:');
        const events1 = txSwapReceipt.events.filter((log) => log.address.toLowerCase() == before.pair1.address);
        for (const log of events1) {
            let result;
            try {
                result = iface.decodeEventLog('Swap', log.data, log.topics);
                console.log('result', result);
            } catch (e) {
            }
            if (result) {
                console.log('amount1In=' + after.amountRealIn1);
                console.log('amount0Out=' + after.amountRealOut1);
                if (before.pair1.token0 == target.params.path[1].toLowerCase()) {
                    expect(result['amount0In'].toString()).to.equal(after.amountRealIn1);
                    expect(result['amount1Out'].toString()).to.equal(after.amountRealOut1);
                } else {
                    expect(result['amount1In'].toString()).to.equal(after.amountRealIn1);
                    expect(result['amount0Out'].toString()).to.equal(after.amountRealOut1);
                }
                continue;
            }
        }
    }

    await checkPairTarget(before['pair0']['address'], after['reserves0'], before['pair0']['token0'], wallet);
    if (before['pair1'])
        await checkPairTarget(before['pair1']['address'], after['reserves1'], before['pair1']['token0'], wallet);
}

