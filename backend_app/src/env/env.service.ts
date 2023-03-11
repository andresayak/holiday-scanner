import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as process from "process";

export interface EnvData {
    // application
    APP_NAME: string,
    APP_ENV: string;
    APP_DEBUG: boolean;
    APP_URL: string;

    LOG_PATH: string;
    // database
    DATABASE_TYPE: 'mysql' | 'mariadb';
    DATABASE_HOST?: string;
    DATABASE_NAME: string;
    DATABASE_PORT?: number;
    DATABASE_USER: string;
    DATABASE_PASSWORD: string;
    DATABASE_LOGGING: boolean;

    REDIS_PASSWORD: string;
    REDIS_HOST: string;
    REDIS_PORT: number;

    ETH_PRIVAT_KEY: string;
    ETH_CONTRACT_ADDRESS: string;
    ETH_HOST: string;
}

export class EnvService {
    vars: EnvData | null = null;

    constructor() {
        const environment = process.env.NODE_ENV || 'development';
        let data: any = this.filter(dotenv.parse(fs.readFileSync(`.env`)));
        data.APP_ENV = environment;

        this.vars = data as EnvData;
        return this;
    }

    filter(data: any): EnvData {
        Object.entries(data).map(([col, value]) => {
            if (process.env[col] !== undefined) {
                data[col] = process.env[col];
                return;
            }
            if (value === 'true') {
                value = true;
            }
            if (value === 'false') {
                value = false;
            }
            data[col] = value;
        });
        return data;
    }

    get(name: string) {
        if (this.vars === null) {
            this.read();
        }
        return this.vars[name];
    }

    read(): EnvData {
        if (this.vars === null) {
            throw "configs not init";
        }
        return this.vars;
    }

    isDev(): boolean {
        return this.vars.APP_ENV === 'development';
    }

    isProd(): boolean {
        return this.vars.APP_ENV === 'production';
    }
}
