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
            "target": {
                "from": "0xF52ebEA7b851E452ecE018FbD753bd6cB5387E36",
                "to": "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8",
                "gasPrice": "6000000000",
                "gasLimit": "250000",
                "method": "swapTokensForExactTokens",
                "params": {
                    "amountIn": "0",
                    "amountOut": "500000000000000000000",
                    "amountOutMin": "0",
                    "amountInMax": "45244710000000000000",
                    "path": ["0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", "0x201bC9F242f74C47Bbd898a5DC99cDCD81A21943"],
                    "deadline": "1679480296"
                }
            },
            "before": {
                "pair0": {
                    "id": 678061,
                    "address": "0x55ceef0a5252b87b19b65ef5967674c91e5c3af6",
                    "factory": "0x858e3312ed3a876947ea49d572a7c42de08af7ee",
                    "token0": "0x201bc9f242f74c47bbd898a5dc99cdcd81a21943",
                    "token1": "0xe9e7cea3dedca5984780bafc599bd69add087d56",
                    "reserve0": "586830430159828014437240",
                    "reserve1": "52522679886329659292673",
                    "blockNumber": 26682606,
                    "transactionIndex": null,
                    "logIndex": null,
                    "fee": 2,
                    "fee_scale": 1000,
                    "isTested": false,
                    "isVerified": false,
                    "status": null,
                    "network": "bsc_mainnet"
                }
            },
            "after": {
                "amountRealIn0": "5651443219867976877841",
                "amountRealOut0": "500000000000000000000",
                "reserves0": ["586330430159828014437240", "58174123106197636170514"]
            },
            "success": {
                "amountIn": "200000000000000000000",
                "amountOut": "218204808198802197874",
                "amountOutsMin": ["2211965849960996588049", "218204808198802197874"],
                "reservers0": ["27421709040348765449119", "306251484370352981796182"],
                "reservers1": ["586330430159828014437240", "58174123106197636170514"],
                "pairs": ["0xbe45115c75e7ce908fabc9584e6c18c4a74aa37f", "0x55ceef0a5252b87b19b65ef5967674c91e5c3af6"],
                "path": ["0xe9e7cea3dedca5984780bafc599bd69add087d56", "0x201bc9f242f74c47bbd898a5dc99cdcd81a21943", "0xe9e7cea3dedca5984780bafc599bd69add087d56"],
                "fees": [25, 2],
                "feeScales": [10000, 1000],
                "profit": 9.1,
                "profit_real": "182.0 BNB, 182 USD"
            }
        };

        const {target, success, before} = data;

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
            = updateReserves(pair0, token1, amountIn, amountOut, amountInMax, amountOutMin);

        expect(amountRealIn0.toString()).toEqual('44879075902217357890');
        expect(amountRealOut0.toString()).toEqual('500000000000000000000')

    });
});
