import {Test} from '@nestjs/testing';
import {useContainer} from 'class-validator';
import * as nodemailerMock from 'nodemailer-mock';
import {TestingModule} from '@nestjs/testing/testing-module';
import {INestApplication} from '@nestjs/common';
import {Connection} from 'typeorm';
import {AppModule} from '../src/app.module';


const bootstrap = () => {
    return Test.createTestingModule({
        imports: [AppModule],
    })
        .compile();
};

const createApplication = async (moduleRef: TestingModule) => {
    const app = moduleRef.createNestApplication();
    useContainer(app.select(AppModule), {fallbackOnErrors: true});
    await app.init();
    return app;
};

export const setupTest = (
    beforeCallback: (app: INestApplication, moduleRef: TestingModule) => void,
    afterCallback: (app: INestApplication, moduleRef: TestingModule) => void = null
) => {
    let app: INestApplication;
    let connection: Connection;
    let moduleRef: TestingModule;

    beforeEach(async () => {
        moduleRef = await bootstrap();
        app = await createApplication(moduleRef);
        beforeCallback(app, moduleRef);
    });
    afterEach(async () => {
        if (afterCallback) afterCallback(app, moduleRef);
        await nodemailerMock.mock.reset();
        await app.close();
    });
};

export default {
    bootstrap,
    createApplication,
};
