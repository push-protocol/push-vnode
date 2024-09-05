import 'mocha'
import chai from 'chai'
import {
  Block,
  InitDid,
  Signer,
  Transaction,
  TransactionObj,
  TxAttestorData,
  TxValidatorData
} from "../../src/generated/push/block_pb";
import IdUtil from "../../src/utilz/idUtil";
import {BitUtil} from "../../src/utilz/bitUtil";
import {HashUtil} from "../../src/utilz/hashUtil";
import DateUtil from "../../src/utilz/dateUtil";

const expect = chai.expect;

/*
README:

yarn install
yarn build:proto
  generates from (src/proto) to (src/generated)
now you can use .proto stubs for typescript
 */

describe('block tests', function () {


  it('create transaction and block, serialize/deserialize', async function () {
    console.log("building ------------------------- ");
    // build transaction data (app-dependent)
    const data = new InitDid();
    data.setDid('0xAA');
    data.setMasterpubkey('0xBB');
    data.setDerivedkeyindex(1);
    data.setDerivedpubkey('0xCC');
    data.setEncderivedprivkey('0xDD');
    console.log("data as json", JSON.stringify(data.toObject()));

    // build transaction
    const t = new Transaction();
    t.setType(3);
    t.setCategory('INIT_DID');
    t.setSender('eip155:1:0xAA');
    t.setRecipientsList(['eip155:1:0xBB', 'eip155:1:0xCC']);
    t.setData(data.serializeBinary())
    t.setSalt(IdUtil.getUuidV4AsBytes()); // uuid.parse(uuid.v4())
    t.setApitoken("eyJub2RlcyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMzAsInJhbmRvbUhleCI6ImY3YmY3YmYwM2ZlYTBhNzI1MTU2OWUwNWRlNjU2ODJkYjU1OTU1N2UiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjAsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyNDY3MzI0MDAxOSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4YjMzM2NjMWI3MWM0NGM0MDhkOTZiN2JmYjYzODU0OTNjZjE2N2NiMmJkMjU1MjdkNzg2ZDM4ZjdiOTgwZWFkMzAxMmY3NmNhNzhlM2FiMWEzN2U2YTFjY2ZkMjBiNjkzZGVmZDAwOWM4NzExY2ZjODlmMDUyYjM5MzY4ZjFjZTgxYiJ9LHsibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjUsInJhbmRvbUhleCI6IjkyMTY4NzRkZjBlMTQ4NTk3ZjlkNDRkMGRmZmFlZGU5NTg0NGRkMTciLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyMjQ2NTAsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyNDY3MzIyNDY1NSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4N2JmYzQ0MjQ0ZGM0MTdhMjg0YzEwODUwZGEzNTE2YzUwNWEwNjJmYjIyYmI1ODU0ODg2YWEyOTk3OWUwMmYxOTdlZWMyYzk2ZDVkOTQ4ZDBhMWQ2NTBlYzIzNGRhMDVjMGY5M2JlNWUyMDkxNjFlYzJjY2JjMWU5YzllNzQyOGIxYiJ9LHsibm9kZUlkIjoiMHg5OEY5RDkxMEFlZjlCM0I5QTQ1MTM3YWYxQ0E3Njc1ZUQ5MGE1MzU1IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjQsInJhbmRvbUhleCI6IjBkOWExNmE4OTljYWQwZWZjODgzZjM0NWQwZjgwYjdmYTE1YTY1NmYiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyMjY5NDMsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweGZEQUVhZjdhZkNGYmI0ZTRkMTZEQzY2YkQyMDM5ZmQ2MDA0Q0ZjZTgiLCJ0c01pbGxpcyI6MTcyNDY3MzIyNjk0Nywic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4YmE2Mjk2OTZlZWU4MDQ4ZDE2OTA3MDNhZmVjYWY4ZmJjM2Y4NDMxOWQ0OTFhZGIzY2YzZGYzMzExMTllMDAyOTA1MTc3MjAyNzkxNzEzNTMzMmU0MGZiMzI2OTM5Y2JhN2Y2NDc2NmYyYjY5MzQwZTZlNGYwZmIzNjM2OThmYzkxYiJ9XX0="); // fake token
    t.setFee("1"); // tbd
    t.setSignature(BitUtil.base16ToBytes("EE")); // fake signature
    console.log("tx as json", JSON.stringify(t.toObject()));

    const txAsBytes = t.serializeBinary();
    console.log("tx as base16", BitUtil.bytesToBase16(txAsBytes));
    console.log("tx hash", BitUtil.bytesToBase16(HashUtil.sha256AsBytes(txAsBytes)));
    // build block

    // transactions
    const to = new TransactionObj();
    to.setTx(t);
    const vd = new TxValidatorData();
    vd.setVote(1);
    const ad = new TxAttestorData();
    ad.setVote(1);
    to.setValidatordata(vd);
    to.setAttestordataList([ad]);

    // signers
    const s1 = new Signer();
    s1.setSig(BitUtil.base16ToBytes('CC'));
    const s2 = new Signer();
    s2.setSig(BitUtil.base16ToBytes('EE'));

    const b = new Block();
    b.setTs(DateUtil.currentTimeSeconds());
    b.setTxobjList([to]);
    b.setAttesttoken('DD'); // fake attest token
    b.setSignersList([s1, s2]);
    b.setAttesttoken(BitUtil.base16ToBytes("C1CC"));
    console.log("block as json", JSON.stringify(b.toObject()));

    const blockAsBytes = b.serializeBinary();
    console.log("block as base16", BitUtil.bytesToBase16(blockAsBytes));
    console.log("block hash", BitUtil.bytesToBase16(HashUtil.sha256AsBytes(blockAsBytes)));


    // PARSE it back into objects
    console.log("parsing ------------------------- ");
    let t2 = Transaction.deserializeBinary(txAsBytes);
    console.log("tx2 as json", JSON.stringify(t2.toObject()));

    let b2 = Block.deserializeBinary(blockAsBytes);
    console.log("block2 as json", JSON.stringify(b2.toObject()));
  });

  it('test for setting data as string (do not use this)', async function () {
    const t = new Transaction();
    let originalData = "AABB";
    console.log('assign data ', originalData);
    let encoded = BitUtil.bytesToBase64(BitUtil.base16ToBytes("AABB"));
    console.log('encoded for assignment ', encoded);
    t.setData(encoded);
    console.log("t as bin", BitUtil.bytesToBase16(t.serializeBinary()));
    let protoEncodedAndDecoded: any = Transaction.deserializeBinary(t.serializeBinary()).getData();
    console.log('expeced assigned data, to be ', originalData, "but got", protoEncodedAndDecoded, '=', BitUtil.bytesToBase16(protoEncodedAndDecoded));
  });

})
