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
    t.setType(0);
    t.setCategory('INIT_DID');
    t.setSource('eip155:1:0xAA');
    t.setRecipientsList(['eip155:1:0xBB', 'eip155:1:0xCC']);
    t.setData(data.serializeBinary())
    t.setSalt(IdUtil.getUuidV4AsBytes()); // uuid.parse(uuid.v4())
    t.setApitoken(BitUtil.base16ToBytes("AA")); // fake token
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
    s1.setNode('0x1111');
    s1.setRole(1);
    s1.setSig('CC');
    const s2 = new Signer();
    s2.setNode('0x2222');
    s2.setRole(1);
    s2.setSig('EE');

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
  })
})
