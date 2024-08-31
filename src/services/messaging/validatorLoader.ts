import { Container } from 'typedi'
import { QueueManager } from './QueueManager'
import { MySqlUtil } from '../../utilz/mySqlUtil'
import { ValidatorNode } from './validatorNode'
import * as dbHelper from '../../helpers/dbHelper'
import {ValidatorRpc} from "../../api/routes/validatorRpc";
import {Check} from "../../utilz/check";

export async function initValidator() {
  // Load validator
  const validatorNode = Container.get(ValidatorNode);
  await validatorNode.postConstruct();

  MySqlUtil.init(dbHelper.pool)

  // Load dset (requires a loaded contract)
  const dset = Container.get(QueueManager)
  await dset.postConstruct();

  const validatorRpc = Container.get(ValidatorRpc);
  Check.notNull(validatorRpc, 'ValidatorRpc is null');
}
