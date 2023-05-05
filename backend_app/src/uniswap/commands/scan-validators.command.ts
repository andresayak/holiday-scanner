import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import axios from 'axios';
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import {Repository} from "typeorm";
import {ValidatorEntity} from "../entities/validator.entity";
import {RequestService} from "./helpers/webdriveClient";
import {ProxyList} from "./helpers/ProxtList";

@Injectable()
export class ScanValidatorsCommand {

    constructor(private readonly envService: EnvService,
                @Inject('VALIDATOR_REPOSITORY')
                private readonly validatorRepository: Repository<ValidatorEntity>,
                private readonly proxyList: ProxyList,
                private readonly requestService: RequestService,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {

    }

    @Command({
        command: 'scan:validators <providerName>',
        describe: '',
        autoExit: true
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
    ) {
        await this.proxyList.fetch();
        const response = await this.requestService.request('https://bscscan.com/validators');
        console.log('response', response);
        return;
        const data = {
            data: []
        };
        const items = [];
        let count = 0;
        for(const item of data.data){
            if(!item['active'].match(/Yes/)){
                continue;
            }
            count++;
            let result = item['consensusAddress'].match(/<a href='\/address\/(0x[\d\w]+)' class='hash-tag text-truncate' data-toggle='tooltip' title='0x[\d\w]+'>([^<]+)</);
            let address = result[1];
            let name = result[2];

            result = item['blockLastValidated'].match(/<a href='\/block\/\d+'>(\d+)<\/a>/);

            let lastBlock = parseInt(result[1]);

            const {data} = await axios.get('https://bscscan.com/block/'+lastBlock, {});
            result = data.match(/ExtraVanity : ([^\n]+)/);
            let extra = '';
            if(result){
                extra = result[1];
            }

            console.log({
                extra,
                name,
                address,
                lastBlock
            })
            items.push({
                name,
                address,
                lastBlock
            });

            let validator = await this.validatorRepository.findOne({
                address
            });
            if(!validator){
                validator = new ValidatorEntity({
                    address
                });
            }
            validator.fill({
                extra,
                name,
                address,
                lastBlock
            });
            await this.validatorRepository.save(validator);
        }

        //const result = data.matchAll(/<a href='\/address\/(0x[\d\w]+)' class='hash-tag text-truncate' data-toggle='tooltip' title='0x[\d\w]+'>/ig);
        //for(const item of result){
        //    console.log('item', item[1]);
        //}
    }
}
