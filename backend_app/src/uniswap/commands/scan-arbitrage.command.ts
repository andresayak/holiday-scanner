import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, BigNumber, utils, providers, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import * as pairAbi from '../../contracts/UniswapV2Pair.json';
import {urls} from '../helpers/provider';
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';

const BNB_CONTRACT = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const tokens = [
    BNB_CONTRACT.toLowerCase(),
    '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    '0x55d398326f99059ff775485246999027b3197955',
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
];

@Injectable()
export class ScanArbitrageCommand {
    iface: Interface;

    constructor(private readonly envService: EnvService,
                @Inject('TOKEN_REPOSITORY')
                private readonly tokenRepository: Repository<TokenEntity>,
                @Inject('REDIS_PUBLISHER_CLIENT')
                private readonly redisPublisherClient: RedisClient,
                @Inject('PAIR_REPOSITORY')
                private readonly pairRepository: Repository<PairEntity>) {

        const swapInterface = [
            'event Sync(uint112 reserve0, uint112 reserve1)'
        ];

        this.iface = new utils.Interface(swapInterface);
    }

    @Command({
        command: 'scan:arbitrage',
        autoExit: false
    })
    async create() {

        let lastBlock = 0;
        let maxVariants = 0;
        let gasPrice;
        const gasLimit = BigNumber.from('215000');
        const processBlock = (pair, block, reserve0, reserve1) => {
            if (!pair.blockNumber
                || (block.blockNumber > pair.blockNumber)
                || (block.blockNumber == pair.blockNumber
                    && pair.transactionIndex > pair.transactionIndex
                )
                || (block.blockNumber == pair.blockNumber
                    && block.transactionIndex == pair.transactionIndex
                    && block.logIndex > pair.logIndex
                )
            ) {
                pair.blockNumber = block.blockNumber;
                pair.transactionIndex = block.transactionIndex;
                pair.logIndex = block.logIndex;
                pair.reserve0 = reserve0;
                pair.reserve1 = reserve1;
            }
        }

        const processLogs = (blockNumber, logs) => {
            console.log('processLogs', logs.length);
            lastBlock = blockNumber;
            const timeStart = new Date();
            for (const event of logs) {
                try {
                    const result = this.iface.decodeEventLog('Sync', event.data, event.topics);
                    const pair = pairs.find(pair => pair.address === event.address.toLowerCase());
                    if (pair) {
                        processBlock(pair, event, result[0], result[1]);
                    }
                } catch (e) {

                }
            }
            console.log('logs', logs.length, (new Date().getTime() - timeStart.getTime()) / 1000);
            //processVariants();

            const activePairs = pairs.filter(pair => pair.blockNumber);
            const data = JSON.stringify(activePairs.map((pair) =>
                ({...pair, reserve0: pair.reserve0.toString(), reserve1: pair.reserve1.toString()})));
            this.redisPublisherClient.publish('pairs', data, (err, reply) => {
                console.log('OK', err, reply);
            });
        }
        const countVariants = () => {
            const variants = [];
            const activePairs = pairs;
            console.log('activePairs', activePairs.length);
            let timeStart = new Date();
            for (const tokenIn of tokens) {
                for (const x in activePairs) {
                    const pairX = activePairs[x];
                    if (pairX.token0 !== tokenIn && pairX.token1 !== tokenIn) {
                        continue;
                    }
                    const tokenOut = pairX.token0 == tokenIn ? pairX.token1 : pairX.token0;
                    for (const y in activePairs) {
                        if (x === y) {
                            continue;
                        }
                        const pairY = activePairs[y];
                        if (
                            (pairY.token0 === tokenOut && pairY.token1 === tokenIn)
                            || (pairY.token1 === tokenOut && pairY.token0 === tokenIn)
                        ) {
                            variants.push({
                                path: [tokenIn, tokenOut, tokenIn],
                                pairs: [pairX.address, pairY.address]
                            });
                        }
                    }
                }
            }
            console.log('countVariants', variants.length, (new Date().getTime() - timeStart.getTime()) / 1000);
            return variants;
        }

        const pairs = await this.pairRepository.find();

        const mainProvider = new providers.JsonRpcProvider('https://rpc.ankr.com/bsc/' + this.envService.get('ANKR_PROVIDER_KEY'));
        gasPrice = await mainProvider.getGasPrice();
        urls.map((url, index) => {
            const provider = new providers.JsonRpcProvider(url);
            provider.on("block", async (blockNumber) => {
                console.log(' --------- new block [' + index + '] [ ' + blockNumber + '] ');
                try {
                    const logs = await provider.getLogs({
                        fromBlock: blockNumber,
                        toBlock: blockNumber
                    });
                    if (blockNumber > lastBlock) {
                        processLogs(blockNumber, logs);
                    }
                } catch (e) {
                    console.log('['+index+'] getLogs error', e.toString());
                }
            });
        });

        try {
            mainProvider.on("block", async (blockNumber) => {
                console.log(' --------- new block  [ ' + blockNumber + '] ');
                try {
                    const logs = await mainProvider.getLogs({
                        fromBlock: blockNumber,
                        toBlock: blockNumber
                    });
                    if (blockNumber > lastBlock) {
                        processLogs(blockNumber, logs);
                    }
                } catch (e) {
                    console.log('getLogs error', e.toString());
                }
                new Promise(async (done) => {
                    gasPrice = await mainProvider.getGasPrice();
                    done(true);
                });
                const used = process.memoryUsage().heapUsed / 1024 / 1024;
                console.log(`The script uses approximately ${Math.round(used * 100) / 100} MB`);
            });
        } catch (e) {

        }

        let wallet = Wallet.fromMnemonic(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(mainProvider);

        try {
            let currentBlock = await mainProvider.getBlockNumber();
            for (const pair of pairs) {
                try {
                    currentBlock = Math.max(lastBlock, currentBlock);
                    const pairContract = ContractFactory.getContract(pair.address, pairAbi.abi, wallet);
                    const result = await pairContract.getReserves({blockTag: currentBlock});
                    processBlock(pair, {
                        blockNumber: currentBlock,
                        transactionIndex: 0,
                        logIndex: 0,
                    }, result[0], result[1]);
                } catch (e) {
                    console.log('getReserves error', e.toString());
                }
            }
        } catch (e) {
            console.log('e', e)
        }

        console.log('listening...');
    }
}
