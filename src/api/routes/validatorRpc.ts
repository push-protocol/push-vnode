import {Container, Inject, Service} from "typedi";
import {Logger} from "winston";
import {WinstonUtil} from "../../utilz/winstonUtil";
import {ValidatorNode} from "../../services/messaging/validatorNode";
import {ValidatorRandom} from "../../services/messaging/validatorRandom";
import {BitUtil} from "../../utilz/bitUtil";
import {NumUtil} from "../../utilz/numUtil";
import {QueueManager} from "../../services/messaging/QueueManager";
import {AttestorReply, AttestorReplies, Signer, TxAttestorData} from "../../generated/push/block_pb";

type RpcResult = {
  result: string;
  error: string;
}

@Service()
export class ValidatorRpc {
  public log: Logger = WinstonUtil.newLog(ValidatorRpc);

  @Inject()
  private validatorNode: ValidatorNode;

  @Inject()
  private validatorRandom: ValidatorRandom;

  @Inject()
  private queueManager: QueueManager;

  public push_getApiToken([]) {
    const apiToken = this.validatorRandom.createValidatorToken();
    return {
      "apiToken" : apiToken.validatorToken,
      "apiUrl": apiToken.validatorUrl
    } ;
  }



  public async push_sendTransaction([ transactionDataBase16 ]) {
    let txRaw = BitUtil.base16ToBytes(transactionDataBase16);
    let txHash = await this.validatorNode.sendTransactionBlocking(txRaw);
    return txHash;
  }

  public async push_readBlockQueue([ offsetStr ]) {
    const firstOffset = NumUtil.parseInt(offsetStr, 0);
    let result = await Container.get(QueueManager).readItems("mblock", firstOffset);
    return result;
  }


  public async push_readBlockQueueSize([]) {
    let result = await this.queueManager.getQueueLastOffsetNum("mblock");
    return {
      "lastOffset" : NumUtil.toString(result)
    }
  }

  public push_syncing([]) {
    // todo return queue state
    return {
      "lastPublishedOffset": "1001"
    }
  }

  public async v_attestBlock([ blockDataBase16 ]) {
    let bRaw = BitUtil.base16ToBytes(blockDataBase16);
    let result = await this.validatorNode.attestBlock(bRaw);
    return BitUtil.bytesToBase16(result.serializeBinary());
  }

  public async v_attestSignatures([ blockHashBase16,  attestorRepliesBase16]) {
    let raw = BitUtil.base16ToBytes(attestorRepliesBase16);
    let result = await this.validatorNode.attestBlock(raw);
    return BitUtil.bytesToBase16(result.serializeBinary());
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