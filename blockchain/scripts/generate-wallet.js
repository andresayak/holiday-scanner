const Wallet = require('ethereumjs-wallet');
const {secretPrompt, encrypt, decrypt} = require("./helpers/secret");
const CryptoJS = require('crypto-js');

async function main() {
    const EthWallet = Wallet.default.generate();
    const privateKey = EthWallet.getPrivateKeyString();
    let secret = await secretPrompt();
    console.log("address: " + EthWallet.getAddressString());
    console.log("privateKey: " + privateKey);

    let text = privateKey;

    text = CryptoJS.enc.Utf8.parse(text);
    let key = CryptoJS.enc.Utf8.parse(secret);

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

