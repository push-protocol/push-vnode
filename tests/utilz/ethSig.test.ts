import 'mocha'
import {assert} from "chai";
import {Wallet} from "ethers";
import {EthSig} from "../../src/utilz/ethSig";
import crypto from "crypto";
import {BitUtil} from "../../src/utilz/bitUtil";
import {readFileSync} from "fs";

describe('api test3', function () {
    it('testSig', async function () {
        // create random private key, encrypt it with password, and store as encryptedJsonWallet
        const wallet1PrivKey = "0x" + crypto.randomBytes(32).toString("hex");
        console.log("pk", wallet1PrivKey);
        const wallet1 = new Wallet(wallet1PrivKey);
        console.log("address", await wallet1.getAddress());
        console.log("pubkey", wallet1.publicKey);
        // create sig
        let metaObj = {address: "0x1"};
        let obj = {name: "user1", type: 1};
        let sig1 = await EthSig.create(wallet1, metaObj, obj);
        // check sig
        let metaObj2 = {address: "0x1"};
        let obj2 = {type: 1, name: "user1"}; // reverse order
        let targetWallet = await wallet1.getAddress();
        assert.isTrue(EthSig.check(sig1, targetWallet, metaObj2, obj2));
    })

    it('testSigRecovery', async function () {
        let msg = '08d0';

        let mnemonic = "radar blur cabbage chef fix engine embark joy scheme fiction master release";
        let wallet = Wallet.fromMnemonic(mnemonic);
        let signature = await EthSig.signBytes(wallet, BitUtil.base16ToBytes(msg));
        let recoveredPubKey = await EthSig.recoverAddressFromMsg(BitUtil.base16ToBytes(msg), signature);
        console.log(wallet.address, recoveredPubKey);
        assert.equal(wallet.address, recoveredPubKey);
    })
})
