import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {In, Repository} from "typeorm";
import {EnvService} from "../../env/env.service";
import {PeerEntity} from "../entities/peer.entity";
import {ValidatorEntity} from "../entities/validator.entity";
import {PeerHistoryEntity} from "../entities/peer-history.entity";
import {ValidatorHistoryEntity} from "../entities/validator-history.entity";

function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
}

@Injectable()
export class CalcValidatorsFixCommand {
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
        command: 'calc:validators-fix',
        autoExit: true
    })
    async create() {

        const list = await this.peerHistoryRepository.find();

        for(const item of list){
            const extraMath = item.name.match(/go[\.\d]+/);
            let name;
            if(extraMath) {
                name = extraMath[0];
                if(name!=item.name){
                    console.log('name', item.name, name);
                    item.name = name;
                    await this.peerHistoryRepository.save(item);
                }
            }
        }

        console.log('Done!');
    }
}
