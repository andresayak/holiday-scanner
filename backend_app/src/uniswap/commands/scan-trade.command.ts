import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {BigNumber, ContractFactory, utils, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';
import {balanceHuman} from "../helpers/calc";
import * as MultiSwapAbi from "../../contracts/MultiSwap.json";
import {processVariants} from './helpers/processVariants';
import {EthProviderFactoryType} from "../uniswap.providers";


@Injectable()
export class ScanTradeCommand {
    iface: Interface;

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_SUBSCRIBER_CLIENT')
                private readonly redisSubscriberClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {

        const swapInterface = [
            'event Sync(uint112 reserve0, uint112 reserve1)'
        ];

        this.iface = new utils.Interface(swapInterface);
    }

    @Command({
        command: 'scan:trade',
        autoExit: false
    })
    async create() {

        let openTrade = false;
        const gasLimit = BigNumber.from('215000');
        const gasPrice = BigNumber.from('6000000000');

        const mainProvider = this.providers('http');

        const multiSwapAddress = this.envService.get('MULTI_SWAP_ADDRESS');
        const wallet= new Wallet(this.envService.get('ETH_PRIVATE_KEY'), mainProvider);

        const balance = await wallet.getBalance();
        console.log(' - account address: ' + wallet.address);
        console.log(' - account balance: ' + balanceHuman(balance));
        console.log('multiSwapAddress=', multiSwapAddress);

        const multiSwapContract = ContractFactory.getContract(multiSwapAddress, MultiSwapAbi.abi, wallet);

        this.redisSubscriberClient.subscribe('pairs');
        this.redisSubscriberClient.on('message', (channel, data) => {
            const json = JSON.parse(data);
            const success = processVariants({
                pairs: json.pairs, gasLimit, gasPrice
            });
            if (success.length) {
                console.log(success[0]);
                if (!openTrade) {
                    openTrade = true;
                    /*MakeTrade({
                        success: success[0], blockNumber: json.blockNumber, liveCount: json.liveCount,
                        pairs: json.pairs, multiSwapContract
                    }).then(() => {
                        openTrade = false;
                    });*/
                }
            }
        });
        console.log('listening...');
    }


}
