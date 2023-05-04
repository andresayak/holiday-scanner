import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import axios from 'axios';
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";
import {Repository} from "typeorm";
import {ValidatorEntity} from "../entities/validator.entity";

const scanValidators = async ()=>{
    const {data} = await axios.get('https://bscscan.com/datasourceHandler?q=getvalidators&draw=2&columns%5B0%5D%5Bdata%5D=rank&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=false&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=consensusAddress&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=false&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=votingpower&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=blockFirstValidated&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=blockLastValidated&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=validated1d&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=validated7d&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=true&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=validated30d&columns%5B7%5D%5Bname%5D=&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=true&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B8%5D%5Bdata%5D=active&columns%5B8%5D%5Bname%5D=&columns%5B8%5D%5Bsearchable%5D=true&columns%5B8%5D%5Borderable%5D=false&columns%5B8%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B8%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=2&order%5B0%5D%5Bdir%5D=desc&start=0&length=100&search%5Bvalue%5D=&search%5Bregex%5D=false&_='+(new Date().getTime()));

    const items = [];
    for(const item of data.data){
        const result = item['consensusAddress'].match(/<a href='\/address\/(0x[\d\w]+)' class='hash-tag text-truncate' data-toggle='tooltip' title='0x[\d\w]+'>/);
        console.log('result', result[1]);
        items.push(result[1]);
    }
    return items;
}

@Injectable()
export class ScanValidatorsCommand {

    constructor(private readonly envService: EnvService,
                @Inject('VALIDATOR_REPOSITORY')
                private readonly validatorRepository: Repository<ValidatorEntity>,
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
        const jsonProvider = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);
        const headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
            'referer': 'https://bscscan.com/validators',
        };
        const {data} = await axios.get('https://bscscan.com/datasourceHandler?q=getvalidators&draw=2&columns%5B0%5D%5Bdata%5D=rank&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=false&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=consensusAddress&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=false&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=votingpower&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=blockFirstValidated&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=blockLastValidated&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=validated1d&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=validated7d&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=true&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=validated30d&columns%5B7%5D%5Bname%5D=&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=true&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B8%5D%5Bdata%5D=active&columns%5B8%5D%5Bname%5D=&columns%5B8%5D%5Bsearchable%5D=true&columns%5B8%5D%5Borderable%5D=false&columns%5B8%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B8%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=2&order%5B0%5D%5Bdir%5D=desc&start=0&length=100&search%5Bvalue%5D=&search%5Bregex%5D=false&_='+(new Date().getTime()), {
            headers
        });

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
