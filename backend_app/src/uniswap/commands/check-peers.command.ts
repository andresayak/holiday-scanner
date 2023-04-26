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

        //const filebody = fs.readFileSync("/var/www/backend_app/storage/peers.txt", 'utf-8');
        //const json = JSON.parse(filebody);
        const peers = json['result'];//.filter((item)=>item.network.static);
        let i = 0;
        for(const peer of peers){
            const [ip_address, port] = peer.network.remoteAddress.split(':');
            console.log(++i+'/'+peers.length, ip_address+'\t', );
            const geo = await geoip.lookup(ip_address);
            console.log('geo', geo);

            const exec = require('child_process').exec;
            const ping = await new Promise<number | null>(done=>exec("ping -c 3 "+ip_address, function (err, stdout, stderr) {
                if(stderr || err)
                console.log('stderr', stderr, err);
                const result = stdout.match(/min\/avg\/max\/mdev = [\d\.]+\/([\d\.]+)\/[\d\.]+\//);
                done(result && result[1]?parseFloat(result[1]):null);
            }));
            console.log('timePing', ping);
            let peerEntity = await this.peerRepository.findOne({
                where: {
                    ip_address
                }
            });
            if(!peerEntity){
                peerEntity = new PeerEntity({});
            }
            peerEntity.fill({
                ip_address,
                port,
                country: geo?.country,
                region: geo?.region,
                city: geo?.city,
                latitude: geo?.ll[0],
                longitude: geo?.ll[1],
                ping
            });
            await this.peerRepository.save(peerEntity);
        }
        console.log('Done!');
    }
}
