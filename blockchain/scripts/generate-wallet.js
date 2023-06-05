const Wallet = require('ethereumjs-wallet');
const EthWallet = Wallet.default.generate();
const privateKey = EthWallet.getPrivateKeyString();

const CryptoJS = require('crypto-js');

const encrypt = (text, key) => {
    let str = CryptoJS.AES.encrypt(text, key, {mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.ZeroPadding});
    return str.ciphertext.toString();
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

async function main() {

    const {prompt} = require('enquirer');

    const response = await prompt({
        type: 'input',
        name: 'secret',
        required: true,
        message: 'What secret?'
    });

    let {secret} = response;
    console.log(secret);

    console.log("address: " + EthWallet.getAddressString());
    console.log("privateKey: " + privateKey);

    let text = privateKey;

    text = CryptoJS.enc.Utf8.parse(text);
    key = CryptoJS.enc.Utf8.parse(secret);
    let key2 = CryptoJS.enc.Utf8.parse('wer');

    const encrypted = encrypt(text, key);
    console.log('encrypted', encrypted);

    const decrypted = decrypt(encrypted.toString(), key);

    console.log('decrypted', decrypted);

};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
