import {setupTest} from '../../test.module';
import {TestingModule} from '@nestjs/testing/testing-module';
import {INestApplication} from '@nestjs/common';
import {updateReserves} from "../../../src/uniswap/commands/helpers/updateReserves";
import {BigNumber} from "ethers";

describe('swapTokensForExactTokens', () => {
    let app: INestApplication;
    let moduleRef: TestingModule;

    setupTest(async (_app: INestApplication, _moduleRef: TestingModule) => {
        app = _app;
        moduleRef = _moduleRef;
    });


    it.only('success login', async () => {
        const data: any = {
            "target": {
                "from": "0x5c1D8d6B29ca99DE9c583371b87341d59b1A4C7A",
                "to": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
                "gasPrice": "5000000000",
                "gasLimit": "215186",
                "method": "swapExactTokensForTokens",
                "params": {
                    "amountIn": "100000000000000000000",
                    "amountOut": "0",
                    "amountOutMin": "106334384855758694801",
                    "amountInMax": "0",
                    "path": ["0xa73164db271931cf952cbaeff9e8f5817b42fa5c", "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", "0x9D986A3f147212327Dd658F712d5264a73a1fdB0"],
                    "deadline": "1679484902"
                }
            },
            "before": {
                "pair0": {
                    "id": 1948233,
                    "address": "0x13f80c53b837622e899e1ac0021ed3d1775caefa",
                    "factory": "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
                    "token0": "0xa73164db271931cf952cbaeff9e8f5817b42fa5c",
                    "token1": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
                    "reserve0": "233569964762106747174969",
                    "reserve1": "1130051269202331303249",
                    "blockNumber": 26683873,
                    "transactionIndex": null,
                    "logIndex": null,
                    "fee": 25,
                    "fee_scale": 10000,
                    "isTested": false,
                    "isVerified": false,
                    "status": null,
                    "network": "bsc_mainnet"
                },
                "pair1": {
                    "id": 1033635,
                    "address": "0x468cde4ad48cbafa3cdfb68fd9f2c114ddfe6c08",
                    "factory": "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
                    "token0": "0x9d986a3f147212327dd658f712d5264a73a1fdb0",
                    "token1": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
                    "reserve0": "24295678870735189584248",
                    "reserve1": "109026351159504781907",
                    "blockNumber": 26683885,
                    "transactionIndex": null,
                    "logIndex": null,
                    "fee": 25,
                    "fee_scale": 10000,
                    "isTested": false,
                    "isVerified": false,
                    "status": null,
                    "network": "bsc_mainnet"
                }
            },
            "after": {
                "amountRealIn0": "100000000000000000000",
                "amountRealOut0": "18945015400847645713868",
                "reserves0": [
                    "233669964762106747174969",//+
                    "1129568867731444532139"//-
                ],
                "amountRealIn1": "18945015400847645713868",
                "amountRealOut1": "47700467974841089227",
                "reserves1": [
                    "24188919374193563071073",//-
                    "109508752630391553017"//++
                ]
            },
            "success": {
                "amountIn": "300000000000000000",
                "amountOut": "917227687419805583",
                "amountOutsMin": ["209975655906434854596", "917227687419805583"],
                "reservers0": ["61325883184663692680", "43240694271582835298116"],
                "reservers1": ["10148445859233867416263", "45337089911533520911"],
                "pairs": ["0x468cde4ad48cbafa3cdfb68fd9f2c114ddfe6c08", "0xb15f34082baa4e3515a49e05d4d1d40ce933da0b"],
                "path": ["0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", "0x9d986a3f147212327dd658f712d5264a73a1fdb0", "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"],
                "fees": [25, 2],
                "feeScales": [10000, 1000],
                "profit": 205.74,
                "profit_real": "6.1722 BNB, 1851.66 USD"
            }
        };

        const {target, success, after, before} = data;

        const token0 = target.params.path[0].toLowerCase();
        const token1 = target.params.path[1].toLowerCase();
        const token2 = target.params.path[2]?.toLowerCase();

        const amountIn = BigNumber.from(target.params.amountIn);
        const amountOut = BigNumber.from(target.params.amountOut);
        const amountOutMin = BigNumber.from(target.params.amountOutMin);
        const amountInMax = BigNumber.from(target.params.amountInMax);

        const pair0 = before.pair0;
        const pair1 = before.pair1 ? before.pair1 : {};

        const {amountRealIn: amountRealIn0, amountRealOut: amountRealOut0}
            = updateReserves(pair0, token0, amountIn, BigNumber.from(0), amountInMax, BigNumber.from(0));

        expect(amountRealIn0.toString()).toEqual('100000000000000000000');
        expect(amountRealOut0.toString()).toEqual('482401470886771110');

      const {amountRealIn: amountRealIn1, amountRealOut: amountRealOut1}
          = updateReserves(pair1, token1, amountRealOut0, amountOut, BigNumber.from(0), amountOutMin);

        expect(amountRealIn1.toString()).toEqual('482401470886771110');
        expect(amountRealOut1.toString()).toEqual('106759496541626513175');

        const diff = BigNumber.from(after['reserves0'][0]).sub(pair0.reserve0);
        console.log('diff='+diff);
        expect(pair0.reserve0).toEqual(after['reserves0'][0]);
        //expect(pair0.reserve1).toEqual(after['reserves0'][1]);

        //expect(pair1.reserve0).toEqual(after['reserves0'][0]);
        //expect(pair1.reserve1).toEqual(after['reserves1'][1]);

    });
});
