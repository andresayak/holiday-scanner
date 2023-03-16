1. run local network
``` 
npx hardhat node
```

2. deploy main contracts
```
npx hardhat run --network localhost scripts/deploy_init.js
```
Success response:

```
COMPUTED_INIT_CODE_HASH 0x275c1d544bdc0c623289df4bc3f5b4306445316c4173ce251ef789cc34c49cd9

FACTORY_ADDRESS=0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0
WETH_ADDRESS0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82
TOKEN0_ADDRESS=0x9A676e781A523b5d0C0e43731313A708CB607508
TOKEN1_ADDRESS=0x0B306BF915C4d645ff596e518fAf3F9669b97016

```
3. put addresses from previous response to .env
4. replace COMPUTED_INIT_CODE_HASH in front-bot/hardhat-project/node_modules/@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol, line 26

```
hex'275c1d544bdc0c623289df4bc3f5b4306445316c4173ce251ef789cc34c49cd9' // init code hash
```
5. deploy router and pairs
```
npx hardhat run --network localhost scripts/deploy_pairs.js
```
6. put ROUTER_ADDRESS from previous response to .env
7. add token0/token1 liqudity
```
npx hardhat run --network localhost scripts/addLiquidity.js
```
success response:
```
addLiquidity
Added! tx_hash=0x6336f29b76ce323e5b478ef43ad4971f830b00e07936101a11ef82bdfd089207
```
8. add ETH liqudity
```
npx hardhat run --network localhost scripts/addLiquidityETH.js
```
success response:
```
addLiquidityETH
Added! tx_hash=0x31543cb87f549670df7e4ae1b7c8318f912c7f52a721f7bed5366ae8b34cfedc
```

8. make swap swapTokensForExactToken
```
npx hardhat run --network localhost scripts/swapTokensForExactTokens.js
```
success response:
``` 
reservers before 2000000 100000
token0 balance before 999999999999800000
token1 balance before 999999999998000000
token0 balance after 999999999999799495
token1 balance after 999999999998010000
reservers after 1990000 100505
Swapped! tx_hash=0x068452b3dd3b66616dd58f385aea5144afb0bbf068e7249a0584203a4d722236
```
### additional commands

1. get current reserves
```
npx hardhat run --network localhost scripts/reservers.js
```
success response:
```
reserves Token0/token1: 2000000 / 100000
reserves WETH/token0 address: 100000 / 100000
reserves WETH/token1 address: 0 / 0
```

2. get current balances
```
npx hardhat run --network localhost scripts/balances.js
```
success response:

```
balance WETH: 0
balance token0 address: 999999999999800000
balance token1 address: 999999999998000000
```


