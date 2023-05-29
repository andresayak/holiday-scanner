import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import axios from "axios";
import {PeerEntity} from "../entities/peer.entity";
import {PeerHistoryEntity} from '../entities/peer-history.entity';

@Injectable()
export class PeersListCommand {
    constructor(private readonly envService: EnvService,
                @Inject('PEER_REPOSITORY')
                private readonly peerRepository: Repository<PeerEntity>,
                @Inject('PEER_HISTORY_REPOSITORY')
                private readonly peerHistoryRepository: Repository<PeerHistoryEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType
    ) {
    }

    @Command({
        command: 'peers:list <providerName>',
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

        const {data: json} = await axios.post(jsonProvider.connection.url, {
            method: 'admin_peers',
            params: [],
            id: 46,
            jsonrpc: '2.0'
        });
        console.log('json', json);

        const peers = json['result'];

        let count = 0;
        for (let peer of peers) {
            count++;
            console.log(count, peer.enode);
        }
    }
}
