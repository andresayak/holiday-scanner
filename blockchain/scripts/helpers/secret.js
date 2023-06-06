const Wallet = require('ethereumjs-wallet');
const {prompt} = require("enquirer");
const CryptoJS = require('crypto-js');

const encrypt = (text, key) => {
    let str = CryptoJS.AES.encrypt(text, key, {mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.ZeroPadding});
    return str.ciphertext.toString();
}

const secretPrompt = async () => {
    const response = await prompt({
        type: 'password',
        name: 'secret',
        required: true,
        message: 'What secret?'
    });
    return response.secret;
}

const secretPromptAndDecrypt = async () => {
    const encrypted = process.env.ETH_PRIVATE_KEY_ENCRYPTED;
    const secret = await secretPrompt();
    return decrypt(encrypted.toString(), CryptoJS.enc.Utf8.parse(secret));
}

const decrypt = (encrypted, key) => {
    try{
        return CryptoJS.AES.decrypt({ciphertext: CryptoJS.enc.Hex.parse(encrypted)}, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.ZeroPadding
        }).toString(CryptoJS.enc.Utf8);
    }catch (e) {
        throw new Error('invalid secret');
    }
}

module.exports = {encrypt, secretPromptAndDecrypt, secretPrompt, decrypt};
