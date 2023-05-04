import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import {PeerEntity} from "../entities/peer.entity";
import {ValidatorEntity} from "../entities/validator.entity";

@Injectable()
export class CheckPeersValidatorsCommand {
    constructor(private readonly envService: EnvService,
                @Inject('PEER_REPOSITORY')
                private readonly peerRepository: Repository<PeerEntity>,
                @Inject('VALIDATOR_REPOSITORY')
                private readonly validatorRepository: Repository<ValidatorEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType
    ) {
    }

    @Command({
        command: 'check:peers-validators',
        autoExit: false
    })
    async create() {
        const peers = await this.peerRepository.find();
        const validators = await this.validatorRepository.find();

        const stats = {};

        for (const peer of peers) {
            if (!stats[peer.ip_address]) {
                stats[peer.ip_address] = {
                    count: 0,
                    validators: 0,
                    probability: 0
                };
            }
            stats[peer.ip_address]['count']++;
            for (const validator of validators) {
                const match = validator.extra.match(/go([\d\.]+)/);
                if (match && peer.name) {
                    const version = match[1];
                    const reg = 'go' + version.replaceAll('.', '\\.');
                    const result = peer.name.match(new RegExp(reg, 'ig'));
                    if (result) {
                        stats[peer.ip_address]['validators']++;
                    }
                }
            }
        }
        console.log('items', Object.values(stats).length);
        const items = Object.fromEntries(Object.entries(stats).filter(([index, item]: any) => {
            return item.validators > 0;
        }));
        let list: any = [];
        for (const peer of peers) {
            if (items[peer.ip_address] && peer.enode) {
                if(peer.ping && peer.ping > 1){
                    continue;
                }
                let status = false;
                for (const validator of validators) {
                    const match = validator.extra.match(/go([\d\.]+)/);
                    if (match && peer.name) {
                        status = true;
                        continue;
                    }
                }
                if(status){
                    list.push(peer.enode);
                }
            }
        }
        console.log(list.join("\n"));
        console.log('Done!');
    }
}
