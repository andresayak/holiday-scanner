import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, utils, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';
import {EthProviderFactoryType} from "../uniswap.providers";
import {TgBot} from "../TgBot";
import * as UniswapV2PairAbi from "../../contracts/UniswapV2Pair.json";

@Injectable()
export class CheckReservesCommand {
    iface: Interface;

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType,
                private readonly tgBot: TgBot,
    ) {

        const swapInterface = [
            'event Sync(uint112 reserve0, uint112 reserve1)'
        ];

        this.iface = new utils.Interface(swapInterface);
    }

    @Command({
        command: 'check:reserves <providerName>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string
    ) {

        const provider = this.providers('http', this.envService.get('ETH_HOST'), providerName);
        const wallet = new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider);
        const pairs = await this.pairRepository.find();

        let errorCount = 0;
        let emptyCount = 0;
        let total = pairs.length;
        let count = 0;
        for(const pair of pairs){
            console.log((++count)+'/'+total+') pair address', pair.address);
            let pairData: any = await new Promise((fetch) => this.redisPublisherClient.get('pair_' + pair.address, (err, reply) => {
                if (reply) {
                    const data = JSON.parse(reply);
                    if (data) {
                        fetch(data)
                    }
                }
                fetch(null);
            }));
            if(!pairData){
                console.log('Empty');
                emptyCount++;
            }else{
                console.log('pairData', pairData);
                const pair0Contract = await ContractFactory.getContract(pair.address, UniswapV2PairAbi.abi, wallet);
                const reserves = await pair0Contract.getReserves({
                    blockTag: pairData.blockNumber
                });
                if(reserves[0].toString() == pairData.reserve0.toString() && reserves[1].toString() == pairData.reserve1.toString()){
                    console.log('OK');
                }else{
                    console.log('Wrong');
                    errorCount++;
                }
            }
        }
        console.log('emptyCount = '+emptyCount, 'errorCount = '+errorCount);
    }
}
