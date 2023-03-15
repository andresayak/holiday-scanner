const {ethers} = require("hardhat");
const {balanceHuman} = require("./helpers/calc");
const PAN_ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

const dataSource = require("./helpers/DataSource");

async function scanBlocks() {

    const provider = ethers.provider;

    const [account] = await ethers.getSigners();
    const balance = await account.getBalance();
    console.log(' - account address: ' + account.address);
    console.log(' - account balance: ' + balanceHuman(balance));

    const repository = dataSource.getRepository("Transaction");

    let currentBlock = await provider.getBlock();
    let startBlock = 26144139;
    let blockIndex = 0;
    let swapIndex = 0;
    for (let blockNumber = startBlock; blockNumber <= currentBlock.number; blockNumber++) {
        let block = await provider.getBlockWithTransactions(blockNumber);
        console.log('block.transactions', block.transactions);
        console.log('block', block.number.toString(), ++blockIndex);
        const chunkSize = 20;
        let index = 0;
        for (let i = 0; i < block.transactions.length; i += chunkSize) {
            const chunk = block.transactions.slice(i, i + chunkSize);
            await Promise.all(chunk.map((tx) => {
                return new Promise(async (done) => {
                    try {
                        ++index;
                        if (tx && tx.to == PAN_ROUTER_ADDRESS) {
                            console.log('txHash', blockIndex + '/' + index + '/' + block.transactions.length, tx.hash, ++swapIndex);
                            const transaction = {};
                            transaction.hash = tx.hash;
                            transaction.blockNumber = tx.blockNumber;
                            transaction.transactionIndex = tx.transactionIndex;
                            transaction.confirmations = tx.confirmations;
                            transaction.from = tx.from;
                            transaction.gasPrice = tx.gasPrice.toString();
                            transaction.gasLimit = tx.gasLimit.toString();
                            transaction.to = tx.to;
                            transaction.value = tx.value.toString();
                            transaction.data = tx.data.toString();
                            transaction.nonce = tx.nonce;
                            transaction.chainId = tx.chainId;
                            try {
                                await repository.save(transaction);
                            } catch (e) {
                                console.warn('e', e.toString());
                            }
                        } else {
                            console.log('txHash', blockIndex + '/' + index + '/' + block.transactions.length, tx.hash);
                        }
                        done();
                    } catch (e) {
                        console.warn('e', e.toString());
                        done();
                    }
                });
            }));
        }
    }
}

dataSource
    .initialize()
    .then(scanBlocks);

