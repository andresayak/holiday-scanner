import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from "redis";
import {PeerEntity} from "../entities/peer.entity";
import {ValidatorEntity} from "../entities/validator.entity";
import {PeerHistoryEntity} from "../entities/peer-history.entity";
import {ValidatorHistoryEntity} from "../entities/validator-history.entity";

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
        autoExit: false
    })
    async create() {


        console.log('Done!');
    }
}
