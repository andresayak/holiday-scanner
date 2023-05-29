import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import {LessThan, MoreThan, Repository} from "typeorm";
import {ValidatorEntity} from "../entities/validator.entity";
import {ValidatorHistoryEntity} from "../entities/validator-history.entity";
import * as utils from 'web3-utils';
import {RedisClient} from "redis";
import {TgBot} from "../TgBot";

@Injectable()
export class ScanValidatorsRangeCommand {

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
        command: 'scan:validators-range <providerName> <blockStart> <blockEnd>',
        describe: '',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
        @Positional({
            name: 'blockStart',
            type: 'number'
        })
            blockStart: number,
        @Positional({
            name: 'blockEnd',
            type: 'number'
        })
            blockEnd: number,
    ) {
        const jsonProvider = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);

        const processBlock = async (blockData: {miner: string, extraData: string, number: number}) => {
            const address = blockData.miner;
            const data = '0x' + blockData.extraData.substring(2, 66);
            const extraMath = utils.hexToAscii(data).toString().match(/go[\.\d]+/);
            if (extraMath) {
                const extra = extraMath[0];
                let validator = await this.validatorRepository.findOne({
                    address
                });
                if (!validator) {
                    validator = await this.validatorRepository.save(new ValidatorEntity({
                        address
                    }));
                }else{
                    validator.updatedAt = new Date();
                    await this.validatorRepository.save(validator);
                }
                const current = await this.validatorHistoryRepository.findOne({
                    where: {
                        validator_id: validator.id,
                        block_number: blockData.number,
                    },
                });
                if(current){
                    return;
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
                if (prevName !== extra) {
                    await this.validatorHistoryRepository.save(new ValidatorHistoryEntity({
                        extra,
                        validator_id: validator.id,
                        block_number: blockData.number,
                        last_block_number: blockData.number,
                    }));
                    console.log('update', address, extra, prevName);
                }else{
                    prev.last_block_number = blockData.number;
                    await this.validatorHistoryRepository.save(prev);
                }
            }else{
                this.tgBot.sendMessage('extra not found, block='+blockData.number);
                throw Error('extra not found, block='+blockData.number);
            }
        }

        for(let lastBlock = blockStart; lastBlock <= blockEnd; lastBlock++ ){
            console.log(lastBlock);
            await processBlock(await jsonProvider.getBlock(lastBlock));
        }

        this.tgBot.sendMessage('Scan blocks '+blockStart+'-'+blockEnd+' finished');
        console.log('Done');
    }
}
