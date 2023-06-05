import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {In, Repository} from "typeorm";
import {EnvService} from "../../env/env.service";
import {PeerEntity} from "../entities/peer.entity";
import {ValidatorEntity} from "../entities/validator.entity";
import {PeerHistoryEntity} from "../entities/peer-history.entity";
import {ValidatorHistoryEntity} from "../entities/validator-history.entity";
import { LessThan, MoreThan, Between } from 'typeorm'
import { format, addMinutes, subMinutes } from 'date-fns'
import {secretPrompt} from "../../env/secret.prompt";
export const MoreThanDate = (date: Date) => MoreThan(format(date, 'YYYY-MM-DD HH:MM:SS'))
export const LessThanDate = (date: Date) => LessThan(format(date, 'YYYY-MM-DD HH:MM:SS'))

function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
}

@Injectable()
export class CalcValidatorsCommand {
    constructor(private readonly envService: EnvService,
                @Inject('PEER_REPOSITORY')
                private readonly peerRepository: Repository<PeerEntity>,
                @Inject('PEER_HISTORY_REPOSITORY')
                private readonly peerHistoryRepository: Repository<PeerHistoryEntity>,
                @Inject('VALIDATOR_REPOSITORY')
                private readonly validatorRepository: Repository<ValidatorEntity>,
                @Inject('VALIDATOR_HISTORY_REPOSITORY')
                private readonly validatorHistoryRepository: Repository<ValidatorHistoryEntity>,
    ) {

    }

    @Command({
        command: 'calc:validators',
        autoExit: true
    })
    async create() {

        const items = await this.validatorHistoryRepository.createQueryBuilder()
            .select('validator_id',)
            .addSelect("COUNT(id)", "c")
            .groupBy('validator_id')
            .having('c > 1')
            .getRawMany();
        for(const {validator_id} of items){
            //if(validator_id!=10)
            //    continue;
            console.log('validator_id', validator_id);
            const historyItems = await this.validatorHistoryRepository.find({
                where: {
                    validator_id
                },
                order: {
                    createdAt: 'ASC'
                }
            });

            let prev = [];
            let index = 0;
            for(const historyItem of historyItems){
                console.log('historyItem', historyItem);
                const list = await this.peerHistoryRepository.find({
                    where: {
                        name: historyItem.extra
                    },
                    order: {
                        createdAt: 'ASC'
                    }
                });
                const uniqPeers = list.map(item=>item.peer_id).filter(onlyUnique);
                prev = prev.length ? uniqPeers.filter(element => prev.includes(element)): uniqPeers;
                //console.log('prev', prev);
                if(index){
                    const ends = await this.peerHistoryRepository.find({
                        where: {
                            name: historyItems[index-1].extra,
                            updatedAt: Between(subMinutes(historyItem.createdAt, 160), historyItem.createdAt),
                        }
                    });
                    const starts = await this.peerHistoryRepository.find({
                        where: {
                            name: historyItem.extra,
                            createdAt: Between(subMinutes(historyItem.createdAt, 30), addMinutes(historyItem.createdAt, 30)),
                        }
                    });
                    console.log('disabled', historyItems[index-1].extra, subMinutes(historyItem.createdAt, 160), historyItem.createdAt);
                    console.log('ends', ends);
                    console.log('enabled', historyItem.extra, subMinutes(historyItem.createdAt, 30), addMinutes(historyItem.createdAt, 30));
                    console.log('starts', starts);
                }
                index++;
            }
            console.log('prev', prev);
        }
        console.log('Done!');
    }
}
