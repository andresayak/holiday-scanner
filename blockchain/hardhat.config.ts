import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-web3";
import {task} from "hardhat/config";

const {config: dotEnvConfig} = require("dotenv");

dotEnvConfig({path: __dirname + '/.env'});
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

task("accountsWithBalances", "Prints the list of accounts with balances", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    for (const account of accounts) {
        let balance = (await account.getBalance()).toString();
        console.log(account.address, balance);
    }
});
module.exports = {
    solidity: {
        compilers: [{
            version: "0.8.0", settings: {
                optimizer: {
                    enabled: true,
                    runs: 300,
                },
            }
        }, {
            version: "0.7.6", settings: {
                optimizer: {
                    enabled: true,
                    runs: 300,
                },
            }
        }, {
            version: "0.6.6", settings: {
                optimizer: {
                    enabled: true,
                    runs: 300,
                },
            }
        }, {version: "0.5.16"}]
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true,
            forking: {
                url: `https://rpc.ankr.com/bsc/${process.env.ANKR_PROVIDER_KEY}`,
                blockNumber: 26810745
            },
            mining: {
              auto: true,
            //  interval: 5000
            },
            gas: 'auto'
        },
        bsc_mainnet: {
            chainId: 56,
            url: `https://rpc.ankr.com/bsc/${process.env.ANKR_PROVIDER_KEY}`,
            accounts: {
                mnemonic: process.env.MNEMONIC,
            },
            gas: 5000000,
            gasPrice: 5000000000,
        }
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API
    },
    gasReporter: {
        currency: 'USD',
        token: 'BNB',
        gasPriceApi: 'https://api.bscscan.com/api?module=proxy&action=eth_gasPrice',
        gasPrice: 5
    }
};
