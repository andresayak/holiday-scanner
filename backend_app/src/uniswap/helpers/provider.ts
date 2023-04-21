const urls = [
    'https://rpc-bsc.48.club',
    'https://koge-rpc-bsc.48.club',
    'https://rpc.ankr.com/bsc',
    'https://bsc.blockpi.network/v1/rpc/public',
    'https://bsc.publicnode.com',
    'https://bscrpc.com',
    'https://bsc-mainnet.public.blastapi.io',
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-dataseed1.ninicoin.io/',
    'https://bsc-dataseed2.defibit.io/',
    'https://bsc-dataseed3.defibit.io/',
    'https://bsc-dataseed4.defibit.io/',
    'https://bsc-dataseed2.ninicoin.io/',
    'https://bsc-dataseed3.ninicoin.io/',
    'https://bsc-dataseed4.ninicoin.io/',
    'https://bsc-dataseed1.binance.org/',
    'https://bsc-dataseed2.binance.org/',
    'https://bsc-dataseed3.binance.org/',
    'https://bsc-dataseed4.binance.org/',
];

const getBSCProviderUrl = () => {
    return urls[Math.floor(Math.random() * urls.length)];
}

export {urls, getBSCProviderUrl};
