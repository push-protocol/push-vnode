import { Container } from 'typedi'
import { QueueManager } from './QueueManager'
import { MySqlUtil } from '../../utilz/mySqlUtil'
import { ValidatorNode } from './validatorNode'
import * as dbHelper from '../../helpers/dbHelper'

export async function initValidator() {
  // Load validator
  const validatorNode = Container.get(ValidatorNode)
  await validatorNode.postConstruct()

  MySqlUtil.init(dbHelper.pool)

  // Load dset (requires a loaded contract)
  const dset = Container.get(QueueManager)
  await dset.postConstruct()
}
