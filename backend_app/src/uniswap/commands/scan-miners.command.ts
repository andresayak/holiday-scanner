import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ethers} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import axios from 'axios';
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {EthProviderFactoryType} from "../uniswap.providers";

const getHistory = async (address, page = 1, offset = 10, apiKey: string) => {
    const url = 'https://api.bscscan.com/api' +
        '?module=account' +
        '&action=txlist' +
        '&address=' + address +
        '&startblock=0' +
        '&endblock=99999999' +
        '&page=' + page +
        '&offset=' + offset +
        '&sort=desc' +
        '&apikey=' + apiKey;
    console.log('url', url);
    const {data} = await axios.get(url);
    if (data.message != 'OK') {
        throw Error(data.message);
    }
    return data.result;
}

@Injectable()
export class ScanMinersCommand {
    iface: Interface;
    miners: any = {}

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {

        const swapInterface = [
            'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
        ];

        this.iface = new ethers.utils.Interface(swapInterface);
    }

    @Command({
        command: 'scan:miners <providerName> <address> <chunkSize> <page>',
        describe: '',
        autoExit: true
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
        @Positional({
            name: 'address',
            type: 'string'
        })
            walletAddress: string,
        @Positional({
            name: 'chunkSize',
            type: 'number'
        })
            chunkSize: number = 1,
        @Positional({
            name: 'page',
            type: 'number'
        })
            page: number,
    ) {
        const provider = this.providers('http', this.envService.get('ETH_NETWORK'), providerName);
        const transactions = await getHistory(walletAddress, page, 10000, this.envService.get('ETHERSCAN_API'));
        console.log('transactions', transactions);
        let count = 0;
        for (let i = 0; i < transactions.length; i += chunkSize) {
            const chunk = transactions.slice(i, i + chunkSize);
            await Promise.all(chunk.map((transaction, index) => {
                return new Promise(async (done) => {
                    console.log((++count) + '/' + transactions.length + ' ' + transaction.hash);
                    try {
                        await this.processReceipt(transaction, provider, transaction.hash);
                    } catch (e) {
                        console.log('processReceipt error', e.toString())
                    }

                    done(true);
                });
            }));
        }
    }

    async processReceipt(tx, provider, hash) {
        const block = await provider.getBlock(parseInt(tx.blockNumber));
        const miner = block['miner'];
        const receipt = await provider.getTransactionReceipt(hash);
        if (!this.miners[miner]) {
            this.miners[miner] = {fail: 0, success: 0};
        }
        let status = false;
        if (receipt) {
            console.log('receipt', receipt);
            if(receipt.logs.length) {
                this.miners[miner].success++;
                status = true;
            }
        } else {
            console.log('no receipt', hash);
        }
        if (!status) {
            this.miners[miner].fail++;
        }
        console.log('miners', this.miners);
    }
}
