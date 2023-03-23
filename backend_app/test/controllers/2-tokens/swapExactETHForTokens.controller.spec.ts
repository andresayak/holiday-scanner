import { setupTest } from '../../test.module';
import { TestingModule } from '@nestjs/testing/testing-module';
import { INestApplication } from '@nestjs/common';
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
      "block": 26685359,
      "target": {
        "from": "0x9B4bE91b170D05E006F4a86d9b980629f048B164",
        "to": "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        "gasPrice": "5000000000",
        "gasLimit": "209584",
        "method": "swapExactETHForTokens",
        "params": {
          "amountIn": "305213650000000000",
          "amountOut": "0",
          "amountOutMin": "2222667166177126",
          "amountInMax": "0",
          "path": [
            "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E"
          ],
          "deadline": "1679489078"
        }
      },
      "before": {
        "pair0": {
          "id": 1385585,
          "address": "0x231d9e7181e8479a8b40930961e93e7ed798542c",
          "factory": "0xca143ce32fe78f1f7019d7d551a6402fc5350c73",
          "token0": "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
          "token1": "0xfb5b838b6cfeedc2873ab27866079ac55363d37e",
          "reserve0": "9363619369333249924305",
          "reserve1": "78616424721537058882",
          "blockNumber": 26685317,
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
        "amountRealIn0": "305213650000000000",
        "amountRealOut0": "36121744362624906170",
        "reserves0": [
          "9363924582983249924305",
          "78613868654295955187"
        ]
      },
      "success": {
        "amountIn": "300000000000000000",
        "amountOut": "556312887956160950",
        "amountOutsMin": [
          "2531096357411886",
          "556312887956160950"
        ],
        "reservers0": [
          "353228602419745885665",
          "2988688841575549355"
        ],
        "reservers1": [
          "42494680358912152712",
          "9363924582983249924305"
        ],
        "pairs": [
          "0xadbfe34e35edb3d31f4bd1af5a513f4c57cdc5e9",
          "0x231d9e7181e8479a8b40930961e93e7ed798542c"
        ],
        "path": [
          "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
          "0xfb5b838b6cfeedc2873ab27866079ac55363d37e",
          "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
        ],
        "fees": [
          2,
          25
        ],
        "feeScales": [
          1000,
          10000
        ],
        "profit": 85.43,
        "profit_real": "2.5629 BNB, 768.87 USD"
      }
    };


    const {target, success, before } = data;

    const token0 = target.params.path[0].toLowerCase();
    const token1 = target.params.path[1].toLowerCase();
    const token2 = target.params.path[2]?.toLowerCase();

    const amountIn = BigNumber.from(target.params.amountIn);
    const amountOut = BigNumber.from(target.params.amountOut);
    const amountOutMin = BigNumber.from(target.params.amountOutMin);
    const amountInMax = BigNumber.from(target.params.amountInMax);

    const pair0 = before.pair0;
    const pair1 = before.pair1?before.pair1:{};


      const {amountRealIn: amountRealIn0, amountRealOut: amountRealOut0}
          = updateReserves(pair0, token0, amountIn, amountOut, amountInMax, amountOutMin);

      expect(amountRealIn0.toString()).toEqual('305213650000000000');
      expect(amountRealOut0.toString()).toEqual('2556067241103695');

      expect(pair0.reserve0).toEqual('9363924582983249924305');
      expect(pair0.reserve1).toEqual('78613868654295955187');

  });
});
