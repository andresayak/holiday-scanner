import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import * as SwapFactoryAbi from "../../contracts/SwapFactory.json";
import * as UniswapV2PairAbi from "../../contracts/UniswapV2Pair.json";
import * as SwapRouter02Abi from "../../contracts/SwapRouter02.json";
import {EthProviderFactoryType} from "../uniswap.providers";

@Injectable()
export class ScanPairsCommand {
    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'scan:pairs <routerAddress>',
        describe: '',
        autoExit: true
    })
    async create(
        @Positional({
            name: 'routerAddress',
            type: 'string'
        })
            routerAddress: string
    ) {
        const network = this.envService.get('ETH_NETWORK');
        const provider = this.providers('http');

        let wallet = Wallet.fromMnemonic(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(provider);

        const routerContract = ContractFactory.getContract(routerAddress, SwapRouter02Abi.abi, wallet);
        const factoryAddress = await routerContract.factory();

        const factoryContract = ContractFactory.getContract(factoryAddress, SwapFactoryAbi.abi, wallet);

        const count = await factoryContract.allPairsLength();

        for (let i = 0; i < count; i++) {
            const pairAddress = (await factoryContract.allPairs(i)).toLowerCase();
            console.log(i + ' / ' + pairAddress);
            const pairContract = ContractFactory.getContract(pairAddress, UniswapV2PairAbi.abi, wallet);
            const token0 = (await pairContract.token0()).toLowerCase();
            const token1 = (await pairContract.token1()).toLowerCase();
            console.log(' - token0 = ' + token0);
            console.log(' - token1 = ' + token1);
            const reserves = await pairContract.getReserves();
            console.log(' - reserves0 = ' + reserves[0]);
            console.log(' - reserves1 = ' + reserves[1]);

            try {
                await this.pairRepository.save(new PairEntity({
                    network,
                    address: pairAddress,
                    factory: factoryAddress,
                    token0,
                    token1,
                    fee: network=='local'?'3':null,
                    fee_scale: network=='local'?'1000':null
                }));
            } catch (e) {
                console.log('save pair error', e.toString());
            }
            try {
                await this.tokenRepository.save(new TokenEntity({
                    network: this.envService.get('ETH_NETWORK'),
                    address: token0,
                }));
            } catch (e) {
                console.log('save token0 error', e.toString());
            }
            try {
                await this.tokenRepository.save(new TokenEntity({
                    network: this.envService.get('ETH_NETWORK'),
                    address: token1,
                }));
            } catch (e) {
                console.log('save token1 error', e.toString());
            }
        }
    }

}
