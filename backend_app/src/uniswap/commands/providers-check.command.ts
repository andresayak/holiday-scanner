import {Command} from 'nestjs-command';
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
    async create() {

        const url1 = 'wss://rpc.ankr.com/bsc/ws/' + this.envService.get('ANKR_PROVIDER_KEY');
        console.log('url1', url1);
        //const url2 = 'wss://frequent-purple-fire.bsc.discover.quiknode.pro/' + this.envService.get('QUIKNODE_PROVIDER_KEY') + '/';
        const url2 = 'ws://65.21.195.47:8545';
        const jsonProvider1 = new providers.WebSocketProvider(url1);
        const jsonProvider2 = new providers.WebSocketProvider(url2);

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
        jsonProvider2.on("block", (blockNumber) => {
            check('ANKR', blockNumber);
        });
        jsonProvider1.on("block", (blockNumber) => {
            check('NODE', blockNumber);
        });
    }
}
