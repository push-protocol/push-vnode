import { Check } from '../../utilz/check'
import { ValidatorContractState } from './validatorContractState'
import { Logger } from 'winston'
import { WinstonUtil } from '../../utilz/winstonUtil'
import {PgUtil} from "../../utilz/pgUtil";

export class QueueClientHelper {
  private static log: Logger = WinstonUtil.newLog(QueueClientHelper)

  // updates the dset_client table used for queries according to the contract data
  public static async initClientForEveryQueueForEveryValidator(
    contract: ValidatorContractState,
    queueNames: string[]
  ) {
    Check.notEmptyArr(queueNames, 'queue names missing')
    const allValidators = contract.getAllValidatorsExceptSelf()
    for (const queueName of queueNames) {
      for (const nodeInfo of allValidators) {
        const targetNodeId = nodeInfo.nodeId
        const targetNodeUrl = nodeInfo.url
        const targetState = ValidatorContractState.isEnabled(nodeInfo) ? 1 : 0
        await PgUtil.insert(
          `INSERT INTO dset_client (queue_name, target_node_id, target_node_url, target_offset, state)
           VALUES (?, ?, ?, 0, ?)
           ON DUPLICATE KEY UPDATE target_node_url=?,
                                   state=?`,
          queueName,
          targetNodeId,
          targetNodeUrl,
          targetState,
          targetNodeUrl,
          targetState
        )
        const targetOffset = await PgUtil.queryOneValue<number>(
          `SELECT target_offset
           FROM dset_client
           where queue_name = ?
             and target_node_id = ?`,
          queueName,
          targetNodeId
        )
        this.log.info(
          'client polls (%s) queue: %s node: %s from offset: %d ',
          targetState,
          queueName,
          targetNodeId,
          targetOffset
        )
      }
    }
  }
}
