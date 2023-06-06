import * as Telegram from 'node-telegram-bot-api';
import {EnvService} from "../env/env.service";
import {Injectable} from "@nestjs/common";

const timeStamp = (timestamp: number = null) => {
    const time = timestamp ? timestamp.toString() : new Date().getTime().toString();
    return time.substring(0, time.length - 3) + '.' + time.substring(time.length - 3);
}

@Injectable()
export class TgBot {
    private readonly tg?: Telegram;
    private chatId: string;
    constructor(private readonly envService: EnvService) {
        this.chatId = this.envService.get('TG_REPORT_CHAT')
        this.tg = new Telegram(this.envService.get('TG_REPORT_BOT'));
    }

    async sendMessage(message: string) {
        console.log('[TG]: ' + message);
        if (this.chatId && this.tg) {
            try {
                await this.tg.sendMessage(this.chatId, '[' + timeStamp() + ']'+this.envService.get('APP_NAME')+'\n'+message);
            } catch (e) {
                console.log(e);
            }
        }
    }
}
