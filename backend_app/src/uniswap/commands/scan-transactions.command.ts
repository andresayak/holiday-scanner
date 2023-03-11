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

const getHistory = async (address, page = 1, offset = 10, apiKey: string) => {
    const url = 'https://api.bscscan.com/api' +
        '?module=account' +
        '&action=txlist' +
        '&address=' + address +
        '&startblock=0' +
        '&endblock=99999999' +
        '&page=' + page +
        '&offset=' + offset +
        '&sort=asc' +
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
                private readonly pairRepository: Repository<PairEntity>) {

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
        console.log(this.envService.get('ETHERSCAN_API'));


        const url = getBSCProviderUrl();
        console.log('providerUrl', url);
        const transactions = await getHistory(walletAddress, page, 1000, this.envService.get('ETHERSCAN_API'));
        const chunkSize = 20;
        let providers: any = {};
        let count = 0;
        for (let i = 0; i < transactions.length; i += chunkSize) {
            const chunk = transactions.slice(i, i + chunkSize);
            await Promise.all(chunk.map((transaction, index) => {
                return new Promise(async (done) => {
                    try {
                        if (!providers[index]) {
                            providers[index] = new ethers.providers.JsonRpcProvider(url);
                        }
                        await this.processReceipt(providers[index], transaction.hash, () => {
                            console.log((++count) + '/' + transactions.length);
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
                                address: token0,
                            }));
                        } catch (e) {
                            console.log('save token0 error', e.toString());
                        }
                        try {
                            await this.tokenRepository.save(new TokenEntity({
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
