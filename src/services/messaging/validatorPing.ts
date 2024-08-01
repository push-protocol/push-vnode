import { Inject, Service } from 'typedi'
import { Logger } from 'winston'
import { ValidatorContractState } from '../messaging-common/validatorContractState'
import DateUtil from '../../utilz/dateUtil'
import { ValidatorClient } from './validatorClient'
import schedule from 'node-schedule'
import { PromiseUtil } from '../../utilz/promiseUtil'
import { WinstonUtil } from '../../utilz/winstonUtil'

/**
 * Pings other validators, known from a smart contract
 */
@Service()
export class ValidatorPing {
  public log: Logger = WinstonUtil.newLog(ValidatorPing)

  @Inject((type) => ValidatorContractState)
  private contractState: ValidatorContractState

  // PING: schedule
  private readonly PING_SCHEDULE = '*/30 * * * * *'

  // PING: peer online status
  private pingResult: Map<string, PingReply> = new Map<string, PingReply>()

  public getPingState(): Map<string, PingReply> {
    return this.pingResult
  }

  // PING: serve ping request
  public async ping(): Promise<PingReply> {
    return <PingReply>{
      nodeId: this.contractState.nodeId,
      tsMillis: DateUtil.currentTimeMillis(),
      status: PingStatus.ONLINE
    }
  }

  // PING: ping all known peers
  public async updatePingState() {
    const validators = this.contractState.getActiveValidatorsExceptSelf()
    const promiseList: Promise<PingReply>[] = []
    for (const v of validators) {
      const vc = new ValidatorClient(v.url)
      const promise = vc.ping()
      promiseList.push(promise)
    }
    const prList = await PromiseUtil.allSettled(promiseList)
    for (let i = 0; i < validators.length; i++) {
      const v = validators[i]
      if (this.contractState.nodeId == v.nodeId) {
        continue
      }
      const oldPing = this.pingResult.get(v.nodeId)
      const newPing = prList[i].isSuccess() ? prList[i].val : null
      // handle update
      if (newPing != null) {
        this.pingResult.set(v.nodeId, newPing) // todo we grab timestamp from remote node
      } else {
        this.pingResult.delete(v.nodeId)
      }
    }
    this.log.debug('pingResult: %o', this.pingResult)
  }

  public postConstruct() {
    const validatorRanom = this
    const cronJob = schedule.scheduleJob(this.PING_SCHEDULE, async function () {
      try {
        await validatorRanom.updatePingState()
      } catch (e) {
        console.log(e)
      }
    })
    setTimeout(() => {
      cronJob.invoke()
    }, 3000)
  }
}

export class PingReply {
  nodeId: string
  tsMillis: number
  status: PingStatus
}

export enum PingStatus {
  ONLINE = 1,
  OFFLINE = 0
}
