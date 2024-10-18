import crypto from 'crypto'
import { Logger } from 'winston'
import { WinstonUtil } from '../../utilz/winstonUtil'
import { StringCounter } from '../../utilz/stringCounter'
import {Check} from "../../utilz/check";
import {Coll} from "../../utilz/coll";

export enum NodeHttpStatus {
  REPLY_TIMEOUT = 0
}
const log: Logger = WinstonUtil.newLog('AggregatedReplyHelper');
// todo move tests from another repo
export class ReplyMerger<T> {
  // initial request
  aggrReq: AggregatedRequest
  // replies
  // nodeIds -> httpCode
  mapNodeToStatus: Map<string, number> = new Map<string, number>()
  // nodeIds item lists, reverted in a map
  // skey -> nodeId -> item
  mapKeyToNodeItems: Map<string, Map<string, Rec<T>>> = new Map<
    string,
    Map<string, Rec<T>>
  >();

  // add node http code
  public appendHttpCode(nodeId: string, nodeHttpStatus: number) {
    this.mapNodeToStatus.set(nodeId, nodeHttpStatus);
  }

  // add each node reply which contains [item]
  public appendItem(nodeId: string, storageRecord: Rec<T>) {
    Check.isTrue(this.mapNodeToStatus.get(nodeId)!=null, 'call appendHttpCode before appendSingleItem');
    this.doAppendItem(nodeId, storageRecord)
  }

  // todo ? not used
  // add each node reply which contains [item, item, item]
  public appendMultipleItems(nodeId: string, httpReplyData: any,
                             mapper: (httpReplyData: any) => Rec<T>[]) {
    if (httpReplyData?.items?.length > 0) {
      let items = mapper(httpReplyData);
      for (const item of items) {
        this.doAppendItem(nodeId, item);
      }
    }
  }

  // how to group arbitrary json?
  // key = masterpublickey
  // cat = INIT_DID
  // ts = null
  // payload = ALL FIELDS
  private doAppendItem(nodeId: string, storageRecord: Rec<T>) {
    let map2 = Coll.computeIfAbsent(this.mapKeyToNodeItems, storageRecord.skey, () => new Map<string, Rec<T>>())
    map2.set(nodeId, storageRecord)
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
    log.debug(`aggregateItems()`)
    const reply = new AggregatedReply()
    // if we have this amount of SAME replies for a key => we have this key
    const nodeCount = this.mapNodeToStatus.size
    log.debug(`quorumForKey=${minQuorumThreshold} nodeCount=${nodeCount}`)
    const keysWithoutQuorumSet = new Set<string>()
    let goodReplies = 0
    let lastTsStr = '0'
    for (const [nodeId, code] of this.mapNodeToStatus) {
      if (code >= 200 && code < 300) {
        goodReplies++
      }
    }
    for (const [skey, mapNodeIdToStorageRecord] of this.mapKeyToNodeItems) {
      log.debug(`checking skey: ${skey}`)

      // let's figure out quorum for this skey, we have replies from every node
      // sc: hash(StorageRecord) -> count, [storageRecord1, .., storageRecordN]
      // our goal is to grab top used hashes with frequency > quorum
      const sc = new StringCounter<Rec<T>>()

      for (const [nodeId, code] of this.mapNodeToStatus) {
        if (code == 200) {
          const record = mapNodeIdToStorageRecord.get(nodeId)
          const recordKey = record?.skey
          const recordHash = record == null ? 'null' : ReplyMerger.computeMd5Hash(record);
          log.debug(
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
            reply.items.push(first.payload)
            // lastTs = latest item ; we use string to preserve equality for all type of hashes
            // TODO a good discussion is required to figure out the best way to transfer high precision timestamps via rest
            if (first.ts != null) {
              if (Number.parseFloat(first.ts) > Number.parseFloat(lastTsStr)) {
                lastTsStr = first.ts
              }
            }
          } else {
            // top item has not enough copies on the network
            ReplyMerger.copyNonNullKeysTo(incrementArr, keysWithoutQuorumSet)
          }
        } else {
          ReplyMerger.copyNonNullKeysTo(incrementArr, keysWithoutQuorumSet)
        }
      })
    }
    log.debug(`non200Replies=${goodReplies}`)
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

  private static copyNonNullKeysTo<T>(context: Rec<T>[], target: Set<string>) {
    // alternative: target.push(context.filter(value => value !=null).map(sr => sr.key).find(key => true))
    for (const record of context) {
      if (record != null) {
        target.add(record.skey)
        return
      }
    }
  }

  // alphabetical order for hashing (!)
  public static computeMd5Hash<T>(rec: Rec<T>): string {
    return crypto
      .createHash('md5')
      .update(rec.skey)
      .update(JSON.stringify(rec.payload))
      .update(rec.ts + '')
      .digest()
      .toString('hex')
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
  items = []
  result: Result = new Result()
}

// this is a single record , received from a node/list
export class Rec<T> {
  skey: string
  ts: string | null
  payload: T | null

  constructor(payload: T, skeyField: string = 'salt', tsField: string = 'ts') {
    this.skey = payload[skeyField];
    Check.notNull(this.skey, 'skey is null');
    this.ts = tsField == null ? null : payload[tsField];
    this.payload = payload
  }
}