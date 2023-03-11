import {Module, Global} from '@nestjs/common'
import {EnvModule} from '../env/env.module';
import {databaseProviders} from './database.providers';

@Global()
@Module({
    imports: [
        EnvModule
    ],
    providers: [...databaseProviders],
    exports: [...databaseProviders],
})
export class DatabaseModule {
}
