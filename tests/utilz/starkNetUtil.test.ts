import {Keypair} from "@solana/web3.js";
import {BitUtil} from "../../src/utilz/bitUtil";
import {decodeUTF8} from "tweetnacl-util";
import {SolUtil} from "../../src/utilz/solUtil";
import {assert} from "chai";
import {ChainUtil} from "../../src/utilz/chainUtil";
import {BigNumberish, ec, encode, hash, WeierstrassSignatureType} from "starknet";
import {StarkNetUtil} from "../../src/utilz/starkNetUtil";
import StrUtil from "../../src/utilz/strUtil";

describe('starknet sig tests', async function () {
  it('sig and check', async function () {


    const privateKey = '0x1234567890987654321';
    const starknetPublicKey = ec.starkCurve.getStarkKey(privateKey);
    const fullPublicKey = encode.addHexPrefix(
      encode.buf2hex(ec.starkCurve.getPublicKey(privateKey, false))
    );

    const message: BigNumberish[] = [1, 128, 18, 14];

    const msgHash = hash.computeHashOnElements(message);
    const signature: WeierstrassSignatureType = ec.starkCurve.sign(msgHash, privateKey);


    const msgHash1 = hash.computeHashOnElements(message);
    const result1 = ec.starkCurve.verify(signature, msgHash1, fullPublicKey);
    console.log('Result (boolean) =', result1);

  })

  it('sig and check 2', async function () {
    const msg = BitUtil.stringToBytesUtf('Test for starknet!');
    const privateKey = BitUtil.base16ToBytes('1234567890987654321');
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