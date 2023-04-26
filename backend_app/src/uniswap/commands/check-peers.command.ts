import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import {EthProviderFactoryType} from "../uniswap.providers";
import {RouterEntity} from "../entities/router.entity";
import {TransactionEntity} from "../entities/transaction.entity";
import axios from "axios";
import * as fs from "fs";
import * as geoip from 'geoip-lite';
import * as nmap from 'libnmap';
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
        const peers = json['result'].filter((item)=>item.network.static);
        for(const peer of peers){
            const [ip_address, port] = peer.network.remoteAddress.split(':');
            console.log(ip_address+'\t', );
            const geo = await geoip.lookup(ip_address);
            console.log('geo', geo);

            const exec = require('child_process').exec;
            const ping = await new Promise(done=>exec("ping -c 3 65.109.64.78", function (err, stdout, stderr) {
                if(stderr || err)
                console.log('stderr', stderr, err);
                const result = stdout.match(/min\/avg\/max\/mdev = [\d\.]+\/([\d\.]+)\/[\d\.]+\//);
                done(parseFloat(result[1]));
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
    }
}
