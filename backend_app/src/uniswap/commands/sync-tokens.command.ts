import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from "redis";

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
        for (const token of tokens) {
            count++;
            await new Promise((done) => this.redisPublisherClient.set('token_' + token.address, JSON.stringify(token), done));
        }

        console.log('Done! count=' + count);
    }
}
