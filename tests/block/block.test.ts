// noinspection DuplicatedCode

import 'mocha'
import chai, {assert, expect} from 'chai'
import {
  Block, EncryptedText,
  InitDid,
  Signer,
  Transaction,
  TransactionObj,
  TxAttestorData,
  TxValidatorData, WalletToEncDerivedKey
} from "../../src/generated/push/block_pb";
import IdUtil from "../../src/utilz/idUtil";
import {BitUtil} from "../../src/utilz/bitUtil";
import {HashUtil} from "../../src/utilz/hashUtil";
import DateUtil from "../../src/utilz/dateUtil";
import {BlockUtil} from "../../src/services/messaging-common/blockUtil";
import {Wallet} from "ethers";
import fs from "fs";
import {Check} from "../../src/utilz/check";
import * as jspb from "google-protobuf";
import StrUtil from "../../src/utilz/strUtil";
import {NetworkRandom, NodeRandom, ValidatorRandom} from "../../src/services/messaging/validatorRandom";
import {ChainUtil} from "../../src/utilz/chainUtil";
import {RandomUtil} from "../../src/utilz/randomUtil";

const expect = chai.expect;

type WalletInfo = {
  address: string;
  publicKey: string;
  privateKey: string;
};


// test nodes private keys
// DO NOT USE THEM ANYWHERE
let NODE_KEYS: WalletInfo[] = [
  {
    address: '0x8e12dE12C35eABf35b56b04E53C4E468e46727E8',
    publicKey: '0x044c6cc0547e97253814528c616fbb3aa6ebd4a306cf43521a8f9a2ee187d1c3a70adba740eb5592c68f408cf848eb9621985e5c269ec37ad27845a542ae8c6afd',
    privateKey: '0x33fb23f822c5dba0f3cb2796b90d56bb553ebd215726398c93374440b34e510b'
  },
  {
    address: '0xfDAEaf7afCFbb4e4d16DC66bD2039fd6004CFce8',
    publicKey: '0x04f4c9461d8babf5962f48e3ed1f94748247d330eca80dba31986055b6c05c97d13a4f99c4cf3e304ab803f99042978a386ed08f56d68dda59948ea8a70918f157',
    privateKey: '0x16c90855a0dfc9884adf2625a4bffcdbfe760d5ff6756a766d2bbc0bc82318f0'
  },
  {
    address: '0x98F9D910Aef9B3B9A45137af1CA7675eD90a5355',
    publicKey: '0x043b668e94ed022dc14a48a730421b5e6b83fccea79de60d7eb2627743020431be0a6746a885327d5fccd10ccc046659f58e880c4b8009a4e028a42497d1ccd157',
    privateKey: '0xb6c538bac86eb0964b16b7ff6a1ac7d5f0736dcbd0f00bd142ae433dad27f685'
  }
];

// test eth user private keys from hardhat (these are publicly known)
let USER_KEYS: WalletInfo[] = [
  {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    publicKey: null,
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  },
  {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    publicKey: null,
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
  },
  {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    publicKey: null,
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
  }
]

let VALID_VNODES = new Set<string>(NODE_KEYS.map((wallet) => wallet.address));


function getNodeWallet(index: number): Wallet {
  return new Wallet(NODE_KEYS[index].privateKey);
}

function getUserWallet(index: number): Wallet {
  return new Wallet(USER_KEYS[index].privateKey);
}

function printObj(msg: string, obj: any) {
  console.log(msg);
  console.log('%s\n%o', StrUtil.fmtProtoBytes(obj), obj.toObject());
}

async function buildSampleTranaction1() {
  const data = new InitDid();
  data.setMasterpubkey('0xBB');
  data.setDerivedkeyindex(1);
  data.setDerivedpubkey('0xCC');

  let et = new EncryptedText();
  et.setSalt('qaz');
  et.setNonce('');
  et.setVersion('push:v5');
  et.setPrekey('');
  et.setCiphertext('qwe');
  let wa = new WalletToEncDerivedKey();
  wa.setEncderivedprivkey(et);
  wa.setSignature(BitUtil.base16ToBytes("112233"));
  data.getWallettoencderivedkeyMap().set('0xAA', wa);

  const t = new Transaction();
  t.setType(0);
  t.setCategory('INIT_DID');
  t.setSender('eip155:1:' + getUserWallet(0).address);
  t.setRecipientsList(
    ['eip155:1:' + getUserWallet(1).address,
      'eip155:1:' + getUserWallet(2).address]);
  t.setData(data.serializeBinary())
  t.setSalt(BitUtil.base64ToBytes('cdYO7MAPTMisiYeEp+65jw=='));
  const apiToken = 'VT1eyJub2RlcyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3Mjg2NzEyODAwMjMsInJhbmRvbUhleCI6ImFjM2YzNjg5ZGIyMDllYjhmNDViZWEzNDU5MjRkN2ZlYTZjMTlhNmMiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3Mjg2NzEyNTAwMjEsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyODY3MTI1MDAyMSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4MTA0ZmIwNTEzNTJiYTcxYjM4Zjk5M2ZhNDZiY2U2NGM2ZDMyYzBhZDRlZWYxZTgxODVjZjViMDRmYmVjOGM4YTRmMDhmYzg3MzBjZGI4NDcyMmZkYTIxMDU3MzRkOWU5MGNjMzlmZGE0ZjVkMTYxZjljOWFiNGEyMzIxM2RlZGExYyJ9LHsibm9kZUlkIjoiMHg5OEY5RDkxMEFlZjlCM0I5QTQ1MTM3YWYxQ0E3Njc1ZUQ5MGE1MzU1IiwidHNNaWxsaXMiOjE3Mjg2NzEyODAwMjAsInJhbmRvbUhleCI6Ijk5NTAyYmM4MWQyNWE2NjdlODlmYTZkNmY3ZDBjZmUxNzdmODkyZjMiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3Mjg2NzEyNTAwMjIsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweGZEQUVhZjdhZkNGYmI0ZTRkMTZEQzY2YkQyMDM5ZmQ2MDA0Q0ZjZTgiLCJ0c01pbGxpcyI6MTcyODY3MTI1MDAyMSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4MmRiNjY4MTI5NGY0NGVhMzVmYWUxZGRhODhhMTIyZjk1NTBlNjg4MzIwZGY1MzU1MDJmNjQ1N2U2YmYyNmEwYzIzOGVjNDlkNTFhNGM3MTlmODhhYzEzMWFmOGIyZTcxOTdhOWY4MGQzMDAyYThkOTQ4YzM5YTU4NDgzNTYwYzQxYiJ9LHsibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3Mjg2NzEyODAwMjQsInJhbmRvbUhleCI6IjYzYWIxYWU4ZDk0MDNkY2I1NzM4NGZiNzE0NDQyYmIyMmI0NjYxN2UiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3Mjg2NzEyNTAwMjIsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyODY3MTI1MDAyMiwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4M2Q3ZDAxMzdiNGE0MWNlNDczZTljZjBkNDkzZWE4OTM0YWFhZWIxYThiZGFlNzFlMWYyNTM1MDYxZDc2MjAxMTIyMDY5ZTYzOGU3ZTBkMmNiY2U1MmFiN2I3YzZlMTkwYzJlNWEzM2U1YTVkZjg0ZTJmY2ViZjllZDgwODlkMjgxYyJ9XX0=';
  t.setApitoken(BitUtil.stringToBytesUtf(apiToken)); // fake token
  t.setFee("0"); // tbd
  // todo fake signature ; grab real eth wallet here
  await BlockUtil.signGenericTransaction(t, getUserWallet(0));
  return t;
}

describe('validation tests', async function () {
  it('sign tx and check that signature matches the sender', async function () {
      let tx = await buildSampleTranaction1();
      tx.setSignature(null); // no signature

      let wallet = getUserWallet(0);
      tx.setSender('eip155:1:' + wallet.address);
      await BlockUtil.signGenericTransaction(tx, wallet);
      console.log('signed tx %o', tx.toObject());
      console.log('signed tx %o', StrUtil.fmtProtoBytes(tx));
      const check = await BlockUtil.checkGenericTransactionSignature(tx);
      expect(check.success).to.be.equal(true);
    }
  )

  it.skip('check some random tx from UI', async function () {
    let hex = '1208494e49545f4449441a37707573683a6465766e65743a7075736831636a6474617178396463356a307875326174736d6575747235756a6d6d6a6d336c30306766392abb050a423033643734373964383866376532623530316635653630643835643932623866643337383234613230656236666363396135646465343865383539346362383966351080808080081a4230323935346639646361363731616262616337373762353635616261383334363962663333333131346234663239313062626533646137336533303165633463306522aa040a37707573683a6465766e65743a7075736831636a6474617178396463356a307875326174736d6575747235756a6d6d6a6d336c303067663912ee030aa8030afe0139656163396561383533666339646562616530346635373931313865613064393134646365333166643836346635643036643066326337333938396663366366356134353334323139363764316132396336376535633637666461333135323565386165663564393331343835306233623763343461626236336462623330336539653064383532393737333132353339616439376338663435313166643862333433313465376562333937356530663039643832366338663366373939333062633066636535643133643164363636323566356530643837636439363532343539333963356535326265633537356266303661653766616163346264391240323131663561323938646232316434373662356366306532653265386238366533316535646535396266393437373636343564636235643030373162353031351a183230643663323831623261636335313835333331633162302207707573683a76352a4035363831653065333632356366376562343935623630386563313331616639363134633234633934666633303734383230643062643430386534386263313130124120913defe8194febe7522a6601c7f91a37e9ea4c0b0655aa8fc1d3142a125610659ef34b16d74a46f80dd3d0dad607d64f817211968e4cfa2e3069b1bdb3ab5b1b3210eb7beb24173a4b7d8923a1213756ae873abe12553d5ec89befbfbdefbfbd195cc88eefbfbdefbfbdc89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e0e194c4cefbfbd114c4cefbfbdefbfbdefbfbd595050efbfbdefbfbdefbfbd58efbfbd4defbfbdefbfbd0d114d4cefbfbdefbfbd114d0defbfbd194d0defbfbdcc8defbfbd4e08efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0d4c0c0d4c4b08efbfbdefbfbd5befbfbd1befbfbd52195e08efbfbdefbfbdefbfbd4e4d0defbfbd4defbfbd58efbfbdefbfbd18efbfbdefbfbd590cefbfbdcc8cefbfbd0defbfbd18efbfbdefbfbd4d0d0c0d0d4c0c4cefbfbd0dd8994e4defbfbdefbfbdc88b08efbfbd1a5befbfbdd4995cefbfbd5b1d1cc88eefbfbdefbfbdc89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e19efbfbd10515859efbfbdefbfbd59efbfbdd198efbfbdefbfbd194d190c4defbfbd10cd8defbfbdefbfbd0cefbfbd0cefbfbd59efbfbd0defbfbd0c0d10d198efbfbd4e08efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0cefbfbd0c0e0c4b08efbfbdefbfbd185d1d5cc88eefbfbd5f4b1ec89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e0e4e11efbfbd510e4c4c105959efbfbd50efbfbdd08e504d0d4c4cefbfbdefbfbd59efbfbd50efbfbd4dcd8defbfbd59510e4c184d4cefbfbd4d48efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0cefbfbd0c0defbfbdefbfbd08efbfbdefbfbd185d1d5cc88eefbfbd5f574b08efbfbdefbfbd59db985d1d5cefbfbd48efbfbdefbfbdefbfbd1e18efbfbdefbfbd584c0cefbfbd4cefbfbdd98c4cefbfbd0e0dd9990defbfbd4e0defbfbd590d0defbfbd18efbfbd585918efbfbdefbfbd4cefbfbd4e0c4e4d4defbfbd4d58efbfbd19efbfbdefbfbd4d194c59efbfbd0cefbfbd4c0d4c584d18efbfbdefbfbd4c184cefbfbd18efbfbd184c190cefbfbdefbfbd5959efbfbdefbfbd4d59efbfbd4e0c0defbfbdcc98efbfbd0c584cefbfbdefbfbdefbfbdefbfbd18efbfbd18efbfbdd88e194e0d0e19efbfbdefbfbd590d4cefbfbd4cefbfbd4c0e190e0cd88e0cefbfbdefbfbd4e18efbfbd18efbfbd58efbfbdefbfbd4b1ec89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e0e4e11efbfbd510e4c4c105959efbfbd50efbfbdd08e504d0d4c4cefbfbdefbfbd59efbfbd50efbfbd4dcd8defbfbd59510e4c184d4cefbfbd4d48efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0d4c0c0d0defbfbd08efbfbdefbfbd5befbfbd1befbfbd52195e08efbfbdefbfbdefbfbd58efbfbdefbfbdcc8d4e0cefbfbdefbfbdefbfbd0cefbfbd0e4cefbfbd1959584e1958efbfbd59194e4d4dd8984d4c190defbfbd4d0c0dcc8defbfbdefbfbd08efbfbd1a5befbfbdd4995cefbfbd5b1d1cc88eefbfbdefbfbdc89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e0e194c4cefbfbd114c4cefbfbdefbfbdefbfbd595050efbfbdefbfbdefbfbd58efbfbd4defbfbdefbfbd0d114d4cefbfbdefbfbd114d0defbfbd194d0defbfbdcc8defbfbd4e08efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0cefbfbd0c0d0d4b08efbfbdefbfbd185d1d5cc88eefbfbd5f4b1ec89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e19efbfbd10515859efbfbdefbfbd59efbfbdd198efbfbdefbfbd194d190c4defbfbd10cd8defbfbdefbfbd0cefbfbd0cefbfbd59efbfbd0defbfbd0c0d10d198efbfbd4e08efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0cefbfbd0c0d4cefbfbd08efbfbdefbfbd185d1d5cc88eefbfbd5f574b08efbfbdefbfbd59db985d1d5cefbfbd48efbfbdefbfbdefbfbd1e0e0c0d18efbfbd4c0cefbfbdefbfbd4cefbfbd195919efbfbd4defbfbd4c18efbfbd19efbfbdefbfbdefbfbdefbfbd58efbfbdefbfbd5918d98d4dcc8d4e4dd88c0e0c190d19efbfbd184c4cefbfbd59590e4d19efbfbd1958efbfbd0cefbfbd0e4c4e4e0cefbfbd4d4c4e0d5918efbfbd4cefbfbdefbfbd0e58efbfbdefbfbdefbfbd0defbfbd4defbfbd4cefbfbdd89918efbfbd4defbfbd4d1918d898cc99efbfbdefbfbd4e594defbfbdefbfbdefbfbd59efbfbd0c4e0e4d0d0d4cefbfbd4defbfbd58efbfbd0d19efbfbd4defbfbdefbfbdefbfbd58c89f4b1ec89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e19efbfbd10515859efbfbdefbfbd59efbfbdd198efbfbdefbfbd194d190c4defbfbd10cd8defbfbdefbfbd0cefbfbd0cefbfbd59efbfbd0defbfbd0c0d10d198efbfbd4e08efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0d4c0c0d4defbfbd08efbfbdefbfbd5befbfbd1befbfbd52195e08efbfbdefbfbdefbfbd0defbfbd59efbfbdefbfbdefbfbd4d190cefbfbd4d0d0dcc8e0d0d59efbfbd0cefbfbd0e4cefbfbd4e4e58efbfbd19efbfbd18efbfbd4c0defbfbd4defbfbd18efbfbdefbfbdefbfbd08efbfbd1a5befbfbdd4995cefbfbd5b1d1cc88eefbfbdefbfbdc89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e0e194c4cefbfbd114c4cefbfbdefbfbdefbfbd595050efbfbdefbfbdefbfbd58efbfbd4defbfbdefbfbd0d114d4cefbfbdefbfbd114d0defbfbd194d0defbfbdcc8defbfbd4e08efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0d4c0c0d0e0b08efbfbdefbfbd185d1d5cc88eefbfbd5f4b1ec89befbfbdefbfbd19525908efbfbdefbfbdefbfbd1e0e4e11efbfbd510e4c4c105959efbfbd50efbfbdd08e504d0d4c4cefbfbdefbfbd59efbfbd50efbfbd4dcd8defbfbd59510e4c184d4cefbfbd4d48efbfbd08efbfbd1cefbfbd5a5b1b1a5cc88eefbfbd4dcc8e0e4c0c4c0d4c0c0d0cefbfbd08efbfbdefbfbd185d1d5cc88eefbfbd5f574b08efbfbdefbfbd59db985d1d5cefbfbd48efbfbdefbfbdefbfbd1e0e4cefbfbd59efbfbd19efbfbdefbfbd59184defbfbd4c4c4c4d0defbfbdcc8e18efbfbdefbfbdefbfbdefbfbdefbfbdefbfbd0e584c4c4c0c58efbfbd18efbfbdefbfbd584d590d4d0cefbfbdefbfbd0e0d18590c4cefbfbd4cd88d59584cefbfbdefbfbd58cd98efbfbd4defbfbd18efbfbd18efbfbd4cefbfbd0d4dcd8cefbfbd4cefbfbd4e58efbfbd0c0e4e4d0cefbfbdd88c0cefbfbd0d4d58d98d4e4cefbfbd0d18d98defbfbd4c4e0c18efbfbd4defbfbd0cefbfbdefbfbd59efbfbd4defbfbd0c0d590c0e0e59efbfbdefbfbd58efbfbdefbfbd575f42414c53d8d39b7f3db4412fa267faf9ce26cd985f672ffe1d31d7888739f099c6ec53ce69b3d3bff71eb843c773cc99ac32ea9a8c5d3d933b576eca728290b51d3c1b4a0130';
    let tx = Transaction.deserializeBinary(BitUtil.base16ToBytes(hex));
    console.log('signed tx %o', tx.toObject());
    const check = await BlockUtil.checkGenericTransaction(tx);
    console.log(check);
    expect(check.success).to.be.equal(true);
  })
});

describe('block tests', function () {


  it('sample transaction 1', async function () {
    const t = await buildSampleTranaction1();
    let tBlob = t.serializeBinary();

    console.log("\n\n\ntx as base16", BitUtil.bytesToBase16(tBlob));
    console.log("\n\n\ntx as json", JSON.stringify(t.toObject()));
    let parsedT = Transaction.deserializeBinary(tBlob);
    console.log("\n\n\ntx as json (re-parsed)", JSON.stringify(parsedT.toObject()));
    console.log("\n\n\ntx api token as string", StrUtil.fmt(BitUtil.bytesUtfToString(parsedT.getApitoken_asU8())));
    console.log("\n\n\ntx hash", BitUtil.bytesToBase16(HashUtil.sha256AsBytes(tBlob)));

  })

  it('Block Validation Test', async function () {
    // this blob is made by feeding 'sample transaction 1' test case hex into the test net of 3 nodes
    let blockBase16 = "08b19fa0d6a832229f0f41543165794a756232526c6379493657337369626d396b5a556c6b496a6f694d48686d524546465957593359575a44526d4a694e4755305a44453252454d324e6d4a454d6a417a4f575a6b4e6a41774e454e47593255344969776964484e4e6157787361584d694f6a45334d6a67354d4455784f5441774d6a5173496e4a68626d52766255686c65434936496a56684e7a426a4f5755304f5441345954566b4e4449334e6d4d334e6a4d784e6a59345a444d315a5455304d7a4d7a596d5530597a59694c434a776157356e556d567a645778306379493657337369626d396b5a556c6b496a6f694d4867345a5445795a4555784d6b4d7a4e575642516d597a4e5749314e6d49774e4555314d304d30525451324f4755304e6a63794e3055344969776964484e4e6157787361584d694f6a45334d6a67354d4455784e6a63334e544173496e4e3059585231637949364d58307365794a756232526c535751694f69497765446b34526a6c454f5445775157566d4f55497a516a6c424e4455784d7a64685a6a4644515463324e7a566c52446b775954557a4e5455694c434a306330317062477870637949364d5463794f446b774e5445324e7a63314d437769633352686448567a496a6f7866563073496e4e705a323568644856795a534936496a42344d4441334e4451775a44566b4d4441774e5441774d6a646b5a5459785a5449314d7a6b7a4d44677a4e5759334f444a69596a55775954526a593249314d4441785a444e694f446b775a6a6c6a5a6a63794f546b77597a4e684d446b774d47466b4f444e6c4d6d59324f546b344d3259314e6a4a6d4e6a6c684e6d4e694d544a695a4759304e7a51354d7a686d4e7a4d354e6a45794d6a4d344f5756694d6a4a6b4e6a59355932566c5a47497859794a394c487369626d396b5a556c6b496a6f694d4867354f45593552446b784d45466c5a6a6c434d304935515451314d544d3359575978513045334e6a63315a5551354d4745314d7a55314969776964484e4e6157787361584d694f6a45334d6a67354d4455784f5441774d6a4173496e4a68626d52766255686c65434936496a566b4e474d304e445269597a59794e54646c5a444930597a67345a4755354e7a63774d7a45314f5441334f5445304e3252694f5751694c434a776157356e556d567a645778306379493657337369626d396b5a556c6b496a6f694d4867345a5445795a4555784d6b4d7a4e575642516d597a4e5749314e6d49774e4555314d304d30525451324f4755304e6a63794e3055344969776964484e4e6157787361584d694f6a45334d6a67354d4455784e6a63334e446773496e4e3059585231637949364d58307365794a756232526c535751694f69497765475a45515556685a6a64685a6b4e47596d49305a54526b4d545a45517a5932596b51794d444d355a6d51324d44413051305a6a5a5467694c434a306330317062477870637949364d5463794f446b774e5445324e7a63304e797769633352686448567a496a6f7866563073496e4e705a323568644856795a534936496a42344e574a684e5463334f4749774d4451324d7a466a4d4445355a5442684f44497a4e4459785a4463335954466d4d7a49344d574a694d324d794e544578595441354d6a6b335a6a646c4e444268595451335a4449334f4451324d54686a4e545a69595464685a6d5933596d5178595755314d4449305a446c6a5a445a6d4e6a5a6d4d4759794e7a49344e7a45774f474d794d574577596a55314f574d7a4e5459794e7a67304e5755304e47557859694a394c487369626d396b5a556c6b496a6f694d4867345a5445795a4555784d6b4d7a4e575642516d597a4e5749314e6d49774e4555314d304d30525451324f4755304e6a63794e3055344969776964484e4e6157787361584d694f6a45334d6a67354d4455784f5441774d7a4573496e4a68626d52766255686c65434936496a67794e6a55314d474a6a4d6a45775a446b7a5a6a67304e6d49325a546c6d597a4d344e6a55344f5452684e4755304e6d51354d5451694c434a776157356e556d567a645778306379493657337369626d396b5a556c6b496a6f694d48686d524546465957593359575a44526d4a694e4755305a44453252454d324e6d4a454d6a417a4f575a6b4e6a41774e454e47593255344969776964484e4e6157787361584d694f6a45334d6a67354d4455784e6a63334e446b73496e4e3059585231637949364d58307365794a756232526c535751694f69497765446b34526a6c454f5445775157566d4f55497a516a6c424e4455784d7a64685a6a4644515463324e7a566c52446b775954557a4e5455694c434a306330317062477870637949364d5463794f446b774e5445324e7a63314e697769633352686448567a496a6f7866563073496e4e705a323568644856795a534936496a4234597a6b7a5a6d59785a6a4d324d4445335a4759784f544a6b595755795a5749334f4749354e7a5a6c4d5745774f4755344d6d4d7859575a6a5a6d557a4d4759334f5441344d5468694d44677a4d7a67305a5752684e5455354d544d355a6d4d78596a41305a6a4e6a4f4459334e546b314e7a4577596a59774f57566c593245344f44426c4f5463784e6a49354d7a55304f544a6c4d6a426c4e4759314f44426b4f4468685a574d304d54597859694a395858303d12e6110ad7111208494e49545f4449441a336569703135353a313a30786633394664366535316161643838463646346365366142383832373237396366664662393232363622336569703135353a313a30783730393937393730433531383132646333413031304337643031623530653064313764633739433822336569703135353a313a3078334334344364446442366139303066613262353835646432393965303364313246413432393342432a320a043078424210011a043078434322220a0430784141121a0a130a03717765120371617a2207707573683a76351203112233321071d60eecc00f4cc8ac898784a7eeb98f3a9f0f56543165794a756232526c6379493657337369626d396b5a556c6b496a6f694d48686d524546465957593359575a44526d4a694e4755305a44453252454d324e6d4a454d6a417a4f575a6b4e6a41774e454e47593255344969776964484e4e6157787361584d694f6a45334d6a67324e7a45794f4441774d6a4d73496e4a68626d52766255686c65434936496d466a4d32597a4e6a67355a4749794d446c6c596a686d4e4456695a57457a4e4455354d6a526b4e325a6c59545a6a4d546c684e6d4d694c434a776157356e556d567a645778306379493657337369626d396b5a556c6b496a6f694d4867345a5445795a4555784d6b4d7a4e575642516d597a4e5749314e6d49774e4555314d304d30525451324f4755304e6a63794e3055344969776964484e4e6157787361584d694f6a45334d6a67324e7a45794e5441774d6a4573496e4e3059585231637949364d58307365794a756232526c535751694f69497765446b34526a6c454f5445775157566d4f55497a516a6c424e4455784d7a64685a6a4644515463324e7a566c52446b775954557a4e5455694c434a306330317062477870637949364d5463794f4459334d5449314d4441794d537769633352686448567a496a6f7866563073496e4e705a323568644856795a534936496a42344d5441305a6d49774e54457a4e544a6959546378596a4d345a6a6b354d325a684e445a69593255324e474d325a444d79597a42685a44526c5a5759785a5467784f44566a5a6a56694d44526d596d566a4f474d345954526d4d44686d597a67334d7a426a5a4749344e4463794d6d5a6b595449784d4455334d7a526b4f5755354d474e6a4d7a6c6d5a4745305a6a566b4d5459785a6a6c6a4f5746694e4745794d7a49784d32526c5a47457859794a394c487369626d396b5a556c6b496a6f694d4867354f45593552446b784d45466c5a6a6c434d304935515451314d544d3359575978513045334e6a63315a5551354d4745314d7a55314969776964484e4e6157787361584d694f6a45334d6a67324e7a45794f4441774d6a4173496e4a68626d52766255686c65434936496a6b354e544179596d4d344d5751794e5745324e6a646c4f446c6d59545a6b4e6d59335a44426a5a6d55784e7a646d4f446b795a6a4d694c434a776157356e556d567a645778306379493657337369626d396b5a556c6b496a6f694d4867345a5445795a4555784d6b4d7a4e575642516d597a4e5749314e6d49774e4555314d304d30525451324f4755304e6a63794e3055344969776964484e4e6157787361584d694f6a45334d6a67324e7a45794e5441774d6a4973496e4e3059585231637949364d58307365794a756232526c535751694f69497765475a45515556685a6a64685a6b4e47596d49305a54526b4d545a45517a5932596b51794d444d355a6d51324d44413051305a6a5a5467694c434a306330317062477870637949364d5463794f4459334d5449314d4441794d537769633352686448567a496a6f7866563073496e4e705a323568644856795a534936496a42344d6d52694e6a59344d5449354e4759304e4756684d7a566d595755785a4752684f4468684d5449795a6a6b314e54426c4e6a67344d7a49775a4759314d7a55314d444a6d4e6a51314e325532596d59794e6d4577597a497a4f47566a4e446c6b4e5446684e474d334d546c6d4f446868597a457a4d57466d4f4749795a5463784f5464684f5759344d47517a4d4441795954686b4f545134597a4d35595455344e44677a4e545977597a517859694a394c487369626d396b5a556c6b496a6f694d4867345a5445795a4555784d6b4d7a4e575642516d597a4e5749314e6d49774e4555314d304d30525451324f4755304e6a63794e3055344969776964484e4e6157787361584d694f6a45334d6a67324e7a45794f4441774d6a5173496e4a68626d52766255686c65434936496a597a59574978595755345a446b304d444e6b593249314e7a4d344e475a694e7a45304e445179596d49794d6d49304e6a59784e3255694c434a776157356e556d567a645778306379493657337369626d396b5a556c6b496a6f694d48686d524546465957593359575a44526d4a694e4755305a44453252454d324e6d4a454d6a417a4f575a6b4e6a41774e454e47593255344969776964484e4e6157787361584d694f6a45334d6a67324e7a45794e5441774d6a4973496e4e3059585231637949364d58307365794a756232526c535751694f69497765446b34526a6c454f5445775157566d4f55497a516a6c424e4455784d7a64685a6a4644515463324e7a566c52446b775954557a4e5455694c434a306330317062477870637949364d5463794f4459334d5449314d4441794d697769633352686448567a496a6f7866563073496e4e705a323568644856795a534936496a42344d3251335a4441784d7a64694e4745304d574e6c4e44637a5a546c6a5a6a426b4e446b7a5a5745344f544d30595746685a574978595468695a47466c4e7a466c4d5759794e544d314d4459785a4463324d6a41784d5449794d4459355a54597a4f4755335a54426b4d6d4e69593255314d6d46694e324933597a5a6c4d546b77597a4a6c4e57457a4d3255315954566b5a6a67305a544a6d593256695a6a6c6c5a4467774f446c6b4d6a677859794a395858303d42419d15e53d0e2c03f840553f65a6a09a44912213ff3145b4f5140e8ca8b6f643b7674379a22d64b2ced6b9acfa775fd1195c34b3d072e47a73077c9913a07809a51c4a0130120208011a0208011a0208011a430a419a59cd76f60b2c16c6827d7e781a83f542e0595e5f87932a96f11fe43a87eda301fd1a999fc93cc2eab2a99568a24ce4de6cc66157c06e83d2ae292c616bf6881b1a430a41b15524f76d88cd1232844930d58aa795064e86958ce982ac1f45c08f3370bf424cd84f99824f142a295f48db1af3ff39d58478dd8424871c1a8642c7692c121c1c1a430a410aec63308d6429848ed05bcb3c29e2beb871dd2df25b4a54088e27baa7a73fd26588847ff558611f9a3e4b768a535cd2741d11c9b9881eb9b7f48170afa4fe791b";

    // parse a pre-computed block
    // the only option is this code will pass the test = when everything is done the same way as in the backend logic
    // this is why this piece makes sense

    let oldBlock = Block.deserializeBinary(BitUtil.base16ToBytes(blockBase16));
    printObj('parsed Block', oldBlock);
    console.log('block is %o', oldBlock.toObject());
    BlockUtil.ATTESTOR_MAX_BLOCK_AGE_SECONDS = 0;
    let check1 = await BlockUtil.checkBlockFinalized(oldBlock, VALID_VNODES, 3);

    console.log(check1);
    expect(check1.success).to.be.equal(true, check1.err);
    let oldBlockBytes = oldBlock.serializeBinary();
    const oldTx1 = oldBlock.getTxobjList()[0].getTx();
    let oldTxBytes = oldTx1.serializeBinary();
    let oldTxDataBytes = oldTx1.getData_asU8();
    let initDidParsed = InitDid.deserializeBinary(oldTxDataBytes);
    printObj('parsed InitDid', initDidParsed);

    // now build the same block manually + Compare

    // build transaction data ------------------------------------

    let t = await buildSampleTranaction1();

    printObj('new Transaction', t);
    printObj('old Transaction', oldTx1);
    expect(oldTxBytes).to.deep.equal(t.serializeBinary());

    {
      const to1 = new TransactionObj();
      to1.setTx(t);
      const vd1 = new TxValidatorData();
      vd1.setVote(1);

      // block (BE VERY CAREFUL WITH THIS TEST)
      const block1 = new Block();
      // NOTE: comes from BLOB to be bit-equal
      block1.setTs(oldBlock.getTs());
      block1.setTxobjList([to1]);
      // NOTE: comes from BLOB to be bit-equal
      block1.setAttesttoken(oldBlock.getAttesttoken());

      const w0 = getNodeWallet(0);
      const w1 = getNodeWallet(1);
      const w2 = getNodeWallet(2);

      {
        // deep random reparse and re-construct (prob. to be removed)
        const attToken = BitUtil.bytesUtfToString(oldBlock.getAttesttoken_asU8()).substring(ValidatorRandom.VAL_TOKEN_PREFIX.length);
        console.log('attToken %s', attToken);
        const networkRandom = NetworkRandom.read(attToken);
        console.log('networkRandom', networkRandom);
        const w0random = networkRandom.nodes.find(value => value.nodeId === w0.address).randomHex;
        const w1random = networkRandom.nodes.find(value => value.nodeId === w1.address).randomHex;
        const w2random = networkRandom.nodes.find(value => value.nodeId === w2.address).randomHex;

        const validationVector = ValidatorRandom.calculateValidationVector(
          [w0.address, w1.address, w2.address],
          new Map([
            [w0.address, w0random],
            [w1.address, w1random],
            [w2.address, w2random]]),
          2,
          'attest',
          [w0.address]
        );
        console.log('validationVector %s', validationVector);

        expect(w1.address).to.deep.equal(validationVector[0], 'w1 is the first attestor');
        expect(w2.address).to.deep.equal(validationVector[1], 'w2 is the second attestor');
      }

      await BlockUtil.signBlockAsValidator(w0, block1);

      let patch1 = await BlockUtil.signBlockAsAttestor(w1, block1);
      let patch2 = await BlockUtil.signBlockAsAttestor(w2, block1);

      let addr1 = await BlockUtil.recoverPatchAddress(w0, block1, patch1);
      expect(addr1).to.equal(w1.address);

      let addr2 = await BlockUtil.recoverPatchAddress(w0, block1, patch2);
      expect(addr2).to.equal(w2.address);

      await BlockUtil.appendPatchAsValidator(w0, block1, patch1);
      await BlockUtil.appendPatchAsValidator(w0, block1, patch2); // NODE 2 goes 1st because my sample blob has this

      expect(await BlockUtil.recoverSignerAddress(block1, 0)).to.be.equal(w0.address);
      expect(await BlockUtil.recoverSignerAddress(block1, 1)).to.be.equal(w1.address); // NODE 2 goes 1st because my sample blob has this
      expect(await BlockUtil.recoverSignerAddress(block1, 2)).to.be.equal(w2.address);

      printObj('new Block', block1);
      printObj('old Block', oldBlock);
      expect(oldBlockBytes).to.deep.equal(block1.serializeBinary());
    }

  });

  it('reparse1', async function () {
    let txRaw = BitUtil.base16ToBytes("1208494e49545f4449441a336569703135353a313a30783335423834643638343844313634313531373763363444363435303436363362393938413661623422336569703135353a313a30783335423834643638343844313634313531373763363444363435303436363362393938413661623422346569703135353a39373a3078443836333443333942424664343033336330643332383943343531353237353130323432333638312a670a0f6469643a6578616d706c653a313233120e6d61737465725f7075625f6b6579220f646572697665645f7075625f6b657932330a177075736831303232326e333233326d7764656963656a331218737472696e6769666965645f656e637279707465645f706b321071d60eecc00f4cc8ac898784a7eeb98f3ab40b7b226e6f646573223a5b7b226e6f64654964223a22307838653132644531324333356541426633356235366230344535334334453436386534363732374538222c2274734d696c6c6973223a313732363134383637303032342c2272616e646f6d486578223a2262323637636131656661626366386264323063623763616336356330633534323865656664663338222c2270696e67526573756c7473223a5b7b226e6f64654964223a22307866444145616637616643466262346534643136444336366244323033396664363030344346636538222c2274734d696c6c6973223a313732363134383637303032302c22737461747573223a317d2c7b226e6f64654964223a22307839384639443931304165663942334239413435313337616631434137363735654439306135333535222c2274734d696c6c6973223a313732363134383637303031362c22737461747573223a317d5d2c227369676e6174757265223a22307834366331643237316663383637343435393138356132616265636637373736323961303133373066343366303766343965623431363235616565656631643033356431396664326164326437323232373162343166336536636231653735303338343730366162383336363437363837653539346362636462636632316165663162227d2c7b226e6f64654964223a22307839384639443931304165663942334239413435313337616631434137363735654439306135333535222c2274734d696c6c6973223a313732363134383637303032392c2272616e646f6d486578223a2263316662333961383232623964383261643264373437333230626165383634303634386632356137222c2270696e67526573756c7473223a5b7b226e6f64654964223a22307838653132644531324333356541426633356235366230344535334334453436386534363732374538222c2274734d696c6c6973223a313732363134383637303031372c22737461747573223a317d2c7b226e6f64654964223a22307866444145616637616643466262346534643136444336366244323033396664363030344346636538222c2274734d696c6c6973223a313732363134383637303032342c22737461747573223a317d5d2c227369676e6174757265223a22307866663737366563393736306235646134373238323130333862646631646363656162333130666531323030376262336634336636346236343535303264663466333733323234333066653333366535313661356336613734363038353465343033306235363334343633646338613064613135386131623063373861323630653162227d2c7b226e6f64654964223a22307866444145616637616643466262346534643136444336366244323033396664363030344346636538222c2274734d696c6c6973223a313732363134383637303033352c2272616e646f6d486578223a2262393331656334316233393763623164656234396536353764396437623739383764316361373530222c2270696e67526573756c7473223a5b7b226e6f64654964223a22307838653132644531324333356541426633356235366230344535334334453436386534363732374538222c2274734d696c6c6973223a313732363134383637303031352c22737461747573223a317d2c7b226e6f64654964223a22307839384639443931304165663942334239413435313337616631434137363735654439306135333535222c2274734d696c6c6973223a313732363134383637303032352c22737461747573223a317d5d2c227369676e6174757265223a22307837633964343832396336616161363535396465643833323433623665386438623665623333366439303932613261306466323533316463336364396532623335353735626462386261313134323263326663346262363737653064396365356266343464353466653538373266396530373661633339643530316237343934333163227d5d7d42412592af30c62ac73025e37826d60a250e7c4f44c3697d2868307255bcff52a4b61e9a3fa015761ebd89b3d9d1ce3e4a7ad4691c5259e56f8be2e79a486a1eb01b1b4a0130")
    const tx = BlockUtil.parseTransaction(txRaw);
    let txRaw2 = tx.serializeBinary();

    console.log('txRaw: %s', BitUtil.bytesToBase16(txRaw));
    console.log('txRaw2: %s', BitUtil.bytesToBase16(txRaw2));
    console.log('equals: ', BitUtil.bytesToBase16(txRaw) === BitUtil.bytesToBase16(txRaw2));
    console.log('processing tx: %o', tx.toObject());
    console.log('tx hash raw %s', BlockUtil.hashTransactionAsHex(txRaw));

    console.log('tx hash after reparse %s', BlockUtil.hashTransactionAsHex(txRaw2));
    console.log('reparsed tx: %o', Transaction.deserializeBinary(txRaw).toObject());
  });


  it('check 2 types of bytes in tx', async function () {
    const t = new Transaction();
    t.setType(0);
    t.setCategory('INIT_DID');
    t.setSender('eip155:1:0xAA');
    t.setRecipientsList(['eip155:1:0xBB', 'eip155:1:0xCC']);
    t.setData(new Uint8Array());
    t.setSalt(IdUtil.getUuidV4AsBytes()); // uuid.parse(uuid.v4())

    t.setFee("1"); // tbd
    t.setSignature(BitUtil.base16ToBytes("EE")); // fake signature
    console.log("-".repeat(40));
    console.log("tx as json", JSON.stringify(t.toObject()));


    let token = "eyJub2RlcyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMzAsInJhbmRvbUhleCI6ImY3YmY3YmYwM2ZlYTBhNzI1MTU2OWUwNWRlNjU2ODJkYjU1OTU1N2UiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjAsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyNDY3MzI0MDAxOSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4YjMzM2NjMWI3MWM0NGM0MDhkOTZiN2JmYjYzODU0OTNjZjE2N2NiMmJkMjU1MjdkNzg2ZDM4ZjdiOTgwZWFkMzAxMmY3NmNhNzhlM2FiMWEzN2U2YTFjY2ZkMjBiNjkzZGVmZDAwOWM4NzExY2ZjODlmMDUyYjM5MzY4ZjFjZTgxYiJ9LHsibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjUsInJhbmRvbUhleCI6IjkyMTY4NzRkZjBlMTQ4NTk3ZjlkNDRkMGRmZmFlZGU5NTg0NGRkMTciLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyMjQ2NTAsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyNDY3MzIyNDY1NSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4N2JmYzQ0MjQ0ZGM0MTdhMjg0YzEwODUwZGEzNTE2YzUwNWEwNjJmYjIyYmI1ODU0ODg2YWEyOTk3OWUwMmYxOTdlZWMyYzk2ZDVkOTQ4ZDBhMWQ2NTBlYzIzNGRhMDVjMGY5M2JlNWUyMDkxNjFlYzJjY2JjMWU5YzllNzQyOGIxYiJ9LHsibm9kZUlkIjoiMHg5OEY5RDkxMEFlZjlCM0I5QTQ1MTM3YWYxQ0E3Njc1ZUQ5MGE1MzU1IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjQsInJhbmRvbUhleCI6IjBkOWExNmE4OTljYWQwZWZjODgzZjM0NWQwZjgwYjdmYTE1YTY1NmYiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyMjY5NDMsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweGZEQUVhZjdhZkNGYmI0ZTRkMTZEQzY2YkQyMDM5ZmQ2MDA0Q0ZjZTgiLCJ0c01pbGxpcyI6MTcyNDY3MzIyNjk0Nywic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4YmE2Mjk2OTZlZWU4MDQ4ZDE2OTA3MDNhZmVjYWY4ZmJjM2Y4NDMxOWQ0OTFhZGIzY2YzZGYzMzExMTllMDAyOTA1MTc3MjAyNzkxNzEzNTMzMmU0MGZiMzI2OTM5Y2JhN2Y2NDc2NmYyYjY5MzQwZTZlNGYwZmIzNjM2OThmYzkxYiJ9XX0=";
    t.setApitoken(token);

    // A have a sting in base64, you want to set(Uint8Array)

    let txAsBytes = t.serializeBinary();
    console.log("tx as base16", BitUtil.bytesToBase16(txAsBytes));
    console.log("tx hash", BitUtil.bytesToBase16(HashUtil.sha256AsBytes(txAsBytes)));

    t.setApitoken(BitUtil.base64ToBytes(token));
    let txAsBytes2 = t.serializeBinary();
    console.log("tx as base16", BitUtil.bytesToBase16(txAsBytes2));
    console.log("tx hash", BitUtil.bytesToBase16(HashUtil.sha256AsBytes(txAsBytes2)));

  })


  it('create transaction and block, serialize/deserialize', async function () {
    console.log("building ------------------------- ");
    // build transaction data (app-dependent)
    const data = new InitDid();
    data.setMasterpubkey('0xBB');
    data.setDerivedkeyindex(1);
    data.setDerivedpubkey('0xCC');
    console.log("data as json", JSON.stringify(data.toObject()));

    // build transaction
    const t = new Transaction();
    t.setType(0);
    t.setCategory('INIT_DID');
    t.setSender('eip155:1:0xAA');
    t.setRecipientsList(['eip155:1:0xBB', 'eip155:1:0xCC']);
    t.setData(data.serializeBinary())
    t.setSalt(IdUtil.getUuidV4AsBytes()); // uuid.parse(uuid.v4())
    let token = "eyJub2RlcyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMzAsInJhbmRvbUhleCI6ImY3YmY3YmYwM2ZlYTBhNzI1MTU2OWUwNWRlNjU2ODJkYjU1OTU1N2UiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjAsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyNDY3MzI0MDAxOSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4YjMzM2NjMWI3MWM0NGM0MDhkOTZiN2JmYjYzODU0OTNjZjE2N2NiMmJkMjU1MjdkNzg2ZDM4ZjdiOTgwZWFkMzAxMmY3NmNhNzhlM2FiMWEzN2U2YTFjY2ZkMjBiNjkzZGVmZDAwOWM4NzExY2ZjODlmMDUyYjM5MzY4ZjFjZTgxYiJ9LHsibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjUsInJhbmRvbUhleCI6IjkyMTY4NzRkZjBlMTQ4NTk3ZjlkNDRkMGRmZmFlZGU5NTg0NGRkMTciLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyMjQ2NTAsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyNDY3MzIyNDY1NSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4N2JmYzQ0MjQ0ZGM0MTdhMjg0YzEwODUwZGEzNTE2YzUwNWEwNjJmYjIyYmI1ODU0ODg2YWEyOTk3OWUwMmYxOTdlZWMyYzk2ZDVkOTQ4ZDBhMWQ2NTBlYzIzNGRhMDVjMGY5M2JlNWUyMDkxNjFlYzJjY2JjMWU5YzllNzQyOGIxYiJ9LHsibm9kZUlkIjoiMHg5OEY5RDkxMEFlZjlCM0I5QTQ1MTM3YWYxQ0E3Njc1ZUQ5MGE1MzU1IiwidHNNaWxsaXMiOjE3MjQ2NzMyNDAwMjQsInJhbmRvbUhleCI6IjBkOWExNmE4OTljYWQwZWZjODgzZjM0NWQwZjgwYjdmYTE1YTY1NmYiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjQ2NzMyMjY5NDMsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweGZEQUVhZjdhZkNGYmI0ZTRkMTZEQzY2YkQyMDM5ZmQ2MDA0Q0ZjZTgiLCJ0c01pbGxpcyI6MTcyNDY3MzIyNjk0Nywic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4YmE2Mjk2OTZlZWU4MDQ4ZDE2OTA3MDNhZmVjYWY4ZmJjM2Y4NDMxOWQ0OTFhZGIzY2YzZGYzMzExMTllMDAyOTA1MTc3MjAyNzkxNzEzNTMzMmU0MGZiMzI2OTM5Y2JhN2Y2NDc2NmYyYjY5MzQwZTZlNGYwZmIzNjM2OThmYzkxYiJ9XX0=";
    t.setApitoken(BitUtil.base64ToBytes(token)); // fake token


    // A have a sting in base64, you want to set(Uint8Array)

    t.setFee("1"); // tbd
    t.setSignature(BitUtil.base16ToBytes("EE")); // fake signature
    console.log("-".repeat(40));
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


// for printing the wallet info
async function loadWalletInfos(): Promise<WalletInfo[]> {
  const walletFiles = [
    {name: 'v1', filePath: 'docker/v1/validator_eth_key.json', password: 'test'},
    {name: 'v2', filePath: 'docker/v2/validator_eth_key.json', password: 'test'},
    {name: 'v3', filePath: 'docker/v3/validator_eth_key.json', password: 'test'},
  ];

  const walletInfos: WalletInfo[] = await Promise.all(
    walletFiles.map(async ({filePath, password}) => {
      const json = fs.readFileSync(filePath, 'utf8');
      const wallet = await Wallet.fromEncryptedJson(json, password);
      return {
        address: wallet.address,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
      };
    })
  );
  return walletInfos;
}


describe('sharding tests', function () {
  it('calculate shard', async function () {

    let sample = [
      'eip155:1:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb',
      'eip155:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb',
      'bip122:000000000019d6689c085ae165831e93:128Lkh3S7CkDTBZ8W7BbpsN3YYizJMp8p6',
      'cosmos:cosmoshub-3:cosmos1t2uflqwqe0fsj0shcfkrvpukewcw40yjj6hdc0',
      'polkadot:b0a8d493285c2df73290dfb7e61f870f:5hmuyxw9xdgbpptgypokw4thfyoe3ryenebr381z9iaegmfy',
      'starknet:SN_GOERLI:0x02dd1b492765c064eac4039e3841aa5f382773b598097a40073bd8b48170ab57',
      'hedera:mainnet:0.0.1234567890-zbhlt'
    ];

    let newSize = 200;
    let addrs = [];
    for (let i = 0; i < newSize; i++) {
      const randomIndex = RandomUtil.getRandomInt(0, sample.length);
      addrs.push(sample[randomIndex]);
    }

    const MAX_SHARDS = 64;
    for (let shardCount = 1; shardCount < MAX_SHARDS; shardCount++) {


      /*
      Map checks for this case
        shard1 -> 5 addresses
        shard2 -> 3 addresses
        shard0 -> 0 addresses (bad!)
       */
      let shardToNumOfAddresses: Map<number, number> = new Map();
      for (const a of addrs) {
        let shardId = BlockUtil.calculateAffectedShard(a, shardCount);
        // console.log('shardId: %s -> %s', a, shardId);
        assert.isTrue(shardId != null && shardId >= 0);
        assert.isTrue(shardId < shardCount);

        let oldCounter = shardToNumOfAddresses.get(shardId);
        if (oldCounter == null) {
          shardToNumOfAddresses.set(shardId, 1);
        } else {
          shardToNumOfAddresses.set(shardId, ++oldCounter);
        }
      }
      if (shardCount > 4) {
        let minSize = 100000000000;
        let maxSize = 0;
        for (const [shardId, count] of shardToNumOfAddresses) {
          console.log('shardId: %s has %s addresses', shardId, count);
          minSize = Math.min(minSize, count);
          maxSize = Math.max(maxSize, count);
        }
        const delta = maxSize - minSize;
        const maxDelta = addrs.length / 4;
      }
    }

  })
});
