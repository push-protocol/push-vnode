import {StringCounter} from "../../../src/utilz/stringCounter";
import {expect} from "chai";
import {
  AggregatedReplyHelper,
  NodeHttpStatus,
  QuorumResult
} from "../../../src/services/messaging/AggregatedReplyHelper";

describe('AppController (e2e)', () => {

  beforeEach(async () => {

  });


  it('test-counter', () => {
    let sc = new StringCounter();
    sc.increment('c', {name: 'john1'});
    sc.increment('c');
    sc.increment('c', {name: 'john2'});
    sc.increment('a');
    sc.increment('b');
    sc.increment('b');
    expect(sc.getValue('c')).to.be.equal(3);
    expect(sc.getValueContext('c')).to.be.deep.equal([{name: 'john1'}, null, {name: 'john2'}]); // take 1st value always
    expect(sc.getValue('b')).to.be.equal(2);
    expect(sc.getValueContext('b')).to.be.deep.equal([null, null]);
    expect(sc.getValue('a')).to.be.equal(1);
    expect(sc.getValueContext('a')).to.be.deep.equal([null]);
    expect(sc.getValue('z')).to.be.equal(null);

    {
      let arrAsc: string[] = [];
      sc.iterateAndSort(true, (idx, key, count) => {
        arrAsc.push(key);
        console.log('asc', key);
      })
      console.log('arrAsc=', arrAsc);
      expect(arrAsc).to.be.deep.equal(['a', 'b', 'c']);
    }

    {
      let arrDesc: string[] = [];
      sc.iterateAndSort(false, (idx, key, count) => {
        arrDesc.push(key);
        console.log('desc', key);
      })
      console.log('arrDesc=', arrDesc);
      expect(arrDesc).to.be.deep.equal(['c', 'b', 'a']);
    }
    console.dir(sc);
  });

  it('testaggr-internal', () => {
    let ar = new AggregatedReplyHelper();
    ar.appendItems('1', 200, {
      "items": [
        {
          "cat": "feeds",
          "salt": "a182ae50-9c3c-4c4e-84cd-f7da66f19357",
          "ts": "1111111111",
          "payload": {
            "id": 76576,
            "name": "john1",
            "surname": "YI2VaCPDU/BvvQ=="
          }
        },
        {
          "cat": "feeds",
          "salt": "67a876a6-d93f-47e5-8b2f-b087fd0fc2dc",
          "ts": "1420157966.693000",
          "payload": {
            "name": "john1",
          }
        }
      ]
    });
    ar.appendItems('2', 200, {
      "items": [
        {
          "cat": "feeds",
          "salt": "a182ae50-9c3c-4c4e-84cd-f7da66f19357",
          "ts": "1111111111",
          "payload": {
            "name": "john2",
          }
        },
        {
          "cat": "feeds",
          "salt": "67a876a6-d93f-47e5-8b2f-b087fd0fc2dc",
          "ts": "1420157966.693000",
          "payload": {
            "name": "john2",
          }
        }
      ]
    });
    console.dir(ar, {depth: null});
    expect(ar.mapKeyToNodeItems.size).to.be.equal(2);
    expect(ar.mapNodeToStatus.get('1')).to.be.equal(200);
    expect(ar.mapNodeToStatus.get('2')).to.be.equal(200);
    let itemMap1 = ar.mapKeyToNodeItems.get('a182ae50-9c3c-4c4e-84cd-f7da66f19357');
    expect(itemMap1.size).to.be.equal(2);
    expect(itemMap1.get('1').payload.name).to.be.equal('john1');
    expect(itemMap1.get('2').payload.name).to.be.equal('john2');
    expect(ar.mapKeyToNodeItems.get('67a876a6-d93f-47e5-8b2f-b087fd0fc2dc').size).to.be.equal(2);
  });

  it('testaggr-samereply', () => {
    let ar = new AggregatedReplyHelper();
    ar.appendItems('node1', 200, {
      "items": [
        {
          "cat": "feeds",
          "salt": "key1",
          "ts": "1111111111",
          "payload": {
            "id": 100,
            "name": "john1"
          }
        },
        {
          "cat": "feeds",
          "salt": "key2",
          "ts": "1420157966.693000",
          "payload": {
            "id": 200,
            "name": "john2",
          }
        }
      ]
    });
    ar.appendItems('node2', 200, {
      "items": [
        {
          "cat": "feeds",
          "salt": "key2",
          "ts": "1420157966.693000",
          "payload": {
            "id": 200,
            "name": "john2",
          }
        },
        {
          "cat": "feeds",
          "salt": "key1",
          "ts": "1111111111",
          "payload": {
            "id": 100,
            "name": "john1"
          }
        }
      ]
    });
    console.dir(ar, {depth: null});
    {
      let r = ar.aggregateItems(2);
      console.log(r);
      expect(r.result.quorumResult).to.be.equal(QuorumResult.QUORUM_OK);
      expect(r.result.keysWithoutQuorumCount).to.be.equal(0);
      expect(r.result.keysWithoutQuorum.length).to.be.equal(0);
      expect(r.result.itemCount).to.be.equal(2);
      expect(r.items).to.be.deep.equal([
        {
          "salt": "key1",
          "cat": "feeds",
          "ts": "1111111111",
          payload: {
            "id": 100,
            "name": "john1"
          }
        },
        {
          "salt": "key2",
          "cat": "feeds",
          "ts": "1420157966.693000",
          payload: {
            "id": 200,
            "name": "john2"
          }
        }]);
    }
    {
      let r = ar.aggregateItems(3); // no quorum
      console.dir(r);
      expect(r.result.quorumResult).to.be.equal(QuorumResult.QUORUM_FAILED_NODE_REPLIES);
      expect(r.result.keysWithoutQuorumCount).to.be.equal(2);
      expect(r.result.keysWithoutQuorum.length).to.be.equal(2);
      expect(r.result.itemCount).to.be.equal(0);
      expect(r.items.length).to.be.equal(0);
    }
  });
  it('testaggr-diffreply', () => {
    let ar = new AggregatedReplyHelper();
    // for quorum = 3
    // key1 = quorum-ok, key2 = quorum-by-time-fail, key3 = quorum by not enough replies
    ar.appendItems('node1', 200, {
      "items": [
        {
          "cat": "feeds",
          "salt": "key1",
          "ts": "1111111111",
          "payload": {
            "id": 100,
            "name": "john1"
          }
        },
        {
          "cat": "feeds",
          "salt": "key2",
          "ts": "1420157966.693000",
          "payload": {
            "id": 200,
            "name": "john2",
          }
        }
      ]
    });
    ar.appendItems('node2', 200, {
      "items": [
        {
          "cat": "feeds",
          "salt": "key2",
          "ts": "1420157966.693000",
          "payload": {
            "id": 200,
            "name": "john2",
          }
        },
        {
          "cat": "feeds",
          "salt": "key1",
          "ts": "1111111111",
          "payload": {
            "id": 100,
            "name": "john1"
          }
        },
      ]
    });
    ar.appendItems('node3', 200, {
      "items": [
        {
          "cat": "feeds",
          "salt": "key3",
          "ts": "1420157966.693000",
          "payload": {
            "id": 200,
            "name": "john3",
          }
        },
        {
          "cat": "feeds",
          "salt": "key2",
          "ts": "1420159999.999999",
          "payload": {
            "id": 200,
            "name": "john2",
          }
        },
        {
          "cat": "feeds",
          "salt": "key1",
          "ts": "1111111111",
          "payload": {
            "id": 100,
            "name": "john1"
          }
        },
      ]
    });
    console.dir(ar, {depth: null});
    let r = ar.aggregateItems(3);
    console.log(r);
    expect(r.result.quorumResult).to.be.equal(QuorumResult.QUORUM_OK_PARTIAL);
    expect(r.result.keysWithoutQuorumCount).to.be.equal(2);
    expect(r.result.keysWithoutQuorum.length).to.be.equal(2);
    expect(r.result.keysWithoutQuorum).to.be.deep.equal(['key2', 'key3']);
    expect(r.result.itemCount).to.be.equal(1);
    expect(r.items).to.be.deep.equal([
      {
        "salt": "key1",
        "cat": "feeds",
        "ts": "1111111111",
        payload: {
          "id": 100,
          "name": "john1"
        }
      }]);
  });

  it('testaggr-empty-replies', () => {
    let ar = new AggregatedReplyHelper();
    // for quorum = 3
    // key1 = quorum-ok, key2 = quorum-by-time-fail, key3 = quorum by not enough replies
    ar.appendItems('node1', 200, {
      "items": []
    });
    ar.appendItems('node2', 200, {
      "items": []
    });
    ar.appendItems('node3', 200, {
      "items": []
    });
    console.dir(ar, {depth: null});
    let r = ar.aggregateItems(3);
    console.log(r);
    expect(r.result.quorumResult).to.be.equal(QuorumResult.QUORUM_OK);
    expect(r.result.keysWithoutQuorumCount).to.be.equal(0);
    expect(r.result.keysWithoutQuorum.length).to.be.equal(0);
    expect(r.result.keysWithoutQuorum).to.be.deep.equal([]);
    expect(r.result.itemCount).to.be.equal(0);
    expect(r.items).to.be.deep.equal([]);
  });

  it('testaggr-node-noreply', () => {
    let ar = new AggregatedReplyHelper();
    // for quorum = 3
    // key1 = quorum-ok, key2 = quorum-by-time-fail, key3 = quorum by not enough replies
    ar.appendItems('node1', NodeHttpStatus.REPLY_TIMEOUT, null);
    ar.appendItems('node2', NodeHttpStatus.REPLY_TIMEOUT, null);
    ar.appendItems('node3', NodeHttpStatus.REPLY_TIMEOUT, null);
    console.dir(ar, {depth: null});
    let r = ar.aggregateItems(3);
    console.log(r);
    expect(r.result.quorumResult).to.be.equal(QuorumResult.QUORUM_FAILED_NODE_REPLIES);
    expect(r.result.keysWithoutQuorumCount).to.be.equal(0);
    expect(r.result.keysWithoutQuorum.length).to.be.equal(0);
    expect(r.result.keysWithoutQuorum).to.be.deep.equal([]);
    expect(r.result.itemCount).to.be.equal(0);
    expect(r.items).to.be.deep.equal([]);
  });

  it('testaggr-node-errreply', () => {
    let ar = new AggregatedReplyHelper();
    // for quorum = 3
    // key1 = quorum-ok, key2 = quorum-by-time-fail, key3 = quorum by not enough replies
    ar.appendItems('node1', 500, null);
    ar.appendItems('node2', 400, null);
    ar.appendItems('node3', 500, null);
    console.dir(ar, {depth: null});
    let r = ar.aggregateItems(3);
    console.log(r);
    expect(r.result.quorumResult).to.be.equal(QuorumResult.QUORUM_FAILED_NODE_REPLIES);
    expect(r.result.keysWithoutQuorumCount).to.be.equal(0);
    expect(r.result.keysWithoutQuorum.length).to.be.equal(0);
    expect(r.result.keysWithoutQuorum).to.be.deep.equal([]);
    expect(r.result.itemCount).to.be.equal(0);
    expect(r.items).to.be.deep.equal([]);
  });
});
