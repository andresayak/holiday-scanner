import {Module} from '@nestjs/common';
import {providers} from './uniswap.providers';
import {DatabaseModule} from '../database/database.module';
import commands from './commands';

@Module({
    imports: [DatabaseModule],
    providers: [...providers, ...commands],
    controllers: [],
})
export class UniswapModule {}
