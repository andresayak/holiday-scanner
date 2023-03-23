import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, utils, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';
import {EthProviderFactoryType} from "../uniswap.providers";
import * as fs from "fs";
import * as UniswapV2PairAbi from "../../contracts/UniswapV2Pair.json";


@Injectable()
export class ScanTestCommand {
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
        command: 'scan:test',
        autoExit: false
    })
    async create() {
        const filename = '1679192330884-0x4428c12db8f28ceedc720ae0ad96a63ac6e530d1c58a4f3204e8fcd985385ac2';
        const json  = JSON.parse(fs.readFileSync("/var/www/backend_app/storage/swaps/"+filename, 'utf-8'));

        const provider = this.providers('http', this.envService.get('ETH_NETWORK'), 'ankr');

        let wallet = Wallet.fromMnemonic(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(provider);

        const success = json['success'];
        const pairs = await this.pairRepository.find();
        console.log('pairs', pairs.length);
        const pair0 = await this.pairRepository.findOne({
            where: {
                address: success['pairs'][0]
            }
        });
        const pair1 = await this.pairRepository.findOne({
            where: {
                address: success['pairs'][1]
            }
        });
        const pair0Contract = ContractFactory.getContract(success['pairs'][0], UniswapV2PairAbi.abi, wallet);
        const pair1Contract = ContractFactory.getContract(success['pairs'][1], UniswapV2PairAbi.abi, wallet);

        const block = json['block'];// - 1;///26587475;
        console.log('block', block);
        let reserves0 = await pair0Contract.getReserves({blockTag: block});
        if (pair0.token0 == success.path[1]) {
            reserves0 = [reserves0[1], reserves0[0]];
        }
        let reserves1 = await pair1Contract.getReserves({blockTag: block});
        if (pair1.token1 == success.path[1]) {
            reserves1 = [reserves1[1], reserves1[0]];
        }

        console.log('json', json);

        console.log(' - reserves0[0]='+reserves0[0], reserves0[0]==success['reservers0'][0])
        console.log(' - reserves0[1]='+reserves0[1], reserves0[1]==success['reservers0'][1])
        console.log(' - reserves1[0]='+reserves1[0], reserves1[0]==success['reservers1'][0])
        console.log(' - reserves1[1]='+reserves1[1], reserves1[1]==success['reservers1'][1])

        for(const swap of success.swaps){

            const token0 = swap.path[0].toLowerCase();
            const token1 = swap.path[1].toLowerCase();
            const factory = swap.factory;
            const pair = pairs.find(pair => pair.factory == swap.factory
                && (
                    (pair.token0 == token0 && pair.token1 == token1) || (pair.token1 == token0 && pair.token0 == token1)
                )
            );
            if(pair){
                //console.log('swap' , swap);
            }else{
                console.log('pair not found', swap.path);
            }

        }
        console.log('listening...');
    }
}
