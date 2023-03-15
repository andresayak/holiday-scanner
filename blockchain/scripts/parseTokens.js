const axios = require("axios");
const dataSource = require("./helpers/DataSource");

const parseTokenPage = async (tokenAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c') => {
    const timeStart = new Date();
    const {data} = await axios.get(`https://bscscan.com/token/` + tokenAddress);
    const result = data.match(/<meta name="Description" content="(.*) Token Tracker on BscScan shows the price of the Token \$([\.\d]+), total supply ([\d\.\,]*), number of holders ([\d\,]*) and updated information of the token. The token tracker page also shows the analytics and historical data/i)
    console.log(' - parse time: ' + (new Date().getTime() - timeStart.getTime()) / 1000);
    const info = {
        title: result[1],
        price: parseFloat(result[2].replace(/\,/ig, '')),
        supply: parseFloat(result[3].replace(/\,/ig, '')),
        holders: parseInt(result[4].replace(/\,/ig, ''))
    };

    if (info.price === 0) {
        console.warn('price IS Zero');
    }
    if (info.holders <= 1000) {
        console.warn('not enough holders');
    }

    return info;
}

const parseListPage = async (page) => {
    const timeStart = new Date();
    const {data} = await axios.get(`https://bscscan.com/tokens?p=` + page);
    const matches = data.matchAll(/<tr><td>(\d+)<\/td><td><div [^>]+><img [^>]+><div [^>]+><h3 [^>]+><a\s+class='text-primary'\s+href='\/token\/([^']+)\'>([^<]+)<\/a><\/h3>/ig)
    console.log(' - parse time: ' + (new Date().getTime() - timeStart.getTime()) / 1000);
    const info = [];
    for (const match of matches) {
        info.push({
            rank: match[1],
            address: match[2].toLowerCase(),
            name: match[3],
        });
    }

    return info;
}

async function parseTokens() {
    const repository = dataSource.getRepository("Token");
    for(let page = 1; page <= 10; page++){
        const result = await parseListPage(page);
        console.log('result', page, result);
        for(const token of result){
            try {
                const info = await parseTokenPage(token.address);
                token.holders = info.holders;
                await repository.save(token);
            } catch (e) {
                console.warn('e', e.toString());
            }
        }
    }
}

dataSource
    .initialize()
    .then(parseTokens);

