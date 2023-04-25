import {BigNumber, Contract, ethers, utils, Wallet} from "ethers";
import {balanceHuman, BNB_CONTRACT, tokens} from "../../helpers/calc";
import {TransactionResponse} from "@ethersproject/abstract-provider";
import {processFindSuccess, Swap} from "./processFindSuccess";
import {Repository} from "typeorm";
import {VariantType} from "./getVariants";
import {PairEntity} from "../../entities/pair.entity";
import {updateReserves} from "./updateReserves";
import * as fs from 'fs';
import {RedisClient} from "redis";
import {JsonRpcProvider} from "@ethersproject/providers";
import {TgBot} from "../../TgBot";
import {TransactionEntity} from "../../entities/transaction.entity";
import axios from "axios";
import * as process from "process";

Object.defineProperties(BigNumber.prototype, {
    toJSON: {
        value: function (this: BigNumber) {
            return this.toString();
        },
    },
});

const copyPair = (data: any) => {
    if (data) {
        let json = JSON.parse(JSON.stringify(data));
        json.reserve0 = data.reserve0;
        json.reserve1 = data.reserve1;
        return json;
    }
    return null;
}
const blacklist = [
    '0xacfc95585d80ab62f67a14c566c1b7a49fe91167',
    '0xfb5b838b6cfeedc2873ab27866079ac55363d37e',
    '0x9d986a3f147212327dd658f712d5264a73a1fdb0',
    '0x477bc8d23c634c154061869478bce96be6045d12',
    '0xa57ac35ce91ee92caefaa8dc04140c8e232c2e50'
];
const baselist = [
    BNB_CONTRACT.toLowerCase(),
    '0xe9e7cea3dedca5984780bafc599bd69add087d56'
]
const swapInterface = [
    'event Sync(uint112 reserve0, uint112 reserve1)',
];
const iface = new utils.Interface(swapInterface);

const checkisWhitelist = (tokenAddress: string, redisPublisherClient: RedisClient) => {
    return new Promise((done) => {
        redisPublisherClient.get('token_' + tokenAddress.toLowerCase(), (err, reply) => {
            done(reply);
        });
    });
}

const checkVariants = async (tokensAddress: string[], redisPublisherClient: RedisClient): Promise<VariantType[]> => {
    const items: VariantType[] = [];
    await Promise.all(tokensAddress.map(tokenAddress => {
        return new Promise((done) => {
            redisPublisherClient.get('variants_' + tokenAddress, (err, reply) => {
                if (reply) {
                    const data = JSON.parse(reply);
                    if (data) {
                        for (const variant of data.variants) {
                            items.push(variant);
                        }
                    }
                }
                done(true);
            });
        });
    }));
    return items;
}
export const calculate = async (swap: {
                                    factory: string;
                                    target: TransactionResponse,
                                    json: {
                                        result: Swap,
                                        method: string;
                                    }
                                }, pairRepository: Repository<PairEntity>, network: string, startBlock: number, currentBlock: number,
                                multiSwapContract: Contract, wallet: Wallet, timeStart: Date, redisPublisherClient: RedisClient, isTestMode: boolean,
                                providers: JsonRpcProvider[],
                                nonce: number, upNonce: () => void, chainId: number, amount0: string, amount1: string, tgBot: TgBot,
                                transactionRepository: Repository<TransactionEntity>, allVariants: any, allPairs: any
) => {
    const timeProcessing = (new Date().getTime() - timeStart.getTime()) / 1000;
    const {target} = swap;
    console.log(target.hash, 'timeProcessing', timeProcessing);
    const token0 = swap.json.result.path[0].toLowerCase();
    const token1 = swap.json.result.path[1].toLowerCase();
    const token2 = swap.json.result.path[2]?.toLowerCase();

    const tokenInner = [];

    if (!tokens.includes(token0)) {
        tokenInner.push(token0);
    }
    if (token1 && !tokens.includes(token1)) {
        tokenInner.push(token1);
    }
    if (token2 && !tokens.includes(token2)) {
        tokenInner.push(token2);
    }

    if (!tokenInner.length) {
        return;
    }
    const timeCheckVariantsStart = new Date().getTime();
    //const variants = await checkVariants(tokenInner, redisPublisherClient);
    let variants = [];
    tokenInner.map(tokenAddress => {
        if (allVariants[tokenAddress]) {
            variants.push(...allVariants[tokenAddress]);
        }
    });
    const timeCheckVariants = (new Date().getTime() - timeCheckVariantsStart) / 1000;
    console.log(target.hash, 'timeCheckVariants', timeCheckVariants);
    if (!variants.length) {
        console.log(target.hash, 'not variants', tokenInner);
        return;
    }
    const pairs: { [k: string]: PairEntity } = {};
    let needPairs = []
    for (const variant of variants) {
        needPairs = [...needPairs, ...variant.pairs];
    }
    needPairs = needPairs.filter((value, index, array) => array.indexOf(value) === index);
    const timeFetchPairsStart = new Date().getTime();
    needPairs.map(pairAddress => {
        if (allPairs[pairAddress]) {
            pairs[pairAddress] = allPairs[pairAddress];
        }
    });
    /*await Promise.all(needPairs.map(pairAddress => {
        return new Promise((done) => {
            redisPublisherClient.get('pair_' + pairAddress, (err, reply) => {
                if (reply) {
                    try {
                        const data = JSON.parse(reply);
                        if (data) {
                            pairs[data.address] = data;
                            pairs[data.address].reserve0 = BigNumber.from(data.reserve0);
                            pairs[data.address].reserve1 = BigNumber.from(data.reserve1);
                            return done(true);
                        }
                    } catch (e) {
                    }
                }
                done(true);
            });
        });
    }));*/
    const timeFetchPairs = (new Date().getTime() - timeFetchPairsStart) / 1000;
    console.log(target.hash, 'timeFetchPairs', timeFetchPairs);
    const timeFetch = (new Date().getTime() - timeStart.getTime()) / 1000;
    console.log(target.hash, 'TIME FETCH', timeFetch)
    if (!Object.keys(pairs).length) {
        console.log(target.hash, 'not pairs');
        return;
    }

    if (Object.keys(pairs).length > 1 && swap.json.result.path.length == 2 || swap.json.result.path.length == 3) {
        let pair1 = (Object.values(pairs).find((pair) => pair.factory == swap.factory && (
            (pair.token0 == token0 && pair.token1 == token1) || (pair.token1 == token0 && pair.token0 == token1)
        )));
        if (!pair1) {
            console.log(target.hash, 'target pair1 not found', swap.factory, token0, token1);
            return;
        }
        if (!pair1.fee) {
            console.log(target.hash, 'target pair1 not have fee', pair1);
            return;
        }

        const before: any = {};
        const after: any = {}

        const amountIn = target.value.gt(0) ? target.value : (swap.json.result.amountIn ?? BigNumber.from(0));
        const amountOut = swap.json.result.amountOut ?? BigNumber.from(0);
        const amountOutMin = swap.json.result.amountOutMin ?? BigNumber.from(0);
        const amountInMax = swap.json.result.amountInMax ?? BigNumber.from(0);
        let pair2;
        if (token2) {
            let pair2 = (Object.values(pairs).find((pair) => pair.factory == swap.factory && (
                (pair.token0 == token1 && pair.token1 == token2) || (pair.token0 == token2 && pair.token1 == token1)
            )));
            if (!pair2) {
                console.log(target.hash, 'target pair2 not found', swap.factory, token1, token2);
                return;
            }
            if (!pair2.fee) {
                console.log(target.hash, 'target pair2 not have fee', pair2);
                return;
            }
            if (amountOut.gt(0)) {
                const {amountRealIn: amountRealIn1, amountRealOut: amountRealOut1, pair}
                    = updateReserves(pair2, token1, BigNumber.from(0), amountOut, BigNumber.from(0), BigNumber.from(0));

                console.log('pair2=' + pair2.reserve0);
                console.log('pair2=' + pair2.reserve1);
                after.amountRealIn1 = amountRealIn1.toString();
                after.amountRealOut1 = amountRealOut1.toString();

                const {amountRealIn: amountRealIn0, amountRealOut: amountRealOut0}
                    = updateReserves(pair1, token0, BigNumber.from(0), amountRealIn1, amountInMax, BigNumber.from(0));

                after.amountRealIn0 = amountRealIn0.toString();
                after.amountRealOut0 = amountRealOut0.toString();
                after.reserves0 = [pair1.reserve0, pair1.reserve1];
                pair2 = pair;

            } else {
                const {amountRealIn: amountRealIn0, amountRealOut: amountRealOut0, pair}
                    = updateReserves(pair1, token0, amountIn, BigNumber.from(0), BigNumber.from(0), BigNumber.from(0));
                after.amountRealIn0 = amountRealIn0.toString();
                after.amountRealOut0 = amountRealOut0.toString();
                after.reserves0 = [pair1.reserve0, pair1.reserve1];

                console.log('pair2=' + pair2.reserve0);
                console.log('pair2=' + pair2.reserve1);
                const {amountRealIn: amountRealIn1, amountRealOut: amountRealOut1}
                    = updateReserves(pair2, token1, amountRealOut0, amountOut, BigNumber.from(0), amountOutMin);

                pair2 = pair;
                console.log('pair2=' + pair2.reserve0);
                console.log('pair2=' + pair2.reserve1);
                after.amountRealIn1 = amountRealIn1.toString();
                after.amountRealOut1 = amountRealOut1.toString();
            }

            after.reserves1 = [pair2.reserve0, pair2.reserve1];

        } else {
            const {amountRealIn: amountRealIn0, amountRealOut: amountRealOut0, pair}
                = updateReserves(pair1, token0, amountIn, amountOut, amountInMax, amountOutMin);
            after.amountRealIn0 = amountRealIn0.toString();
            after.amountRealOut0 = amountRealOut0.toString();
            after.reserves0 = [pair1.reserve0, pair1.reserve1];
        }
        const timeDiff02 = (new Date().getTime() - timeStart.getTime()) / 1000;
        console.log(target.hash, 'TIME UPDATE RESERVERS = ', timeDiff02);
        const items = processFindSuccess(target.hash, {variants, pairs, amount0, amount1});
        const timeDiff0 = (new Date().getTime() - timeStart.getTime()) / 1000;
        console.log(target.hash, 'TIME AFTER SUCCESS = ', timeDiff0);
        if (items.length) {
            const success = items[0];
            let hash = '';
            let timing;
            let bundle_id;
            if (isTestMode) {
                console.log(target.hash, 'TEST MODE ENABLED');
            } else {
                let nonce = await wallet.provider.getTransactionCount(wallet.address);
                const sendResult = await calculateswapRaw(success, multiSwapContract, swap.target.gasPrice, nonce, providers, chainId);
                if (sendResult) {
                    upNonce();
                    //upNonce();
                    hash = sendResult.hash;
                    timing = sendResult.timing;
                    //bundle_id = sendResult.data.result;
                    //await tgBot.sendMessage(JSON.stringify(sendResult.data));

                }
            }
            const timeDiff2 = (new Date().getTime() - timeStart.getTime()) / 1000;

            let blockInfoMy, blockInfoTarget = '';
            if (hash) {
                try {
                    const txMy = await multiSwapContract.provider.getTransaction(hash);
                    if (txMy) {
                        const receiptMy = await txMy.wait();
                        if (receiptMy) {
                            blockInfoMy = " [" + receiptMy.blockNumber + ': ' + receiptMy.transactionIndex + "]";
                        } else {
                            blockInfoMy = " [receipt empty]";
                        }
                    } else {
                        blockInfoMy = ' [tx empty]';
                    }
                } catch (e) {
                    console.log(target.hash, 'error ', e);
                    blockInfoMy = ' [error: ]';
                }

                try {
                    const txTarget = await multiSwapContract.provider.getTransaction(swap.target.hash);
                    if (txTarget) {
                        const receiptTarget = await txTarget.wait();
                        if (receiptTarget) {
                            blockInfoTarget = " [" + receiptTarget.blockNumber + ': ' + receiptTarget.transactionIndex + "]";
                        } else {
                            blockInfoTarget = " [receipt empty]";
                        }
                    } else {
                        blockInfoTarget = ' [tx empty]';
                    }
                } catch (e) {
                    console.log(target.hash, 'error ', e);
                    blockInfoTarget = ' [error]';
                }
            }
            const message = items.map((item, index) => {
                return (index + 1) + ') ' + (hash && index === 0 ? 'hash: ' + hash + blockInfoMy + "\n" : '') + "\n"
                    + 'target: ' + swap.target.hash + blockInfoTarget + "\n"
                    + 'amount: ' + balanceHuman(item.amountIn, item.path[0]) + "\n"
                    + 'tokens: ' + item.path[0] + ' / ' + item.path[1] + "\n"
                    + 'profit: ' + item.profit + '%, ' + item.amountInUsd + " USD\n"
                    + 'timing: ' + timeProcessing + ' / ' + timeFetch + ' / ' + timeDiff0 + ' / ' + timeDiff2 + ' sec.' + "\n"
            }).join("\n");
            await tgBot.sendMessage(message);

            if (pair1)
                before.pair0 = JSON.parse(JSON.stringify(pair1));
            if (pair2)
                before.pair1 = JSON.parse(JSON.stringify(pair2));

            console.log(target.hash, 'times:', {
                timeProcessing,
                timeFetch,
                timeDiff0, timeDiff2, timing
            });
            const data = {
                times: {
                    timeProcessing,
                    timeFetch,
                    timeDiff0, timeDiff2, timing
                },
                block: currentBlock,
                hash,
                target: {
                    hash: swap.target.hash,
                    from: swap.target.from,
                    to: swap.target.to,
                    gasPrice: swap.target.gasPrice.toString(),
                    gasLimit: swap.target.gasLimit.toString(),
                    method: swap.json.method,
                    params: {
                        amountIn: amountIn.toString(),
                        amountOut: amountOut.toString(),
                        amountOutMin: amountOutMin.toString(),
                        amountInMax: amountInMax.toString(),
                        path: swap.json.result.path,
                        //deadline: swap.json.result.deadline.toString()
                    }
                }, before, after, success
            };
            console.log(target.hash, 'data', JSON.stringify(data));
            const filename = currentBlock + "-" + (new Date().getTime());
            fs.writeFileSync("/var/www/backend_app/storage/swaps/" + filename, JSON.stringify(data, null, "\t"));
            console.log(target.hash, 'success', success);

            try {
                await transactionRepository.create(new TransactionEntity({
                    hash: target.hash,
                    network,
                    blockNumber: currentBlock,
                    from: target.from,
                    to: target.to,
                    gasPrice: target.gasPrice.toString(),
                    gasLimit: target.gasLimit.toString(),
                    value: target.value.toString(),
                    data: target.data.toString(),
                    nonce: target.nonce,
                    chainId: target.chainId,
                    profit: success.profit,
                    profitReal: success.amountInUsd,
                    method: swap.json.method,
                    logs: filename,
                }));
            } catch (e) {
                console.log(target.hash, e);
            }
            /*if (bundle_id) {
                setTimeout(async () => {
                    const response = await axios.get('https://explorer.48.club/api/v1/puissant/' + bundle_id);
                    console.log('response', response.data);
                    await tgBot.sendMessage(JSON.stringify(response.data));

                    if(response.data.value && response.data.value.block) {
                        upNonce();
                        upNonce();
                    }
                }, 10 * 1000)
            }*/

            //process.exit(1);
            /*console.log('wait...');
            const receipt = await target.wait();

            console.log('token0=' + token0);
            console.log('token1=' + token1);
            console.log('pair1.token0=' + pair1.token0);
            console.log('pair1.token1=' + pair1.token1);


            let status = true;
            for (const pair of [pair1, pair2]) {
                for (const log of receipt.logs.filter(log => log.address.toLowerCase() == pair.address)) {
                    try {
                        const reserve_estimate = [BigNumber.from(pair.reserve0), BigNumber.from(pair.reserve1)];

                        const result = iface.decodeEventLog('Sync', log.data, log.topics);
                        console.log('log: ', log);
                        console.log('reserves_real0=' + result[0], balanceHuman(result[0]));
                        console.log('reserves_real1=' + result[1], balanceHuman(result[1]));

                        console.log('reserve_estimate0=' + reserve_estimate[0], balanceHuman(reserve_estimate[0]));
                        console.log('reserve_estimate1=' + reserve_estimate[1], balanceHuman(reserve_estimate[1]));
                        if (reserve_estimate[0].eq(result[0]) && reserve_estimate[1].eq(result[1])) {
                            console.log(colors.green('RESERVERS OK'))
                        } else {
                            console.log(colors.red('RESERVERS WRONG'));
                            //status = false;
                        }
                        console.log('');
                    } catch (e) {
                        process.exit(1);
                    }
                }
            }

            if (items.length || !status) {
                process.exit(1);
            }*/
        }
    }
}


export const calculateswap = async (success, multiSwapContract: Contract, gasPrice: BigNumber, nonce: number, providers: JsonRpcProvider[]) => {
    try {
        let params = {
            nonce,
            gasLimit: BigNumber.from('2500000'),
            gasPrice: gasPrice,
        };
        let fee1 = success.fees[0];
        let fee2 = success.fees[1];
        /*
                if(fee1 >= 10){
                    fee1++;
                }
                if(fee2 >= 10){
                    fee2++;
                }*/
        const tx = await multiSwapContract.swap(
            success.amountIn,
            success.pairs,
            success.path,
            [fee1, fee2],
            success.feeScales,
            params
        );
        return tx.hash;
        //swap.hash = tx.hash;
        //swap.gasPrice = success[0].gasPrice.toString();
        //swap.timeAfterBlock = (new Date().getTime() - this.lastBlockTime) / 1000 + ' sec'
        //fs.writeFileSync("/var/www/backend_app/storage/swaps/" + (new Date().getTime()), JSON.stringify(swap, null, "\t"));
        //const receipt = await tx.wait();
        //console.log('receipt', receipt);
    } catch (e) {
        console.log('swap ERROR', e.toString());
    }
}

const calculateswapRaw = async (success, multiSwapContract: Contract,
                                gasPrice: BigNumber, nonce: number,
                                providers: JsonRpcProvider[], chainId: number) => {

    const timeStart = new Date().getTime();
    const timing: any = {};
    let params = {
        nonce,
        gasLimit: BigNumber.from('2500000'),
        gasPrice: gasPrice,
    };

    let fee1 = success.fees[0];
    let fee2 = success.fees[1];

    const txNotSigned = await multiSwapContract.populateTransaction.swap(
        success.amountIn,
        success.pairs,
        success.path,
        [fee1, fee2],
        success.feeScales,
        params
    );
    txNotSigned.chainId = chainId;
    const signedTx = await multiSwapContract.signer.signTransaction(txNotSigned);
    timing.sign = (new Date().getTime() - timeStart) / 1000;

    const time = new Date().getTime();
    const json = await Promise.all(providers.map(provider => {
        console.log('send', provider.connection.url);
        return new Promise(done => {
            axios.post(provider.connection.url, {
                method: 'eth_sendRawTransaction',
                params: [signedTx],
                id: 46,
                jsonrpc: '2.0'
            }).then(({data}) => {
                console.log('data', new Date().getTime() - time, provider.connection.url, data);
                if (!timing.send)
                    timing.send = (new Date().getTime() - timeStart) / 1000;
                done(data);
            }).catch(error => {
                console.log('error', error);
                done('error');
            })
        });
    }));
    const item: any = json.find((item: any) => item.result);
    //const tx = await Promise.any(providers.map(provider => provider.sendTransaction(signedTx)))
    //const tx = await multiSwapContract.provider.sendTransaction(signedTx);
    if (item) {
        console.log('tx send', item.result);
        return {hash: item.result, timing};
    }
}


export const calculateswapPuissant = async (success, multiSwapContract: Contract,
                                            gasPrice: BigNumber, nonce: number, target: TransactionResponse,
                                            providers: JsonRpcProvider[], chainId: number) => {

    const signer = multiSwapContract.signer;
    const timeStart = new Date().getTime();
    const timing: any = {};
    const emptyTx = {
        nonce,
        gasLimit: BigNumber.from('30000'),
        gasPrice: BigNumber.from('60000000000'),
        to: '0x1c9e1efb444f7b6c4c6080c5439d902fcd670aed',
        value: BigNumber.from('0'),
        chainId
    };
    const signedEmptyTx = await signer.signTransaction(emptyTx);
    let params = {
        nonce: nonce + 1,
        gasLimit: BigNumber.from('2500000'),
        gasPrice: gasPrice,
    };

    let fee1 = success.fees[0];
    let fee2 = success.fees[1];

    const tx = await multiSwapContract.populateTransaction.swap(
        success.amountIn,
        success.pairs,
        success.path,
        [fee1, fee2],
        success.feeScales,
        params
    );
    tx.chainId = chainId;
    const signedTx = await signer.signTransaction(tx);

    const targetTx = {
        nonce: target.nonce,
        gasPrice: target.gasPrice,
        gasLimit: target.gasLimit,
        to: target.to,
        value: target.value,
        data: target.data,
        chainId
    };
    const targetSignedTx = ethers.utils.serializeTransaction(targetTx, {
        v: target.v,
        r: target.r,
        s: target.s,
    });

    /*const txHash = ethers.utils.keccak256(ethers.utils.RLP.encode([
        tx.nonce,
        tx.gasPrice,
        tx.gasLimit,
        tx.to,
        tx.value,
        tx.data,
        tx.chainId,
        0,
        0
    ]));*/

    console.log('txs', [
        signedEmptyTx,
        targetSignedTx,
        signedTx
    ]);
    const {data} = await axios.post('https://puissant-bsc.48.club', {
        id: new Date().getTime(),
        jsonrpc: '2.0',
        method: 'eth_sendPuissant',
        params: [
            {
                txs: [
                    signedEmptyTx,
                    targetSignedTx,
                    signedTx
                ],
                maxTimestamp: Math.ceil((new Date().getTime()) / 1000) + 3,
                acceptRevert: []
            }

        ]
    });
    console.log('data', data);
    timing.send = (new Date().getTime() - timeStart) / 1000;
    //console.log('tx send', txHash);
    return {
        hash: '',//txHash,
        timing,
        data
    }
}
