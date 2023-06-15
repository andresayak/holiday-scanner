import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as process from "process";
import * as CryptoJS from "crypto-js";
import {isUndefined} from "@nestjs/common/utils/shared.utils";

const decrypt = (encrypted, key) => {
    try{
        return CryptoJS.AES.decrypt({ciphertext: CryptoJS.enc.Hex.parse(encrypted)}, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.ZeroPadding
        }).toString(CryptoJS.enc.Utf8);
    }catch (e) {
        console.log(e);
        throw new Error('invalid secret');
    }
}

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

const SECRET_SUFFIX = '_ENCRYPTED';
export class EnvService {
     _vars: EnvData | null = null;

    constructor() {
        this.read();
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

    decrypt(data: any, secret: string): EnvData {
        Object.entries(data).map(([col, value]) => {
            if(col.match(/_ENCRYPTED/)){
                data[col.replace(/_ENCRYPTED$/, '')] = decrypt(value, secret);
            }else
            data[col] = value;
        });
        return data;
    }

    get(name: string) {
        if(isUndefined(this._vars[name]) && this._vars[name+SECRET_SUFFIX]){
            throw new Error('secret not set');
        }
        return this._vars[name];
    }

    read(secret?: string): EnvData {
        const environment = process.env.NODE_ENV || 'development';
        let data: any = this.filter(dotenv.parse(fs.readFileSync(`.env`)));
        if(secret)
            data = this.decrypt(data, CryptoJS.enc.Utf8.parse(secret));
        data.APP_ENV = environment;
        this._vars = data as EnvData;
        return this._vars;
    }

    isDev(): boolean {
        return this._vars.APP_ENV === 'development';
    }

    isProd(): boolean {
        return this._vars.APP_ENV === 'production';
    }
}
