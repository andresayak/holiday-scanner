import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {useContainer} from 'class-validator';
import {ContextInterceptor} from './context.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    useContainer(app.select(AppModule), {fallbackOnErrors: true});
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new ContextInterceptor());

    await app.listen(5000);
}

bootstrap();
