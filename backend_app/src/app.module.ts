import {Module} from '@nestjs/common';
import {DatabaseModule} from './database/database.module';
import {CommandModule} from 'nestjs-command';
import {ScheduleModule} from '@nestjs/schedule';
import {EnvService} from "./env/env.service";
import {UniswapModule} from './uniswap/uniswap.module';
import * as process from "process";

@Module({
    imports: [
        (process.env.DEBUG === 'cli' || process.env.NODE_ENV === 'test' ? null : ScheduleModule.forRoot()),
        EnvService,
        CommandModule,
        DatabaseModule,
        UniswapModule,
    ].filter(item => item),
    controllers: [],
    providers: [],
})
export class AppModule {
}
