import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {EnvService} from "../../env/env.service";
import {EthProviderFactoryType} from "../uniswap.providers";

@Injectable()
export class ScanBlocksBotsCommand {

    constructor(private readonly envService: EnvService,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType
    ) {
    }

    @Command({
        command: 'scan:blocks-bot <providerName>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
    ) {
        const wsProvider1 = this.providers('ws', this.envService.get('ETH_NETWORK'), providerName);
        const jsonProvider1 = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);

        const address = '0x968e8ab3586a2d5a77d5cba382a04b429de02171';


    }
}
