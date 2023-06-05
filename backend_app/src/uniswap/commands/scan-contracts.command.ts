import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import {RedisClient} from 'redis';
import axios from "axios";
import {EthProviderFactoryType} from "../uniswap.providers";

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
export class ScanContractsCommand {
    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_SUBSCRIBER_CLIENT')
                private readonly redisSubscriberClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {

    }

    @Command({
        command: 'scan:contracts',
        autoExit: true
    })
    async create() {

        const mainProvider = this.providers('http');

        const wallet= new Wallet(this.envService.get('ETH_PRIVATE_KEY'), mainProvider);
        const pairs = await this.pairRepository.find({
            where: {
                network: this.envService.get('ETH_NETWORK'),
                fee: null
            }
        });

        let index = 0;
        for (const pair of pairs) {
            console.log(++index + '/' + pairs.length, pair.address);
            const contractSource = await getContractSource(pair.address, this.envService.get('ETHERSCAN_API'));
            if (contractSource[0] && contractSource[0].ABI !== 'Contract source code not verified') {
                const source = contractSource[0].SourceCode;
                const ABI = JSON.parse(contractSource[0].ABI);
                const matches = source.matchAll(/balance(\d)Adjusted = \(?balance\d\.mul\((\d+)\)\.sub\(amount\dIn\.mul\((\d+)\)\)/ig);
                const fees = [];
                for (const match of matches) {
                    fees.push([parseInt(match[2]), parseInt(match[3])]);
                }
                if (!fees.length) {
                    const match = source.match(/uint balance0Adjusted = balance0\.mul\((\d+)\)\.sub\(amount0In\.mul\(_swapFee\)\);/);
                    if (match) {
                        const pairContract = ContractFactory.getContract(pair.address, ABI, wallet);
                        const scale = parseInt(match[1]);
                        const swapFee = parseInt(await pairContract.swapFee());
                        console.log('swap fee', swapFee);
                        fees.push([scale, swapFee]);
                        fees.push([scale, swapFee]);
                    } else {
                        const match1 = source.match(/mul\(1e4\)\.sub\(amount0In\.mul\(IMdexFactory\(factory\)\.getPairFees\(address\(this\)/);
                        if (match1) {
                            const factorySource = await getContractSource(pair.factory, this.envService.get('ETHERSCAN_API'));
                            if (factorySource[0] && factorySource[0].ABI !== 'Contract source code not verified') {
                                const factoryABI = JSON.parse(factorySource[0].ABI);
                                const factoryContract = ContractFactory.getContract(pair.factory, factoryABI, wallet);
                                const fee = parseInt((await factoryContract.getPairFees(pair.address)).toString());
                                console.log('MdexFactory fee', fee);
                                fees.push([10000, fee]);
                                fees.push([10000, fee]);
                            }
                        }
                    }
                }
                console.log('fees', fees);
                if (!fees.length) {
                    console.log('fee not found');
                } else {
                    const notAllowed = source.match(/Not Allowed/);
                    if (notAllowed) {
                        pair.status = 'NotAllowed';
                    } else {
                        pair.status = 'Success';
                    }
                    if (fees[0][1] == fees[1][1]) {
                        pair.isVerified = true;
                        pair.fee = fees[0][1];
                        pair.fee_scale = fees[0][0];
                        await this.pairRepository.save(pair);
                    } else {
                        console.log('diff fees');
                    }
                }
            } else {
                pair.isVerified = false;
                await this.pairRepository.save(pair);
                console.log('not have source');
            }
        }
    }
}
