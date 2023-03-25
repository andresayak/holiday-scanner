import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import * as fs from "fs";
import axios from "axios";
import {RedisClient} from "redis";

const getContractSource = async (address, apiKey: string) => {
    const url = 'https://api.bscscan.com/api' +
        '?module=contract' +
        '&action=getsourcecode' +
        '&address=' + address +
        '&apikey=' + apiKey;
    console.log('url', url);
    const {data} = await axios.get(url);
    if (data.message != 'OK') {
        throw Error(data.message);
    }
    return data.result;
}


@Injectable()
export class SyncTokensCommand {
    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                ) {
    }

    @Command({
        command: 'sync:tokens',
        autoExit: false
    })
    async create() {
        const tokens = await this.tokenRepository.find({
            where: {
                network: this.envService.get('ETH_NETWORK'),
                isVerified: true,
                isTested: true,
            }
        });

        let count = 0;
        for(const token of tokens){
            count++;
            await new Promise((done)=>this.redisPublisherClient.set('token_'+token.address, JSON.stringify(token), done));
        }

        console.log('Done! count='+count);
    }
}
