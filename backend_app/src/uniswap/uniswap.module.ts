import {Module} from '@nestjs/common';
import {providers} from './uniswap.providers';
import {DatabaseModule} from '../database/database.module';
import commands from './commands';
import {TgBot} from "./TgBot";
import {ServerController} from "./controllers/ServerController";

@Module({
    imports: [DatabaseModule],
    providers: [...providers, ...commands, TgBot],
    controllers: [
        ServerController
    ],
})
export class UniswapModule {}
