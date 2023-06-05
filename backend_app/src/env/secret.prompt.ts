import {prompt} from "enquirer";
import {EnvService} from "./env.service";

export const secretPrompt = async(envService:EnvService) =>{
    const response: {secret: string} = await prompt({
        type: 'input',
        name: 'secret',
        required: true,
        message: 'What secret?'
    });

    let {secret} = response;
    envService.read(secret);
}
