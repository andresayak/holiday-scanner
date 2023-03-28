import {ScanTransactionsCommand} from "./scan-transactions.command";
import {ScanReservesCommand} from "./scan-reserves.command";
import {ScanTradeCommand} from "./scan-trade.command";
import {ScanPairsContractsCommand} from "./scan-pairs-contracts.command";
import {WalletCheckCommand} from "./wallet-check.command";
import {ScanSandwichCommand} from "./scan-sandwich.command";
import {ProvidersCheckCommand} from "./providers-check.command";
import {ScanPairsCommand} from "./scan-pairs.command";
import {ImportTokensCommand} from "./import-tokens.command";
import {ScanArbitrageCommand} from "./scan-arbitrage.command";
import {ScanTestCommand} from "./scan-test.command";
import {ImportPairsCommand} from "./import-pairs.command";
import {ScanTokensContractsCommand} from "./scan-tokens-contracts.command";
import {TestTokensCommand} from "./test-tokens.command";
import {SyncTokensCommand} from "./sync-tokens.command";
import {TestSwapCommand} from "./test-swap.command";
import {ScanVariantsCommand} from "./scan-variants.command";

export default [
    ScanTransactionsCommand,
    ScanReservesCommand,
    ScanTradeCommand,
    ScanPairsContractsCommand,
    WalletCheckCommand,
    ScanSandwichCommand,
    ProvidersCheckCommand,
    ScanPairsCommand,
    ImportTokensCommand,
    ImportPairsCommand,
    ScanArbitrageCommand,
    ScanVariantsCommand,
    ScanTestCommand,
    ScanTokensContractsCommand,
    TestTokensCommand,
    SyncTokensCommand,
    TestSwapCommand
];
