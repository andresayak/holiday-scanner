import {Command, Positional} from 'nestjs-command';
import {Injectable} from '@nestjs/common';
import {providers, Wallet} from 'ethers';
import {EnvService} from "../../env/env.service";
import {balanceHuman} from "../helpers/calc";

@Injectable()
export class WalletCheckCommand {

    constructor(private readonly envService: EnvService) {
    }

    @Command({
        command: 'wallet:balance <privateKey>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'privateKey',
            type: 'string'
        })
            privateKey: string,
    ) {
        const url = 'wss://rpc.ankr.com/bsc/ws/' + this.envService.get('ANKR_PROVIDER_KEY');
        const provider = new providers.WebSocketProvider(url);
        let wallet = new Wallet(privateKey).connect(provider);

        const balance = await wallet.getBalance();
        console.log(' - account address: ' + wallet.address);
        console.log(' - account balance: ' + balanceHuman(balance));
    }
}
