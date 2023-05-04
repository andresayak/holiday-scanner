import {Command, Positional} from 'nestjs-command';
import {Injectable} from '@nestjs/common';
import {constants, providers, Wallet} from 'ethers';
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

        const { BigNumber } = require("ethers");

        const r01 = BigNumber.from(1000);
        const r02 = BigNumber.from(2000);
        const r11 = BigNumber.from(8000);
        const r12 = BigNumber.from(20000);

        //y = (r02 * r11 * 3 * r12 + r02 * 997 * r12 - r11 * x * 997 + x * r12 * 997) / (r02 * 997 * r11 + r01 * r11 * 997 - r11 * x * 997 + r02 * 997 * r12 + r11 * 3 * r02 * 997 + r01 * r12 * r11 * 3)




        console.log(y.toString());

        /*
        const url = 'wss://rpc.ankr.com/bsc/ws/' + this.envService.get('ANKR_PROVIDER_KEY');
        const provider = new providers.WebSocketProvider(url);
        let wallet = new Wallet(privateKey).connect(provider);

        const balance = await wallet.getBalance();
        console.log(' - account address: ' + wallet.address);
        console.log(' - account balance: ' + balanceHuman(balance));*/
    }
}
