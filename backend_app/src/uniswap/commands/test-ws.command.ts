import {Injectable} from "@nestjs/common";
import {Command, Positional} from "nestjs-command";
import {WebSocketProvider} from "@ethersproject/providers";


@Injectable()
export class TestWsCommand {
    @Command({
        command: 'test:swaps <url>',
        autoExit: false
    })
    async create(
        @Positional({
            name: 'url',
            type: 'string'
        })
            url: string,
    ) {
        const provider = new WebSocketProvider(url);

        provider.on("pending", (txHash) => {
            console.log('tx', txHash)
        });

        provider.on("block", (block) => {
            console.log('block', block)
        });
    }
}

