import {Inject, Service} from "typedi";
import {Logger} from "winston";
import {WinstonUtil} from "../../utilz/winstonUtil";
import {ValidatorContractState} from "../../services/messaging-common/validatorContractState";
import {ValidatorNode} from "../../services/messaging/validatorNode";
import {ValidatorRandom} from "../../services/messaging/validatorRandom";
import {
  Block,
  InitDid, Signer,
  Transaction,
  TransactionObj, TxAttestorData,
  TxValidatorData
} from "../../generated/block_pb";
import {BitUtil} from "../../utilz/bitUtil";
import DateUtil from "../../utilz/dateUtil";
import IdUtil from "../../utilz/idUtil";
import {HashUtil} from "../../utilz/hashUtil";

console.log(Block);

@Service()
export class ValidatorRpc {
  public log: Logger = WinstonUtil.newLog(ValidatorRpc);

  @Inject()
  private validatorNode: ValidatorNode;

  @Inject()
  private validatorRandom: ValidatorRandom;

  public debug_randomTransaction({ blockDataBase16, txDataBase16 }) {

    // build transaction data (app-dependent)
    const data = new InitDid();
    data.setDid('0xAA');
    data.setMasterpubkey('0xBB');
    data.setDerivedkeyindex(1);
    data.setDerivedpubkey('0xCC');
    data.setEncderivedprivkey('0xDD');
    console.log(JSON.stringify(data.toObject()));

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
    console.log(JSON.stringify(t.toObject()));

    const txAsBytes = t.serializeBinary();
    console.log(`tx as base16 ${BitUtil.bytesToBase16(txAsBytes)}`);
    console.log(`tx hash ${HashUtil.sha256AsBytes(txAsBytes)}`);
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
    console.log(JSON.stringify(b.toObject()));

    const blockAsBytes = b.serializeBinary();
    console.log(`block as base16 ${BitUtil.bytesToBase16(blockAsBytes)}`);
    console.log(`block hash ${HashUtil.sha256AsBytes(blockAsBytes)}`);
  }

  public push_getApiToken([]) {
    const apiToken = this.validatorRandom.createValidatorToken();
    return {
      "apiToken" : apiToken.validatorToken,
      "apiUrl": apiToken.validatorUrl
    } ;
  }

  public push_sendTransaction([ transactionDataBase16 ]) {
    const bytes = BitUtil.base16ToBytes(transactionDataBase16);
    const tx = Transaction.deserializeBinary(bytes);
    // todo process tx, append to block
    console.log(JSON.stringify(tx.toObject()));
    const txHash = "0xAAAA";
    return txHash;
  }

  public push_readBlockQueue([ offsetStr ]) {
    // todo serve data from block queue

    return {
      "items": [
        {
          "id" : "101",
          "object" : "0xAAAA",       // BLOCK in protobuf format
          "object_hash" : "0xBBBBBB" // BLOCK SHA1
        },
        {
          "id" : "102",
          "object" : "0xCC",
          "object_hash" : "0xDD"
        }
      ],
      "lastOffset" : "102"
    }
  }


  public push_readBlockQueueSize([]) {
    // todo return queue state
    return {
      "lastOffset" : "102"
    }
  }

  public push_syncing([]) {
    // todo return queue state
    return {
      "lastPublishedOffset": "1001"
    }
  }

  // todo NETWORK CALLS TO STORAGE NODES
  // todo push_getTransactions
  // todo push_getBlockTransactionCountByHash (1)
  // todo push_getBlockByHash
  // todo push_getTransactionByHash
  // todo push_getTransactionByBlockHashAndIndex
  // todo push_getTransactionCount


  public push_networkId([]) {
    return "1";
  }

  public push_listening([]) {
    return "true";
  }

}