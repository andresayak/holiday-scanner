import {ScanTransactionsCommand} from "./scan-transactions.command";
import {ScanReservesCommand} from "./scan-reserves.command";
import {ScanTradeCommand} from "./scan-trade.command";
import {ScanPairsContractsCommand} from "./scan-pairs-contracts.command";
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
import {ScanVariants3Command} from "./scan-variants3.command";
import {TestWsCommand} from "./test-ws.command";
import {CheckPendingCommand} from "./check-pending.command";
import {CheckReservesCommand} from "./check-reserves.command";
import {ScanPendingCommand} from "./scan-pending.command";
import {ScanMinersCommand} from "./scan-miners.command";
import {ScanReservesIpcCommand} from "./scan-reserves-ipc.command";
import {CheckPeersCommand} from "./check-peers.command";
import {ScanValidatorsCommand} from "./scan-validators.command";
import {CheckPeersValidatorsCommand} from "./check-peers-validators.command";
import {CheckPeersPingCommand} from "./check-peers-ping.command";
import {ScanValidatorsRangeCommand} from "./scan-validators-old.command";
import {PeersListCommand} from "./peers-list.command";
import {PeersAddCommand} from "./peers-add.command";
import {PeersRemoveCommand} from "./peers-remove.command";
import {CalcValidatorsCommand} from "./calc-validators.command";

export default [
    ScanTransactionsCommand,
    ScanReservesCommand,
    ScanReservesIpcCommand,
    ScanTradeCommand,
    ScanPairsContractsCommand,
    ScanSandwichCommand,
    ProvidersCheckCommand,
    ScanPairsCommand,
    ImportTokensCommand,
    ImportPairsCommand,
    ScanArbitrageCommand,
    ScanVariantsCommand,
    ScanVariants3Command,
    ScanTestCommand,
    ScanTokensContractsCommand,
    TestTokensCommand,
    SyncTokensCommand,
    TestSwapCommand,
    TestWsCommand,
    CheckPendingCommand,
    CheckReservesCommand,
    ScanPendingCommand,
    ScanMinersCommand,
    CheckPeersCommand,
    ScanValidatorsCommand,
    ScanValidatorsRangeCommand,
    CheckPeersValidatorsCommand,
    CheckPeersPingCommand,
    PeersListCommand,
    PeersAddCommand,
    PeersRemoveCommand,
    CalcValidatorsCommand
];
