import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {Repository} from "typeorm";
import {EnvService} from "../../env/env.service";
import * as fs from "fs";
import {PairEntity} from "../entities/pair.entity";


@Injectable()
export class ImportPairsCommand {
    constructor(private readonly envService: EnvService,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>) {
    }

    @Command({
        command: 'import:pairs <filename>',
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

        const chunkSize = 1000;
        for (let i = 0; i < lines.length; i += chunkSize) {
            const chunk = lines.slice(i, i + chunkSize);
            await Promise.all(chunk.map((line, index) => {
                return new Promise(async (done) => {
                    if (line) {
                        const [routerAddress, factoryAddress, index, token0, token1] = line.toLowerCase().split(',');//.trim();
                        console.log(++count+') ', routerAddress);

                        let pair = await this.pairRepository.findOne({
                            where: {
                                address: routerAddress
                            }
                        });
                        if (!pair) {
                            await this.pairRepository.save(new PairEntity({
                                network: this.envService.get('ETH_NETWORK'),
                                address: routerAddress,
                                factory: factoryAddress,
                                token0: token0,
                                token1: token1,
                            }));
                        }
                        done(true);
                    }
                });
            }));
        }
    }
}
