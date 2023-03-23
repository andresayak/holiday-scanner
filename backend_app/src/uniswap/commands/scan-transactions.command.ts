import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ethers} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import * as pairAbi from '../../contracts/UniswapV2Pair.json';
import axios from 'axios';
import {getBSCProviderUrl} from '../helpers/provider';
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
export class ScanTransactionsCommand {
    iface: Interface;

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
        command: 'scan:transactions <address> <page>',
        describe: '',
        autoExit: true
    })
    async create(
        @Positional({
            name: 'address',
            type: 'string'
        })
            walletAddress: string,
        @Positional({
            name: 'page',
            type: 'number'
        })
            page: number,
    ) {
        const provider = this.providers('http', this.envService.get('ETH_NETWORK'), 'ankr');

        const transactions = await getHistory(walletAddress, page, 10000, this.envService.get('ETHERSCAN_API'));
        console.log('transactions', transactions);
        const chunkSize = 20;
        let count = 0;
        for (let i = 0; i < transactions.length; i += chunkSize) {
            const chunk = transactions.slice(i, i + chunkSize);
            await Promise.all(chunk.map((transaction, index) => {
                return new Promise(async (done) => {
                    try {
                        await this.processReceipt(provider, transaction.hash, () => {
                            console.log((++count) + '/' + transactions.length + ' ' + transaction.hash);
                        });
                    } catch (e) {
                        console.log('processReceipt error', e.toString())
                    }

                    done(true);
                });
            }));
        }
    }

    async processReceipt(provider, hash, incCount: () => void) {
        const receipt = await provider.getTransactionReceipt(hash);
        console.log('receipt', hash, receipt);
        if (receipt) {
            incCount();
            for (const event of receipt.logs) {

                try {
                    this.iface.decodeEventLog('Swap', event.data, event.topics);
                    const pairAddress = event.address.toLowerCase();
                    const pair = await this.pairRepository.findOne({
                        where: {
                            address: pairAddress
                        }
                    });
                    if (!pair) {
                        const pairContract = new ethers.Contract(pairAddress, pairAbi.abi, provider);
                        const factory = (await pairContract.factory()).toLowerCase();
                        const token0 = (await pairContract.token0()).toLowerCase();
                        const token1 = (await pairContract.token1()).toLowerCase();

                        try {
                            await this.pairRepository.save(new PairEntity({
                                network: this.envService.get('ETH_NETWORK'),
                                address: pairAddress,
                                factory,
                                token0,
                                token1
                            }));
                        } catch (e) {
                            console.log('save pair error', e.toString());
                        }
                        try {
                            await this.tokenRepository.save(new TokenEntity({
                                network: this.envService.get('ETH_NETWORK'),
                                address: token0,
                            }));
                        } catch (e) {
                            console.log('save token0 error', e.toString());
                        }
                        try {
                            await this.tokenRepository.save(new TokenEntity({
                                network: this.envService.get('ETH_NETWORK'),
                                address: token1,
                            }));
                        } catch (e) {
                            console.log('save token1 error', e.toString());
                        }
                    }
                } catch (e) {
                }
            }
        }
    }
}
