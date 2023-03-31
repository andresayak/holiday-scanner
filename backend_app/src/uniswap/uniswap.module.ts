import {Module} from '@nestjs/common';
import {providers} from './uniswap.providers';
import {DatabaseModule} from '../database/database.module';
import commands from './commands';
import {TgBot} from "./TgBot";

@Module({
    imports: [DatabaseModule],
    providers: [...providers, ...commands, TgBot],
    controllers: [],
})
export class UniswapModule {}
