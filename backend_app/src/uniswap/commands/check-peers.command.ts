import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import axios from "axios";
import * as geoip from 'geoip-lite';
import {PeerEntity} from "../entities/peer.entity";

@Injectable()
export class CheckPeersCommand {
    constructor(private readonly envService: EnvService,
                @Inject('PEER_REPOSITORY')
                private readonly peerRepository: Repository<PeerEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType
    ) {
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
            console.log('page', i, i+chunkSize);
            await Promise.all(chunk.map((peer, index) => {
                return new Promise(async (done) => {
                    const name = peer.name;
                    const enode = peer.enode;
                    const [ip_address, port] = peer.network.remoteAddress.split(':');
                    const geo = await geoip.lookup(ip_address);
                    console.log(++count + '/' + peers.length, ip_address + '\t', geo);
                    let peerEntity = await this.peerRepository.findOne({
                        where: {
                            ip_address, port
                        }
                    });
                    if (!peerEntity) {
                        peerEntity = new PeerEntity({
                            ip_address, port
                        });
                    }
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
                    await this.peerRepository.save(peerEntity);
                    done(true)
                });
            }));
        }
        console.log('Done!');
    }
}
