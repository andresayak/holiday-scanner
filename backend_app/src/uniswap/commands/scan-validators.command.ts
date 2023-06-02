import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import {LessThan, Repository} from "typeorm";
import {ValidatorEntity} from "../entities/validator.entity";
import {ValidatorHistoryEntity} from "../entities/validator-history.entity";
import * as utils from 'web3-utils';
import {RedisClient} from "redis";
import {TgBot} from "../TgBot";

@Injectable()
export class ScanValidatorsCommand {

    constructor(private readonly envService: EnvService,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                @Inject('VALIDATOR_REPOSITORY')
                private readonly validatorRepository: Repository<ValidatorEntity>,
                @Inject('VALIDATOR_HISTORY_REPOSITORY')
                private readonly validatorHistoryRepository: Repository<ValidatorHistoryEntity>,
                private readonly tgBot: TgBot,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'scan:validators <providerName>',
        describe: '',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
    ) {
        const jsonProvider = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);
        const wsProvider = this.providers('ws', this.envService.get('ETH_NETWORK'), providerName);

        wsProvider.on("block", (blockNumber) => {
            const timeStart = new Date();
            console.log(timeStart, ' --------- new block [' + blockNumber + ']');
            processBlock(blockNumber);
        });

        const processBlock = async (lastBlock: number) => {
            let blockData;
            while(true){
                blockData = await jsonProvider.getBlock(lastBlock);
                if(blockData){
                    break;
                }
            }
            const address = blockData.miner;
            const data = '0x' + blockData.extraData.substring(2, 66);
            const extraMath = utils.hexToAscii(data).toString().match(/go[\.\d]+/);
            if (extraMath) {
                console.log('extraMath', extraMath);
                const extra = extraMath[0];
                let validator = await this.validatorRepository.findOne({
                    address
                });
                if (!validator) {
                    validator = await this.validatorRepository.save(new ValidatorEntity({
                        address
                    }));
                }
                const prev = await this.validatorHistoryRepository.findOne({
                    where: {
                        validator_id: validator.id,
                        block_number: LessThan(blockData.number)
                    },
                    order: {
                        block_number: 'DESC'
                    }
                });

                const prevName = prev ? prev.extra : '';
                validator.fill({
                    extra,
                    address,
                    lastBlock,
                });
                console.log('validator', validator);
                console.log({
                    extra,
                    address,
                    lastBlock
                });
                await this.validatorRepository.save(validator);
                if (prevName !== extra) {
                    await this.validatorHistoryRepository.save(new ValidatorHistoryEntity({
                        extra,
                        validator_id: validator.id,
                        block_number: blockData.number,
                        last_block_number: blockData.number,
                    }));
                    await this.tgBot.sendMessage('Validator: '+validator.address+' updated to '+extra +' Block: '+lastBlock);
                }else{
                    prev.last_block_number = blockData.number;
                    await this.validatorHistoryRepository.save(prev);
                }
            }
        }
    }
}
