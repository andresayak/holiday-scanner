import {Builder} from "selenium-webdriver";

export const request = async function(url: string) {
    let driver = await new Builder()
        .forBrowser("firefox")
        .usingServer("http://selenium:4444/wd/hub/")
        .build();

    let response;
    try {
        let status = false;
        let count = 0;
        while (!status && count < 15) {
            console.log('url', url);
            await driver.get(url);
            response = await driver.getPageSource();
            if (response.match('/Ray ID: <strong/')) {
                console.log('Ray ID');
                await new Promise((done)=>setTimeout(done, 1000));
                count++;
            }else{
                status = true;
            }
        }
    } finally {
        driver.quit();
    }
    driver.quit();
    return response;
};
