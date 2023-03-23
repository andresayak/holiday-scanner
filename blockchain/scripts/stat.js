const {MoreThan} = require("typeorm");
const dataSource = require("./helpers/DataSource");

async function stat() {
    const repository = dataSource.getRepository("Transaction");
    const tokenRepository = dataSource.getRepository("Token");
    const total = await repository.count();
    const status = 1;
    const minProfit = 10;
    const minAmount = 5;
    const whitelist = (await tokenRepository.find()).map(item => item.address);
    console.log('whitelist', whitelist);
    const totalSuccess = await repository.count({
        where: {
            status,
            //token0: In(whitelist)
        }
    });
    const totalSwapExactETHForTokens = await repository.count({
        where: {
            method: 'swapExactETHForTokens',
            status,
            //token1: In(whitelist)
        }
    });
    const totalWithProfit = await repository.count({
        where: {
            method: 'swapExactETHForTokens',
            profit: MoreThan(minProfit),
            max_amount_usd: MoreThan(minAmount),
            status,
            //token1: In(whitelist)
        }
    });
    const maxProfit = await repository.maximum('profit', {
        method: 'swapExactETHForTokens',
        profit: MoreThan(minProfit),
        max_amount_usd: MoreThan(minAmount),
        status,
        //token1: In(whitelist)
    });

    const maxBlock = await repository.maximum('blockNumber');

    const minBlock = await repository.minimum('blockNumber');

    console.log('total ' + total);
    console.log('totalSuccess ' + totalSuccess);
    console.log('blocks ' + (maxBlock - minBlock), minBlock + '-' + maxBlock);
    console.log('total swapExactETHForTokens ' + totalSwapExactETHForTokens);
    console.log('total totalWithProfit ' + totalWithProfit);
    console.log('total maxProfit ' + maxProfit);

    const transactions = await repository.find({
        where: {
            method: 'swapExactETHForTokens',
            profit: MoreThan(minProfit),
            max_amount_usd: MoreThan(minAmount),
            status,
            //token1: In(whitelist)
        },
        order: {
            blockNumber: {
                blockNumber: 'ASC',
            },
            transactionIndex: {
                transactionIndex: 'ASC',
            }
        }
    });

    const transactionsAll = await repository.find({
        where: {
            method: 'swapExactETHForTokens',
        },
        order: {
            blockNumber: {
                blockNumber: 'ASC',
            },
            transactionIndex: {
                transactionIndex: 'ASC',
            }
        }
    });

    let tokens = {};
    for (const transaction of transactions) {
        if(transaction.reservesAfter0!=transaction.reservesAfter0estimate || transaction.reservesAfter1!=transaction.reservesAfter1estimate){
            continue;
        }
        const max_amount_usd = parseFloat(transaction.max_amount_usd.replace('$', '').replace(',', ''));
        const profit = parseFloat(transaction.profit);
        if (!tokens[transaction.token1]) {
            tokens[transaction.token1] = {
                address: transaction.token1,
                count: 1,
                totalProfit: profit,
                maxProfit: profit,
                minProfit: profit,
                totalMaxAmount: max_amount_usd
            };
        } else {
            tokens[transaction.token1]['count']++;
            tokens[transaction.token1]['totalProfit'] += profit;
            tokens[transaction.token1]['totalMaxAmount'] += max_amount_usd;
            tokens[transaction.token1]['maxProfit'] = Math.max(tokens[transaction.token1]['maxProfit'], profit);
            tokens[transaction.token1]['minProfit'] = Math.min(tokens[transaction.token1]['minProfit'], profit);
        }
    }

    for (const address in tokens) {
        const token = await tokenRepository.findOneBy({
            address: address.toLowerCase(),
        });

        if (token) {
            tokens[address] = {
                ...tokens[address],
                rank: token.rank,
                name: token.name.trim(),
            }
        }

        const tokenTransactions = transactions.filter(transaction => transaction.token1 == address);

        const tokenTransactionsAll = transactionsAll.filter(transaction => transaction.token1 == address);

        const blocks = {};
        let failInSameBlock = 0;
        let successIsSameBlock = 0;
        tokenTransactions.map(transaction => {
            if (!blocks[transaction.blockNumber]) {
                blocks[transaction.blockNumber] = 1;
            } else {
                blocks[transaction.blockNumber]++;
                successIsSameBlock++;
            }
        });

        tokenTransactionsAll.filter(transaction => !transaction.status).map(transaction => {
            if (blocks[transaction.blockNumber]) {
                blocks[transaction.blockNumber]++;
                failInSameBlock++;
            }
        });

        const avgProfit = Math.ceil((tokens[address].totalProfit / tokens[address].count) * 1000) / 1000;
        const avgMaxAmount = Math.ceil((tokens[address].totalMaxAmount / tokens[address].count) * 1000) / 1000;
        tokens[address] = {
            ...tokens[address],
            totalProfit: null,
            totalMaxAmount: null,
            avgProfit: avgProfit,
            avgMaxAmount: avgMaxAmount,
            successIsSameBlock,
            failInSameBlock,
        }
    }

    const sortable = Object.fromEntries(
        Object.entries(tokens).sort(([, a], [, b]) => a.count - b.count)
    );
    console.table(Object.values(sortable));

}

dataSource
    .initialize()
    .then(stat);

