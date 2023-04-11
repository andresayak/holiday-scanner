import {Command, Positional} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import {EnvService} from "../../env/env.service";
import * as SwapFactoryAbi from "../../contracts/SwapFactory.json";
import * as UniswapV2PairAbi from "../../contracts/UniswapV2Pair.json";
import {EthProviderFactoryType} from "../uniswap.providers";
import {RedisClient} from "redis";
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

const factories = [
    '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
    '0x858e3312ed3a876947ea49d572a7c42de08af7ee',
    '0x4693b62e5fc9c0a45f89d62e6300a03c85f43137',
    '0x1e895bfe59e3a5103e8b7da3897d1f2391476f3c',
    '0x0ed713989f421ff6f702b2e4e1c93b1bb9002119',
    '0xf0bc2e21a76513aa7cc2730c7a1d6dee0790751f',
    '0xd404b033aca6621c76cbfed666c98088a822a78a',
    '0x0841bd0b734e4f5853f0dd8d7ea041c241fb0da6',
    '0x381fefadab5466bff0e8e96842e8e76a143e8f73',
    '0x80f112cd8ac529d6993090a0c9a04e01d495bfbf',
    '0xbcfccbde45ce874adcb698cc183debcf17952812',
    '0xb7e5848e1d0cb457f2026670fcb9bbdb7e9e039c',
    '0xc35dadb65012ec5796536bd9864ed8773abc74c4',
    '0x9a272d734c5a0d7d84e0a892e891a553e8066dce',
    '0x82f7af8110c67cfe4b26d3913964d91b8b5c432b',
    '0xe759dd4b9f99392be64f1050a6a8018f73b53a13',
    '0x89aab5f151d9f6568eacb218824acc3431b752ee',
    '0x71539d09d3890195dda87a6198b98b75211b72f3',
    '0x19e5ebc005688466d11015e646fa182621c1881e',
    '0x0a376ee063184b444ff66a9a22ad91525285fe1c',
    '0xcc5414e7ce73b717a14e682e9899785a13002db9',
    '0x1c3e50dbbcd05831c3a695d45d2b5bcd691ad8d8',
    '0x3fb1e7d5d9c974141a5b6e5fa4edab0a7aa15c6a',
    '0x5a2f40d36716cbc1040ece6de01a22eb1c6992c1',
    '0xd6715a8be3944ec72738f0bfdc739d48c3c29349',
];

@Injectable()
export class ScanPairsCommand {
    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                @Inject('ETH_PROVIDERS')
                private readonly providers: EthProviderFactoryType) {
    }

    @Command({
        command: 'scan:pairs <providerName>',
        describe: '',
    })
    async create(
        @Positional({
            name: 'providerName',
            type: 'string'
        })
            providerName: string,
    ) {
        const network = this.envService.get('ETH_NETWORK');
        const provider = this.providers('http', network, providerName);
        let currentBlock = await provider.getBlockNumber();
        provider.on("block", (blockNumber) => {
            currentBlock = blockNumber;
            const timeStart = new Date().getTime();
            const used = process.memoryUsage().heapUsed / 1024 / 1024;
            console.log(timeStart, ' --------- new block [' + blockNumber + ']', `memory ${Math.round(used * 100) / 100} MB`);
        });
        let wallet = new Wallet(this.envService.get('ETH_PRIVATE_KEY'), provider);

        for (const factoryAddress of factories) {
            const factoryContract = ContractFactory.getContract(factoryAddress, SwapFactoryAbi.abi, wallet);

            const count = await factoryContract.allPairsLength();
            let lastIndex: number = await new Promise(done => this.redisPublisherClient.get('lastFactoryIndex_' + factoryAddress, (err, reply) => {
                const number = parseInt(reply);
                if (number) {
                    return done(number);
                }
                done(0);
            }));
            console.log('factoryAddress', factoryAddress);
            console.log('lastIndex', lastIndex);
            for (let i = lastIndex; i < count; i++) {
                let pairAddress, token0, token1, reserves;
                const requestBlock = currentBlock;
                while (true){
                    try{
                        pairAddress = (await factoryContract.allPairs(i)).toLowerCase();
                        console.log(i + ' / ' + pairAddress);
                        const pairContract = ContractFactory.getContract(pairAddress, UniswapV2PairAbi.abi, wallet);
                        token0 = (await pairContract.token0()).toLowerCase();
                        token1 = (await pairContract.token1()).toLowerCase();
                        console.log(' - token0 = ' + token0);
                        console.log(' - token1 = ' + token1);
                        reserves = await await pairContract.getReserves({blockTag: requestBlock});
                        console.log(' - reserves0 = ' + reserves[0]);
                        console.log(' - reserves1 = ' + reserves[1]);
                        break;
                    }catch (e) {
                        console.log('error', e);
                        console.log('wait 1 sec.');
                        await new Promise((done)=>setTimeout(done, 1000));
                    }
                }

                let pair = await this.pairRepository.findOne({
                    where: {
                        network,
                        address: pairAddress
                    }
                });
                if (!pair) {
                    try {
                        pair = await this.pairRepository.save(new PairEntity({
                            network,
                            address: pairAddress,
                            factory: factoryAddress,
                            token0,
                            token1,
                            fee: network == 'local' ? '3' : null,
                            fee_scale: network == 'local' ? '1000' : null
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
                if(!pair.fee) {
                    pair = await this.scanContract(pair, wallet);
                }
                if(pair.fee){
                    const pairData = {
                        ...pair.toJSON(), blockNumber: requestBlock,
                        reserve0: reserves[0].toString(),
                        reserve1: reserves[1].toString()
                    };

                    this.redisPublisherClient.set('pair_' + factoryAddress + '_' + token0 + '_' + token1, JSON.stringify(pairData));
                    this.redisPublisherClient.set('pair_' + pairAddress, JSON.stringify(pairData));
                    console.log('save pair', pairAddress);
                }
                this.redisPublisherClient.set('lastFactoryIndex_' + factoryAddress, i.toString());
            }
        }
    }

    async scanContract(pair: PairEntity, wallet: Wallet): Promise<PairEntity>{
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
        return pair;
    }
}
