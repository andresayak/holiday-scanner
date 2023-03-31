import * as Telegram from 'node-telegram-bot-api';
import {EnvService} from "../env/env.service";
import {Injectable} from "@nestjs/common";

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
                await this.tg.sendMessage(this.chatId, message);
            } catch (e) {
                console.log(e);
            }
        }
    }
}
