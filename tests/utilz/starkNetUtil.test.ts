import {BitUtil} from "../../src/utilz/bitUtil";
import {assert} from "chai";
import {StarkNetUtil} from "../../src/utilz/starkNetUtil";
import {StrUtil} from "../../src/utilz/strUtil";

describe('starknet sig tests', async function () {

  it('sig and check 2', async function () {
    const msg = BitUtil.stringToBytesUtf('Test for starknet!');
    const privateKey = BitUtil.base16ToBytes('12345678909876543210');
    const fullPublicKey = StarkNetUtil.convertPrivKeyToPubKey(privateKey);

    // sign
    const sig = StarkNetUtil.signBytes(privateKey, msg);
    console.log('sig', StrUtil.fmt(sig));

    // verify
    const valid1 = StarkNetUtil.checkSignature(fullPublicKey, msg, sig);
    assert.isTrue(valid1);

    msg[msg.length - 1] = 12;
    const valid2 = StarkNetUtil.checkSignature(fullPublicKey, msg, sig);
    assert.isFalse(valid2);

  })

});