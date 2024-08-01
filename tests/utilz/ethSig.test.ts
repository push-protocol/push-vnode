// noinspection SpellCheckingInspection
import 'mocha'
import {assert} from "chai";
import {Wallet} from "ethers";
import {EthSig} from "../../src/utilz/ethSig";
import crypto from "crypto";

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
})
