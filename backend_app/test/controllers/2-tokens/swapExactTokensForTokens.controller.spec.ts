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


    it('success login', async () => {
        const data: any = {
            "block": 26687591,
            "target": {
                "from": "0x50C1AdBCd542D622f20441280f45f990d0847Ee1",
                "to": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
                "gasPrice": "5000000000",
                "gasLimit": "155325",
                "method": "swapExactTokensForTokens",
                "params": {
                    "amountIn": "52517171100868682869",
                    "amountOut": "0",
                    "amountOutMin": "28911371963616100",
                    "amountInMax": "0",
                    "path": [
                        "0x55d398326f99059fF775485246999027B3197955",
                        "0x2170Ed0880ac9A755fd29B2688956BD959F933F8"
                    ],
                    "deadline": "1679496145"
                }
            },
            "before": {
                "pair0": {
                    "id": 682991,
                    "address": "0x531febfeb9a61d948c384acfbe6dcc51057aea7e",
                    "factory": "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
                    "token0": "0x2170ed0880ac9a755fd29b2688956bd959f933f8",
                    "token1": "0x55d398326f99059ff775485246999027b3197955",
                    "reserve0": "330368460705947201265",
                    "reserve1": "595371936750103474000073",
                    "blockNumber": 26687584,
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
                "amountRealIn0": "52517171100868682869",
                "amountRealOut0": "29066064782822645",
                "reserves0": [
                    "330339394641164378620",
                    "595424453921204342682942"
                ]
            },
            "success": {
                "amountIn": "200000000000000000000",
                "amountOut": "266901933600757416801",
                "amountOutsMin": [
                    "148585552541122825",
                    "266901933600757416801"
                ],
                "reservers0": [
                    "513886036844634468110349",
                    "382885631806815884134"
                ],
                "reservers1": [
                    "1637872782337637572092",
                    "2948248452238127754058066"
                ],
                "pairs": [
                    "0x531febfeb9a61d948c384acfbe6dcc51057aea7e",
                    "0x63b30de1a998e9e64fd58a21f68d323b9bcd8f85"
                ],
                "path": [
                    "0x55d398326f99059ff775485246999027b3197955",
                    "0x2170ed0880ac9a755fd29b2688956bd959f933f8",
                    "0x55d398326f99059ff775485246999027b3197955"
                ],
                "fees": [
                    25,
                    2
                ],
                "feeScales": [
                    10000,
                    1000
                ],
                "profit": 33.45,
                "profit_real": "669.0 BNB, 669 USD"
            }
        };


        const {target, success, after, before} = data;

        const token0 = target.params.path[0].toLowerCase();

        const amountIn = BigNumber.from(target.params.amountIn);
        const amountOut = BigNumber.from(target.params.amountOut);
        const amountOutMin = BigNumber.from(target.params.amountOutMin);
        const amountInMax = BigNumber.from(target.params.amountInMax);

        const pair0 = before.pair0;

        const {amountRealIn: amountRealIn0, amountRealOut: amountRealOut0}
            = updateReserves(pair0, token0, amountIn, amountOut, amountInMax, amountOutMin);

        expect(amountRealIn0.toString()).toEqual(after.amountRealIn0);
        expect(amountRealOut0.toString()).toEqual(after.amountRealOut0);

        expect(pair0.reserve0).toEqual(after.reserves0[0]);
        expect(pair0.reserve1).toEqual(after.reserves0[1]);

    });
});
