import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {providers} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import * as colors from 'colors';

@Injectable()
export class ProvidersCheckCommand {
    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>) {
    }

    @Command({
        command: 'provider:compare',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'url1',
            type: 'string'
        })
            provider1Url: string,
        @Positional({
            name: 'url2',
            type: 'string'
        })
            provider2Url: string,
    ) {
        const jsonProvider1 = new providers.WebSocketProvider(provider1Url);
        const jsonProvider2 = new providers.WebSocketProvider(provider2Url);

        let lastBlock = {
            block: 0,
            time: 0
        };
        let blockTime = {};
        const check = (nodeName, blockNumber) => {
            const text = ' --------- new block ' + nodeName + ' [' + blockNumber + ']';
            if (blockNumber > lastBlock.block) {
                const time = new Date().getTime();
                lastBlock = {
                    block: blockNumber,
                    time: time
                };
                blockTime[blockNumber] = time;
                return console.log(new Date(), colors.green(text + ' OK'));
            }
            if (blockTime[blockNumber]) {
                const timeStart = blockTime[blockNumber];
                delete blockTime[blockNumber];
                console.log(new Date(), colors.red(text + ' OLD ' + (timeStart - new Date().getTime()) / 1000 + 'sec'));
            }
        }
        jsonProvider1.on("block", (blockNumber) => {
            check('NODE1', blockNumber);
        });
        jsonProvider2.on("block", (blockNumber) => {
            check('NODE2', blockNumber);
        });
    }
}
