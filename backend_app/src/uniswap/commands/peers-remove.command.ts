import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import axios from "axios";
import {PeerEntity} from "../entities/peer.entity";
import {PeerHistoryEntity} from '../entities/peer-history.entity';

@Injectable()
export class PeersRemoveCommand {
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
        command: 'peers:remove <providerName> <peerData>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
        @Positional({
            name: 'peerData',
            type: 'string'
        })
            peerData: string,
    ) {
        const jsonProvider = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);

        const {data: json} = await axios.post(jsonProvider.connection.url, {
            method: 'admin_removeTrustedPeer',
            params: [
                peerData
            ],
            id: 46,
            jsonrpc: '2.0'
        });

        console.log('admin_addTrustedPeer', json);

        const {data: json2} = await axios.post(jsonProvider.connection.url, {
            method: 'admin_removePeer',
            params: [
                peerData
            ],
            id: 46,
            jsonrpc: '2.0'
        });

        console.log('admin_removePeer', json2);


    }
}
