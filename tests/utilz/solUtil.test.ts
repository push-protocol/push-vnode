import {Keypair} from "@solana/web3.js";
import nacl from "tweetnacl";
import {decodeUTF8} from "tweetnacl-util";
import {SolUtil} from "../../src/utilz/solUtil";
import {assert} from "chai";
import {ChainUtil} from "../../src/utilz/chainUtil";
import {BitUtil} from "../../src/utilz/bitUtil";

describe('solana sig tests', async function () {
  it('sig and check', async function () {

    const keypair = Keypair.fromSecretKey(
      Uint8Array.from([
        174, 47, 154, 16, 202, 193, 206, 113, 199, 190, 53, 133, 169, 175, 31, 56,
        222, 53, 138, 189, 224, 216, 117, 173, 10, 149, 53, 45, 73, 251, 237, 246,
        15, 185, 186, 82, 177, 240, 148, 69, 241, 227, 167, 80, 141, 89, 240, 121,
        121, 35, 172, 247, 68, 251, 226, 218, 48, 63, 176, 109, 168, 89, 238, 135,
      ]),
    );
    console.log(BitUtil.bytesToBase16(keypair.secretKey));
    const message = "The quick brown fox jumps over the lazy dog";
    const messageBytes = decodeUTF8(message);

    const signature = SolUtil.signBytes(keypair.secretKey, messageBytes);
    const result = SolUtil.checkSignature(keypair.publicKey.toBytes(), messageBytes, signature);
    console.log(result);
    assert.isTrue(result);
  })

  it('recover public key', async function () {

    let strAddr = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv';
    let [caip, err] = ChainUtil.parseCaipAddress(strAddr);
    assert.isTrue(err == null);
    const pubKey = SolUtil.convertAddrToPubKey(caip.addr);
    console.log(pubKey);
    assert(pubKey != null);
  })
});