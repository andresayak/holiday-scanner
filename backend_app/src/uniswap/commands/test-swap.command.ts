import {Inject, Injectable} from "@nestjs/common";
import {EnvService} from "../../env/env.service";
import {IsNull, MoreThan, Repository} from "typeorm";
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
import {TransactionEntity} from "../entities/transaction.entity";
import {TgBot} from "../TgBot";
import {balanceHuman} from "../helpers/calc";
import {Cron} from "@nestjs/schedule";

const bytecode = '0x60a060405234801561001057600080fd5b5033606081901b60805261128861004060003980610326528061084e52806108725280610a5652506112886000f3fe608060405234801561001057600080fd5b506004361061004c5760003560e01c80638978f7f7146100515780638da5cb5b146101c0578063d9d5a9b7146101e4578063f3fef3a3146102f8575b600080fd5b6101be600480360360a081101561006757600080fd5b8135919081019060408101602082013564010000000081111561008957600080fd5b82018360208201111561009b57600080fd5b803590602001918460208302840111640100000000831117156100bd57600080fd5b9193909290916020810190356401000000008111156100db57600080fd5b8201836020820111156100ed57600080fd5b8035906020019184602083028401116401000000008311171561010f57600080fd5b91939092909160208101903564010000000081111561012d57600080fd5b82018360208201111561013f57600080fd5b8035906020019184602083028401116401000000008311171561016157600080fd5b91939092909160208101903564010000000081111561017f57600080fd5b82018360208201111561019157600080fd5b803590602001918460208302840111640100000000831117156101b357600080fd5b509092509050610324565b005b6101c861084c565b604080516001600160a01b039092168252519081900360200190f35b6101be600480360360608110156101fa57600080fd5b81019060208101813564010000000081111561021557600080fd5b82018360208201111561022757600080fd5b8035906020019184602083028401116401000000008311171561024957600080fd5b91939092909160208101903564010000000081111561026757600080fd5b82018360208201111561027957600080fd5b8035906020019184602083028401116401000000008311171561029b57600080fd5b9193909290916020810190356401000000008111156102b957600080fd5b8201836020820111156102cb57600080fd5b803590602001918460208302840111640100000000831117156102ed57600080fd5b509092509050610870565b6101be6004803603604081101561030e57600080fd5b506001600160a01b038135169060200135610a54565b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03163314610385576040805162461bcd60e51b81526020600482015260016024820152606360f81b604482015290519081900360640190fd5b6060610468898980806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f820116905080830192505050505050508b89898080602002602001604051908101604052809392919081815260200183836020028082843760009201919091525050604080516020808d0282810182019093528c82529093508c92508b91829185019084908082843760009201919091525050604080516020808c0282810182019093528b82529093508b92508a918291850190849080828437600092019190915250610b5392505050565b9050898160028151811061047857fe5b6020026020010151106108405760008054600181810183558280527f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e5639091018c905582518291849181106104c857fe5b6020908102919091018101518254600181018455600093845291909220015581518190839060029081106104f857fe5b60209081029190910181015182546001810184556000938452918320909101558888828161052257fe5b604080517f70a082310000000000000000000000000000000000000000000000000000000081523060048201529051602092830294909401356001600160a01b0316936370a08231935060248083019392829003018186803b15801561058757600080fd5b505afa15801561059b573d6000803e3d6000fd5b505050506040513d60208110156105b157600080fd5b5051905088886000816105c057fe5b905060200201356001600160a01b03166001600160a01b031663a9059cbb8c8c60008181106105eb57fe5b905060200201356001600160a01b03168e6040518363ffffffff1660e01b815260040180836001600160a01b03166001600160a01b0316815260200182815260200192505050602060405180830381600087803b15801561064b57600080fd5b505af115801561065f573d6000803e3d6000fd5b505050506040513d602081101561067557600080fd5b505161067d57fe5b61074b828054806020026020016040519081016040528092919081815260200182805480156106cb57602002820191906000526020600020905b8154815260200190600101908083116106b7575b50505050508c8c80806020026020016040519081016040528093929190818152602001838360200280828437600081840152601f19601f820116905080830192505050505050508b8b80806020026020016040519081016040528093929190818152602001838360200280828437600092019190915250610cdc92505050565b808989600081811061075957fe5b604080517f70a082310000000000000000000000000000000000000000000000000000000081523060048201529051602092830294909401356001600160a01b0316936370a08231935060248083019392829003018186803b1580156107be57600080fd5b505afa1580156107d2573d6000803e3d6000fd5b505050506040513d60208110156107e857600080fd5b5051101561083d576040805162461bcd60e51b815260206004820152600160248201527f6200000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b50505b50505050505050505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b031633146108d1576040805162461bcd60e51b81526020600482015260016024820152606360f81b604482015290519081900360640190fd5b838360008181106108de57fe5b905060200201356001600160a01b03166001600160a01b031663a9059cbb8787600081811061090957fe5b905060200201356001600160a01b03168484600081811061092657fe5b905060200201356040518363ffffffff1660e01b815260040180836001600160a01b03166001600160a01b0316815260200182815260200192505050602060405180830381600087803b15801561097c57600080fd5b505af1158015610990573d6000803e3d6000fd5b505050506040513d60208110156109a657600080fd5b50516109ae57fe5b610a4c82828080602002602001604051908101604052809392919081815260200183836020028082843760009201919091525050604080516020808c0282810182019093528b82529093508b92508a91829185019084908082843760009201919091525050604080516020808b0282810182019093528a82529093508a925089918291850190849080828437600092019190915250610cdc92505050565b505050505050565b7f00000000000000000000000000000000000000000000000000000000000000006001600160a01b03163314610ab5576040805162461bcd60e51b81526020600482015260016024820152606360f81b604482015290519081900360640190fd5b604080517fa9059cbb0000000000000000000000000000000000000000000000000000000081523360048201526024810183905290516001600160a01b0384169163a9059cbb9160448083019260209291908290030181600087803b158015610b1d57600080fd5b505af1158015610b31573d6000803e3d6000fd5b505050506040513d6020811015610b4757600080fd5b5051610b4f57fe5b5050565b6060600284511015610bac576040805162461bcd60e51b815260206004820152600160248201527f6400000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b835167ffffffffffffffff81118015610bc457600080fd5b50604051908082528060200260200182016040528015610bee578160200160208202803683370190505b5090508481600081518110610bff57fe5b60200260200101818152505060005b6001855103811015610cd257600080610c64898481518110610c2c57fe5b6020026020010151888581518110610c4057fe5b6020026020010151898660010181518110610c5757fe5b6020026020010151610f11565b91509150610cae848481518110610c7757fe5b60200260200101518383898781518110610c8d57fe5b6020026020010151898881518110610ca157fe5b6020026020010151610fd5565b848460010181518110610cbd57fe5b60209081029190910101525050600101610c0e565b5095945050505050565b60005b6001825103811015610f0b576000610d20838381518110610cfc57fe5b6020026020010151848460010181518110610d1357fe5b60200260200101516110ff565b509050600080826001600160a01b0316858581518110610d3c57fe5b60200260200101516001600160a01b031614610d7057868460010181518110610d6157fe5b60200260200101516000610d8a565b6000878560010181518110610d8157fe5b60200260200101515b91509150600060028651038510610da15730610db9565b868560010181518110610db057fe5b60200260200101515b9050868581518110610dc757fe5b60200260200101516001600160a01b031663022c0d9f848484600067ffffffffffffffff81118015610df857600080fd5b506040519080825280601f01601f191660200182016040528015610e23576020820181803683370190505b506040518563ffffffff1660e01b815260040180858152602001848152602001836001600160a01b03166001600160a01b0316815260200180602001828103825283818151815260200191508051906020019080838360005b83811015610e94578181015183820152602001610e7c565b50505050905090810190601f168015610ec15780820380516001836020036101000a031916815260200191505b5095505050505050600060405180830381600087803b158015610ee357600080fd5b505af1158015610ef7573d6000803e3d6000fd5b505060019096019550610cdf945050505050565b50505050565b6000806000610f2085856110ff565b509050600080876001600160a01b0316630902f1ac6040518163ffffffff1660e01b815260040160606040518083038186803b158015610f5f57600080fd5b505afa158015610f73573d6000803e3d6000fd5b505050506040513d6060811015610f8957600080fd5b5080516020909101516dffffffffffffffffffffffffffff91821693501690506001600160a01b0387811690841614610fc3578082610fc6565b81815b90999098509650505050505050565b600080861161102b576040805162461bcd60e51b815260206004820152600160248201527f6500000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b60008511801561103b5750600084115b61108c576040805162461bcd60e51b815260206004820152600160248201527f6600000000000000000000000000000000000000000000000000000000000000604482015290519081900360640190fd5b60006110ae6110a1848663ffffffff61113016565b889063ffffffff61118e16565b905060006110c2828763ffffffff61118e16565b905060006110e6836110da8a8863ffffffff61118e16565b9063ffffffff6111fa16565b90508082816110f157fe5b049998505050505050505050565b600080826001600160a01b0316846001600160a01b031610611122578284611125565b83835b909590945092505050565b80820382811115611188576040805162461bcd60e51b815260206004820152601560248201527f64732d6d6174682d7375622d756e646572666c6f770000000000000000000000604482015290519081900360640190fd5b92915050565b60008115806111a9575050808202828282816111a657fe5b04145b611188576040805162461bcd60e51b815260206004820152601460248201527f64732d6d6174682d6d756c2d6f766572666c6f77000000000000000000000000604482015290519081900360640190fd5b80820182811015611188576040805162461bcd60e51b815260206004820152601460248201527f64732d6d6174682d6164642d6f766572666c6f77000000000000000000000000604482015290519081900360640190fdfea2646970667358221220560bb6bac9675076e882c588ca5fda41a4f29e38a256a5c3e7497e224aa61ace64736f6c63430006060033';

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
                @Inject('TRANSACTION_REPOSITORY')
                private readonly transactionRepository: Repository<TransactionEntity>,
                private readonly tgBot: TgBot,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    //@Cron('0 * * * * *')
    async cronTest(){
        if (process.env.NODE_ENV !== 'production'){
            return
        }
        const provider = this.providers('http', 'hardhat');
        const currentBlock= await provider.getBlockNumber();
        const transactions = await this.transactionRepository.find({
            where: {
                blockNumber: MoreThan(currentBlock - 30),
                isTested: false
            }
        });
        for (const transaction of transactions) {
            const realProfit = this.create(transaction.logs);
            const message = 'testing:' + (transaction.hash ? ' hash: ' + transaction.hash + "\n" : '')+' ['+currentBlock+']'
                + 'est. profit: ' + transaction.profit + '%, ' + transaction.profitReal + "\n"
                + 'real. profit: ' + realProfit;
            await this.tgBot.sendMessage(message);
            await this.transactionRepository.save(transaction.fill({
                isTested: true
            }))
        }
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
console.log('swapData' ,swapData);
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
        await provider.send('hardhat_impersonateAccount',['0x1c9e1efb444f7b6c4c6080c5439d902fcd670aed']);
        const ownerSigner = await provider.getSigner('0x1c9e1efb444f7b6c4c6080c5439d902fcd670aed');
        await checkAmounts(swapData, provider, wallet);

        //const multiSwapContract = await ContractFactory.getContract('0x3e958e0212b659cecf20e1a8de40cc24ceff83df', MultiSwapV2Abi.abi, ownerSigner);
        const multiSwapContract = await (await new ContractFactory(MultiSwapV2Abi.abi, bytecode)).connect(ownerSigner).deploy();
        await multiSwapContract.deployed();

        const {success, block, target, after, before} = swapData;

        const params = {
            gasLimit: BigNumber.from('700000'),
            gasPrice: target.gasPrice
        };

        const amountIn = success.amountIn;
        let token;
        if (success.path[0] == BNB_CONTRACT) {
            console.log('token deposit');
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
            .connect(ownerSigner)
            .swap(
                success.amountIn,
                success.pairs,
                success.path,
                [fee1, fee2],
                success.feeScales,
                params
            );

        console.log('tx', tx);

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
        return profit;
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

    //await checkPairTarget(before['pair0']['address'], [before['pair0']['reserve0'], before['pair0']['reserve1']], before['pair0']['token0'], wallet);
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
console.log('txSwap', txSwap);
    console.log('tx', txSwap.hash);
    const txSwapReceipt = await txSwap.wait();
console.log('txSwapReceipt.events', txSwapReceipt.events);
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

