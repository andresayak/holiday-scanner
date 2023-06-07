import {Command} from 'nestjs-command';
import {Injectable} from '@nestjs/common';
import axios from "axios";

@Injectable()
export class CheckServersTimeCommand {
    constructor() {
    }

    @Command({
        command: 'check:servers-time',
        autoExit: false
    })
    async create() {

        const servers = [
            'localhost',//localhost
            '172.111.38.179',//ashburn
            '169.197.143.231',//seatle
            '65.109.64.78'//findland
        ];

        let min = null;
        await Promise.all(servers.map(ip=>{
            return new Promise((done)=>{
                const timeStart = new Date().getTime();
                axios.get('http://'+ip+':5000/api/server/time').then(json=>{
                    const timeEnd = new Date().getTime();
                    const requestTime = timeEnd - timeStart;
                    const {data} = json;
                    const time = parseInt(data);
                    if(min === null){
                        min = time;
                    }
                    const diff = time - min;
                    console.log('data', ip, time, diff, requestTime);
                    done(data);
                });
            })
        }))
        console.log('Done!');
    }
}
