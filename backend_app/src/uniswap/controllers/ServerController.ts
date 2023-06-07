import { Controller, Get } from '@nestjs/common';

@Controller('server')
export class ServerController {
    @Get('time')
    findAll(): string {
        return new Date().getTime().toString();
    }
}
