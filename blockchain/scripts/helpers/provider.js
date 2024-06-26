const urls = [
    'https://bsc-mainnet.nodereal.io/v1/e07bd56d57074848a3feeac630c11e84',
    'https://rpc.ankr.com/bsc/ae34d626dfb166a8007f6fd218cfb2b89a233601f34801f7b2a3462f950b487b',
    'https://bsc.getblock.io/a88b719b-22e9-4810-a31f-ddf70a5a6f00/mainnet/',
    'https://bsc-mainnet.blockvision.org/v1/2NuhVHLZswwHW8Ift8PKUxO6FZf',
    'https://nd-077-818-081.p2pify.com/2356c4af71b23ecfef86b8b2c95464c0',
    'https://frequent-purple-fire.bsc.discover.quiknode.pro/a7fe1973d82fde264b04d1cc84ebfeaa3d6b9e69/',
    'https://app.zeeve.io/shared-api/bsc/64d8aa02bde32a8af1b9bb51cc434d87277d50d008d1bbe9/',
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

const getProviderUrl = () => {
    const urls = [
        //'https://speedy-nodes-nyc.moralis.io/fd1d27838850000174a07146/bsc/mainnet',
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
    return urls[Math.floor(Math.random() * urls.length)];
}

module.exports = {urls, getProviderUrl};
