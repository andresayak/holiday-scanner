import axios from "axios";
import {Injectable} from "@nestjs/common";
import {EnvService} from "../../../env/env.service";

interface ProxyData {
    host: string;
    port: number;
    username?: string;
    password?: string;
}

@Injectable()
export class ProxyList {
    list: ProxyData[] = [];
    constructor(private readonly envService: EnvService) {
    }

    async fetch() {
        const url = this.envService.get('PROXY_WEBSHARE_URL');
        if (!url) {
            throw new Error('env PROXY_WEBSHARE_URL not set');
        }
        const {data} = await axios.get(this.envService.get('PROXY_WEBSHARE_URL'));
        this.list = [];
        for (const item of data.split("\n")) {
            if (item) {
                const proxy = item.split(":");
                if (proxy.length == 2) {
                    this.list.push({
                        host: proxy[0],
                        port: parseInt(proxy[1]),
                    });
                }
                if (proxy.length == 4) {
                    this.list.push({
                        host: proxy[0],
                        port: parseInt(proxy[1]),
                        username: proxy[2],
                        password: proxy[3].trim(),
                    });
                }
            }
        }
        if (!this.list.length)
            throw new Error('proxy list empty');
    }

    getRand() {
        const i = Math.floor(Math.random() * this.list.length);
        return this.list[i];
    }
}
