import {ScanTransactionsCommand} from "./scan-transactions.command";
import {ScanReservesCommand} from "./scan-reserves.command";
import {ScanTradeCommand} from "./scan-trade.command";
import {ScanContractsCommand} from "./scan-contracts.command";
import {WalletCheckCommand} from "./wallet-check.command";
import {ScanSandwichCommand} from "./scan-sandwich.command";
import {ProvidersCheckCommand} from "./providers-check.command";
import {ScanPairsCommand} from "./scan-pairs.command";
import {ImportTokensCommand} from "./import-tokens.command";

export default [
    ScanTransactionsCommand,
    ScanReservesCommand,
    ScanTradeCommand,
    ScanContractsCommand,
    WalletCheckCommand,
    ScanSandwichCommand,
    ProvidersCheckCommand,
    ScanPairsCommand,
    ImportTokensCommand
];
