import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import axios from "axios";
import * as geoip from 'geoip-lite';
import {PeerEntity} from "../entities/peer.entity";
import {PeerHistoryEntity} from '../entities/peer-history.entity';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CheckPeersCommand {
    constructor(private readonly envService: EnvService,
                @Inject('PEER_REPOSITORY')
                private readonly peerRepository: Repository<PeerEntity>,
                @Inject('PEER_HISTORY_REPOSITORY')
                private readonly peerHistoryRepository: Repository<PeerHistoryEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType
    ) {
    }

    @Cron('0 * * * * *')
    async handleCron() {
        await this.create('node2');
    }
    @Command({
        command: 'check:peers <providerName>',
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

        const chunkSize = 20;
        for (let i = 0; i < peers.length; i += chunkSize) {
            const chunk = peers.slice(i, i + chunkSize);
            console.log('page', i, i + chunkSize);
            await Promise.all(chunk.map((peer, index) => {
                return new Promise(async (done) => {
                    let name = peer.name;
                    let enode = '';
                    const enodeResult = peer.enode.match(/\:\/\/([^@]+)@/);
                    if (enodeResult) {
                        enode = enodeResult[1];
                    }
                    const [ip_address, port] = peer.network.remoteAddress.split(':');
                    const geo = await geoip.lookup(ip_address);
                    console.log(++count + '/' + peers.length, enode, ip_address + '\t', geo);
                    let peerEntity = await this.peerRepository.findOne({
                        where: {
                            enode
                        }
                    });
                    let insert = false;
                    if (!peerEntity) {
                        peerEntity = new PeerEntity({
                            enode
                        });
                        insert = true;
                    }
                    const prevName = peerEntity.name;
                    const extraMath = name.match(/go[\.\d]+/);
                    if(extraMath){
                        name = extraMath[0];
                        peerEntity.fill({
                            ip_address,
                            name,
                            port,
                            country: geo?.country,
                            region: geo?.region,
                            city: geo?.city,
                            latitude: geo?.ll[0],
                            longitude: geo?.ll[1],
                            enode
                        });
                        peerEntity = await this.peerRepository.save(peerEntity);
                        if(insert || prevName!==name){
                            await this.peerHistoryRepository.save(new PeerHistoryEntity({
                                name,
                                peer_id: peerEntity.id,
                            }));
                        }
                    }
                    done(true)
                });
            }));
        }
        console.log('Done!');
    }
}
