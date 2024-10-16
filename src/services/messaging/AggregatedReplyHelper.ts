import crypto from 'crypto'
import { Logger } from 'winston'
import { WinstonUtil } from '../../utilz/winstonUtil'
import { StringCounter } from '../../utilz/stringCounter'

export enum NodeHttpStatus {
  REPLY_TIMEOUT = 0
}
const log: Logger = WinstonUtil.newLog('AggregatedReplyHelper');
// todo move tests from another repo
export class AggregatedReplyHelper {
  // initial request
  aggrReq: AggregatedRequest
  // replies
  // nodeIds -> httpCode
  mapNodeToStatus: Map<string, number> = new Map<string, number>()
  // nodeIds item lists, reverted in a map
  // skey -> nodeId -> item
  mapKeyToNodeItems: Map<string, Map<string, StorageRecord>> = new Map<
    string,
    Map<string, StorageRecord>
  >()

  // add each node reply which contains [item, item, item]
  public appendItems(nodeId: string, nodeHttpStatus: number, httpReplyData: any) {
    this.mapNodeToStatus.set(nodeId, nodeHttpStatus)
    if (httpReplyData?.items?.length > 0) {
      for (const srcItem of httpReplyData.items) {
        this.doAppendItem(nodeId, srcItem)
      }
    }
  }

  private doAppendItem(nodeId: string, storageRecord: StorageRecord) {
    const salt = storageRecord.salt;
    let map2 = this.mapKeyToNodeItems.get(salt)
    if (map2 == null) {
      map2 = new Map<string, StorageRecord>()
      this.mapKeyToNodeItems.set(salt, map2)
    }
    const dstItem = new StorageRecord(
      storageRecord.cat,
      salt,
      storageRecord.ts,
      storageRecord.payload
    )
    map2.set(nodeId, dstItem)
  }

  private isEnoughReplies(requiredReplies: number): boolean {
    let goodReplies = 200
    for (const [key, value] of this.mapNodeToStatus) {
      if (value == 200 || value == 204) {
        goodReplies++
      }
    }
    if (goodReplies > requiredReplies) {
      return true
    }
  }

  public aggregateItems(minQuorumThreshold: number): AggregatedReply {
    console.log(`aggregateItems()`)
    const reply = new AggregatedReply()
    // if we have this amount of SAME replies for a key => we have this key
    const nodeCount = this.mapNodeToStatus.size
    console.log(`quorumForKey=${minQuorumThreshold} nodeCount=${nodeCount}`)
    const keysWithoutQuorumSet = new Set<string>()
    let goodReplies = 0
    let lastTsStr = '0'
    for (const [nodeId, code] of this.mapNodeToStatus) {
      if (code >= 200 && code < 300) {
        goodReplies++
      }
    }
    for (const [skey, mapNodeIdToStorageRecord] of this.mapKeyToNodeItems) {
      console.log(`checking skey: ${skey}`)

      // let's figure out quorum for this skey, we have replies from every node
      // sc: hash(StorageRecord) -> count, [storageRecord1, .., storageRecordN]
      // our goal is to grab top used hashes with frequency > quorum
      const sc = new StringCounter<StorageRecord>()

      for (const [nodeId, code] of this.mapNodeToStatus) {
        if (code == 200) {
          const record = mapNodeIdToStorageRecord.get(nodeId)
          const recordKey = record?.salt
          const recordHash = record == null ? 'null' : record.computeMd5Hash()
          console.log(
            `nodeId=${nodeId} recordKey=${recordKey}, recordHash=${recordHash}, record=${JSON.stringify(
              record
            )}`
          )
          if (recordKey != null) {
            sc.increment(recordHash, record)
          }
        }
      }
      sc.iterateAndSort(false, (index, key, count, incrementArr) => {
        if (index == 0) {
          // todo equalObjectCount = ?
          // top result
          if (count >= minQuorumThreshold) {
            // we have enough items from nodes, that we can conclude this item as useful
            // we're guaranteed here that
            // 1. all incrementArr StorageRecords are equal (MD5 verified)
            // 2. we have at least 1 item
            // so we can grab the first one reply , since all are the same
            const first = incrementArr[0]
            reply.items.push(first)
            // lastTs = latest item ; we use string to preserve equality for all type of hashes
            // TODO a good discussion is required to figure out the best way to transfer high precision timestamps via rest
            if (first.ts != null) {
              if (Number.parseFloat(first.ts) > Number.parseFloat(lastTsStr)) {
                lastTsStr = first.ts
              }
            }
          } else {
            // top item has not enough copies on the network
            AggregatedReplyHelper.copyNonNullKeysTo(incrementArr, keysWithoutQuorumSet)
          }
        } else {
          AggregatedReplyHelper.copyNonNullKeysTo(incrementArr, keysWithoutQuorumSet)
        }
      })
    }
    console.log(`non200Replies=${goodReplies}`)
    const r = reply.result
    if (goodReplies < minQuorumThreshold) {
      // not enough nodes replies => we can't do anything
      r.quorumResult = QuorumResult.QUORUM_FAILED_NODE_REPLIES
    } else {
      // we have node replies
      if (reply.items.length == 0) {
        // we have no good keys
        r.quorumResult =
          keysWithoutQuorumSet.size > 0
            ? QuorumResult.QUORUM_FAILED_BY_MIN_ITEMS
            : QuorumResult.QUORUM_OK
      } else if (reply.items.length > 0) {
        // we have good keys
        r.quorumResult =
          keysWithoutQuorumSet.size > 0 ? QuorumResult.QUORUM_OK_PARTIAL : QuorumResult.QUORUM_OK
      }
    }
    r.itemCount = reply.items.length
    r.lastTs = '' + lastTsStr
    r.keysWithoutQuorumCount = keysWithoutQuorumSet.size
    r.keysWithoutQuorum = Array.from(keysWithoutQuorumSet)
    return reply
  }

  private static copyNonNullKeysTo(context: StorageRecord[], target: Set<string>) {
    // alternative: target.push(context.filter(value => value !=null).map(sr => sr.key).find(key => true))
    for (const record of context) {
      if (record != null) {
        target.add(record.salt)
        return
      }
    }
  }
}

class AggregatedRequest {
  nsName: string
  nsIndex: string
  month: string
  firstTs: string

  constructor(nsName: string, nsIndex: string, month: string, firstTs: string) {
    this.nsName = nsName
    this.nsIndex = nsIndex
    this.month = month
    this.firstTs = firstTs
  }
}

export enum QuorumResult {
  QUORUM_OK = 'QUORUM_OK',
  QUORUM_OK_PARTIAL = 'QUORUM_OK_PARTIAL',
  QUORUM_FAILED_NODE_REPLIES = 'QUORUM_FAILED_NODE_REPLIES',
  QUORUM_FAILED_BY_MIN_ITEMS = 'QUORUM_FAILED_BY_MIN_ITEMS'
}

export class Result {
  quorumResult: QuorumResult
  itemCount: number = 0
  lastTs: string
  keysWithoutQuorumCount: number = 0
  keysWithoutQuorum: string[] = []
}

export class AggregatedReply {
  items: StorageRecord[] = []
  result: Result = new Result()
}

// this is a single record , received from a node/list
export class StorageRecord {
  cat: string
  salt: string
  ts: string
  payload: any

  constructor(cat: string, salt: string, ts: string, payload: any) {
    this.cat = cat
    this.salt = salt
    this.ts = ts
    this.payload = payload
  }

  // alphabetical order for hashing (!)
  public computeMd5Hash(): string {
    return crypto
      .createHash('md5')
      .update(this.salt)
      .update(this.cat)
      .update(JSON.stringify(this.payload))
      .update(this.ts + '')
      .digest()
      .toString('hex')
  }
}
