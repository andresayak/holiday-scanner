import {Builder} from "selenium-webdriver";
import {Injectable} from "@nestjs/common";
import {EnvService} from "../../../env/env.service";
import {ProxyList} from "./ProxtList";

@Injectable()
export class RequestService {
    constructor(private readonly envService: EnvService,
                private readonly proxyList: ProxyList) {

    }

    async request(url: string) {
        const proxyData = this.proxyList.getRand();
        if(!proxyData){
            throw new Error('proxyData empty');
        }
        const chrome = require('selenium-webdriver/chrome');
        let proxyAddress = (proxyData.username?proxyData.username+':'+proxyData.password+'@':'')+proxyData.host+':'+proxyData.port;
        let option = new chrome.Options()
            .addArguments(`--proxy-server=socks://${proxyAddress}`);
        let driver = await new Builder()
            .forBrowser("chrome")
            .setChromeOptions(option)
            .usingServer("http://selenium:4444/wd/hub/")
            .build();
        console.log('build');
        let response;
        try {
            let status = false;
            let count = 0;
            console.log('url', url);
            await driver.get(url);
            while (!status && count < 15) {
                response = await driver.getPageSource();
                if (response.match(/Ray ID:/)) {
                    console.log('Ray ID');
                    await new Promise((done) => setTimeout(done, 1000));
                    count++;
                } else {
                    status = true;
                }
            }
        } finally {
            await driver.quit();
        }
        return response;
    }
}
