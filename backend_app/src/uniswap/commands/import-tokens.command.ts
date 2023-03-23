import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import * as fs from "fs";
import axios from "axios";

const getContractSource = async (address, apiKey: string) => {
    const url = 'https://api.bscscan.com/api' +
        '?module=contract' +
        '&action=getsourcecode' +
        '&address=' + address +
        '&apikey=' + apiKey;
    console.log('url', url);
    const {data} = await axios.get(url);
    if (data.message != 'OK') {
        throw Error(data.message);
    }
    return data.result;
}


@Injectable()
export class ImportTokensCommand {
    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>) {
    }

    @Command({
        command: 'import:tokens <filename>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'filename',
            type: 'string'
        })
            filename: string
    ) {
        let count = 0;

        const allTokens = fs.readFileSync("/var/www/backend_app/storage/" + filename, 'utf-8');
        const lines = allTokens.split(/\r?\n/);

        const chunkSize = 50;
        for (let i = 0; i < lines.length; i += chunkSize) {
            const chunk = lines.slice(i, i + chunkSize);
            await Promise.all(chunk.map((line, index) => {
                return new Promise(async (done) => {
                    if (line) {
                        const tokenAddress = line.trim().toLowerCase();
                        console.log(++count+') tokenAddress', tokenAddress);
                        let token = await this.tokenRepository.findOne({
                            where: {
                                address: tokenAddress
                            }
                        });
                        if (!token) {
                            token = new TokenEntity({
                                network: this.envService.get('ETH_NETWORK'),
                                address: tokenAddress,
                                isVerified: false,
                                isTested: false,
                            });
                        } else {
                            if (token.isVerified) {
                                return done(true);
                            }
                        }
                        /*const contractSource = await getContractSource(tokenAddress, this.envService.get('ETHERSCAN_API'));
                        if (contractSource[0] && contractSource[0].ABI !== 'Contract source code not verified') {
                            const source = contractSource[0].SourceCode;
                            const ABI = JSON.parse(contractSource[0].ABI);
                            await fs.writeFileSync("/var/www/backend_app/storage/contracts/" + tokenAddress, source);
                            token.isVerified = true;
                        } else {
                            token.isVerified = false;
                        }*/
                        await this.tokenRepository.save(token);
                        done(true);
                    }
                });
            }));
        }
    }
}
