import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import axios from "axios";
import {EthProviderFactoryType} from "../uniswap.providers";
import * as fs from 'fs';

const getContractSource = async (address, apiKey: string) => {
    const url = 'https://api.bscscan.com/api' +
        '?module=contract' +
        '&action=getsourcecode' +
        '&address=' + address +
        '&apikey=' + apiKey;
    const {data} = await axios.get(url);
    if (data.message != 'OK') {
        throw Error(data.message);
    }
    return data.result;
}

@Injectable()
export class ScanTokensContractsCommand {
    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_SUBSCRIBER_CLIENT')
                private readonly redisSubscriberClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'scan:token-contracts',
        autoExit: true
    })
    async create() {

        const tokens = await this.tokenRepository.find({
            where: {
                network: this.envService.get('ETH_NETWORK'),
                isVerified: null
            }
        });
        console.log('tokens=' + tokens.length);
        let count = 0;
        const chunkSize = 1;
        const apikeys = [
            this.envService.get('ETHERSCAN_API'),
            //'9HICMHD834BZSA8R4CIMXYFKKSP8G3PVJB',
            //'E5VUD2I1AFEE6VCN844CKGIIS4SX5RRZVC'
        ];
        for (let i = 0; i < tokens.length; i += chunkSize) {
            const chunk = tokens.slice(i, i + chunkSize);
            await Promise.all(chunk.map((token, index) => {
                return new Promise(async (done) => {
                    const contractSource = await getContractSource(token.address, apikeys[index]);
                    if (contractSource[0] && contractSource[0].ABI !== 'Contract source code not verified') {
                        const source = contractSource[0].SourceCode;
                        await fs.writeFileSync("/var/www/backend_app/storage/contracts/" + token.address, source);
                        token.isVerified = true;
                    } else {
                        token.isVerified = false;
                    }
                    console.log(++count + '/' + tokens.length, token.address, token.isVerified);
                    await this.tokenRepository.save(token);
                    done(true);
                });
            }));
            await new Promise(async (done) => {
                setTimeout(() => done(true), 100);
            });
        }
    }
}
