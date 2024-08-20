import {Inject, Service} from "typedi";
import {Logger} from "winston";
import {WinstonUtil} from "../../utilz/winstonUtil";
import {ValidatorContractState} from "../../services/messaging-common/validatorContractState";
import {ValidatorNode} from "../../services/messaging/validatorNode";

@Service()
export class ValidatorRpc {
  public log: Logger = WinstonUtil.newLog(ValidatorRpc);

  @Inject()
  private validatorNode: ValidatorNode

  public push_getAPIToken([]) {
    // todo return api token

    return {
      "apiToken" : "0xAAAAA",
      "targetNodeUrl": "https://v1.dev.push.org"
    } ;
  }

  public push_sendTransaction([ transactionDataBase16 ]) {
    // todo add to block

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