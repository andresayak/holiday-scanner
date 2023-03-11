import {Command} from 'nestjs-command';
import {Inject, Injectable} from '@nestjs/common';
import {ContractFactory, utils, providers, Wallet} from 'ethers';
import {Repository} from "typeorm";
import {PairEntity} from "../entities/pair.entity";
import {TokenEntity} from "../entities/token.entity";
import * as pairAbi from '../../contracts/UniswapV2Pair.json';
import {EnvService} from "../../env/env.service";
import {Interface} from "@ethersproject/abi/src.ts/interface";
import {RedisClient} from 'redis';

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

        const processLogs = (blockNumber, logs, timeStart) => {
            console.log('logs', logs.length);
            lastBlock = blockNumber;

            let count = 0;
            for (const event of logs) {
                try {
                    const result = this.iface.decodeEventLog('Sync', event.data, event.topics);
                    const pair = pairs.find(pair => pair.address === event.address.toLowerCase());
                    if (pair) {
                        processBlock(pair, event, result[0], result[1]);
                        count++;
                    }
                } catch (e) {

                }
            }
            console.log('update pairs', count);
            if(count){
                const activePairs = pairs.filter(pair => pair.blockNumber).map((pair) =>
                    ({...pair, reserve0: pair.reserve0.toString(), reserve1: pair.reserve1.toString()}));
                const data = JSON.stringify({
                    pairs: activePairs,
                    blockNumber,
                    timeStart
                });
                this.redisPublisherClient.publish('pairs', data, ()=>{
                    console.log('OK', (new Date().getTime() - timeStart.getTime()) / 1000);
                });
            }
        }

        const pairs = await this.pairRepository.find();

        const wsProvider = new providers.WebSocketProvider('wss://rpc.ankr.com/bsc/ws/' + this.envService.get('ANKR_PROVIDER_KEY'));
        const jsonProvider = new providers.JsonRpcProvider('https://rpc.ankr.com/bsc/' + this.envService.get('ANKR_PROVIDER_KEY'));
        /*urls.map((url, index) => {
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
        });*/

        try {
            wsProvider.on("block",  (blockNumber) => {
                const timeStart = new Date();
                console.log(' --------- new block  [ ' + blockNumber + '] ');
                try {
                    jsonProvider.getLogs({
                        fromBlock: blockNumber,
                        toBlock: blockNumber
                    }).then(logs=>{
                        if (blockNumber > lastBlock) {
                            processLogs(blockNumber, logs, timeStart);
                        }
                    })
                } catch (e) {
                    console.log('getLogs error', e.toString());
                }
            });
        } catch (e) {

        }

        let wallet = Wallet.fromMnemonic(this.envService.get('ETH_PRIVAT_KEY_OR_MNEMONIC')).connect(jsonProvider);

        try {
            let currentBlock = await jsonProvider.getBlockNumber();
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
