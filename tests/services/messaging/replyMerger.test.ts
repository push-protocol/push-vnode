import {StringCounter} from "../../../src/utilz/stringCounter";
import {expect} from "chai";
import {
  ReplyMerger,
  NodeHttpStatus,
  QuorumResult, Rec
} from "../../../src/services/messaging/ReplyMerger";

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
    let ar = new ReplyMerger();
    ar.appendHttpCode('1', 200);
    ar.appendItem('1', new Rec({
      "salt": "a182ae50-9c3c-4c4e-84cd-f7da66f19357",
      "ts": "1111111111",
      "id": 76576,
      "name": "john1",
      "surname": "YI2VaCPDU/BvvQ=="
    }));
    ar.appendItem('1', new Rec({
      "salt": "67a876a6-d93f-47e5-8b2f-b087fd0fc2dc",
      "ts": "1420157966.693000",
      "name": "john1",
    }));

    ar.appendHttpCode('2', 200);
    ar.appendItem('2', new Rec({
      "salt": "a182ae50-9c3c-4c4e-84cd-f7da66f19357",
      "ts": "1111111111",
      "name": "john2",
    }));
    ar.appendItem('2', new Rec({
      "salt": "67a876a6-d93f-47e5-8b2f-b087fd0fc2dc",
      "ts": "1420157966.693000",
      "name": "john2",
    }));
    console.dir(ar, {depth: null});
    expect(ar.mapKeyToNodeItems.size).to.be.equal(2);
    expect(ar.mapNodeToStatus.get('1')).to.be.equal(200);
    expect(ar.mapNodeToStatus.get('2')).to.be.equal(200);
    let itemMap1 = ar.mapKeyToNodeItems.get('a182ae50-9c3c-4c4e-84cd-f7da66f19357');
    expect(itemMap1.size).to.be.equal(2);
    expect(itemMap1.get('1').payload.name).to.be.equal('john1');
    expect(itemMap1.get('2').payload.name).to.be.equal('john2');
    expect(ar.mapKeyToNodeItems.get('67a876a6-d93f-47e5-8b2f-b087fd0fc2dc').size).to.be.equal(2);
    const agg = ar.group(2);
    console.dir(agg, {depth: null});
    expect(agg.items.length).to.be.equal(0);
  });

  it('testaggr-samereply', () => {
    let ar = new ReplyMerger();
    ar.appendHttpCode('node1', 200);
    ar.appendItem('node1', new Rec({
      "salt": "key1",
      "ts": "1111111111",
      "id": 100,
      "name": "john1"
    }));
    ar.appendItem('node1', new Rec({
      "salt": "key2",
      "ts": "1420157966.693000",
      "id": 200,
      "name": "john2"
    }));
    ar.appendHttpCode('node2', 200);
    ar.appendItem('node2', new Rec({
      "salt": "key2",
      "ts": "1420157966.693000",
      "id": 200,
      "name": "john2"
    }));
    ar.appendItem('node2', new Rec({
      "salt": "key1",
      "ts": "1111111111",
      "id": 100,
      "name": "john1"
    }));
    console.dir(ar, {depth: null});
    {
      let r = ar.group(2);
      console.log(r);
      expect(r.summary.quorumResult).to.be.equal(QuorumResult.QUORUM_OK);
      expect(r.summary.keysWithoutQuorumCount).to.be.equal(0);
      expect(r.summary.keysWithoutQuorum.length).to.be.equal(0);
      expect(r.summary.itemCount).to.be.equal(2);
      expect(r.items).to.be.deep.equal([
        {
          "salt": "key1",
          "ts": "1111111111",
          "id": 100,
          "name": "john1"
        },
        {
          "salt": "key2",
          "ts": "1420157966.693000",
          "id": 200,
          "name": "john2"
        }]);
    }
    {
      let r = ar.group(3); // no quorum
      console.dir(r);
      expect(r.summary.quorumResult).to.be.equal(QuorumResult.QUORUM_FAILED_NODE_REPLIES);
      expect(r.summary.keysWithoutQuorumCount).to.be.equal(2);
      expect(r.summary.keysWithoutQuorum.length).to.be.equal(2);
      expect(r.summary.itemCount).to.be.equal(0);
      expect(r.items.length).to.be.equal(0);
    }
  });

  it('testaggr-diffreply', () => {
    let ar = new ReplyMerger();
    // for quorum = 3
    // key1 = quorum-ok, key2 = quorum-by-time-fail, key3 = quorum by not enough replies
    ar.appendHttpCode('node1', 200);
    ar.appendItem('node1', new Rec({
      "salt": "key1",
      "ts": "1111111111",
      "id": 100,
      "name": "john1"
    }));
    ar.appendItem('node1', new Rec({
      "salt": "key2",
      "ts": "1420157966.693000",
      "id": 200,
      "name": "john2",
    }));

    ar.appendHttpCode('node2', 200);
    ar.appendItem('node2', new Rec({
      "salt": "key2",
      "ts": "1420157966.693000",
      "id": 200,
      "name": "john2",
    }));
    ar.appendItem('node2', new Rec({
      "salt": "key1",
      "ts": "1111111111",
      "id": 100,
      "name": "john1"
    }));

    ar.appendHttpCode('node3', 200);
    ar.appendItem('node3', new Rec({
      "salt": "key3",
      "ts": "1420157966.693000",
      "id": 200,
      "name": "john3",
    }));
    ar.appendItem('node3', new Rec({
      "salt": "key2",
      "ts": "1420159999.999999",
      "id": 200,
      "name": "john2",
    }));
    ar.appendItem('node3', new Rec({
      "salt": "key1",
      "ts": "1111111111",
      "id": 100,
      "name": "john1"
    }));

    console.dir(ar, {depth: null});
    let r = ar.group(3);
    console.log(r);
    expect(r.summary.quorumResult).to.be.equal(QuorumResult.QUORUM_OK_PARTIAL);
    expect(r.summary.keysWithoutQuorumCount).to.be.equal(2);
    expect(r.summary.keysWithoutQuorum.length).to.be.equal(2);
    expect(r.summary.keysWithoutQuorum).to.be.deep.equal(['key2', 'key3']);
    expect(r.summary.itemCount).to.be.equal(1);
    expect(r.items).to.be.deep.equal([
      {
        "salt": "key1",
        "ts": "1111111111",
        "id": 100,
        "name": "john1"
      }]);
  });

  it('testaggr-empty-replies', () => {
    let ar = new ReplyMerger();
    // for quorum = 3
    // key1 = quorum-ok, key2 = quorum-by-time-fail, key3 = quorum by not enough replies
    ar.appendHttpCode('node1', 200);
    ar.appendHttpCode('node2', 200);
    ar.appendHttpCode('node3', 200);
    console.dir(ar, {depth: null});
    let r = ar.group(3);
    console.log(r);
    expect(r.summary.quorumResult).to.be.equal(QuorumResult.QUORUM_OK);
    expect(r.summary.keysWithoutQuorumCount).to.be.equal(0);
    expect(r.summary.keysWithoutQuorum.length).to.be.equal(0);
    expect(r.summary.keysWithoutQuorum).to.be.deep.equal([]);
    expect(r.summary.itemCount).to.be.equal(0);
    expect(r.items).to.be.deep.equal([]);
  });

  it('testaggr-node-noreply', () => {
    let ar = new ReplyMerger();
    // for quorum = 3
    // key1 = quorum-ok, key2 = quorum-by-time-fail, key3 = quorum by not enough replies
    ar.appendHttpCode('node1', NodeHttpStatus.REPLY_TIMEOUT);
    ar.appendHttpCode('node2', NodeHttpStatus.REPLY_TIMEOUT);
    ar.appendHttpCode('node3', NodeHttpStatus.REPLY_TIMEOUT);
    console.dir(ar, {depth: null});
    let r = ar.group(3);
    console.log(r);
    expect(r.summary.quorumResult).to.be.equal(QuorumResult.QUORUM_FAILED_NODE_REPLIES);
    expect(r.summary.keysWithoutQuorumCount).to.be.equal(0);
    expect(r.summary.keysWithoutQuorum.length).to.be.equal(0);
    expect(r.summary.keysWithoutQuorum).to.be.deep.equal([]);
    expect(r.summary.itemCount).to.be.equal(0);
    expect(r.items).to.be.deep.equal([]);
  });

  it('testaggr-node-errreply', () => {
    let ar = new ReplyMerger();
    // for quorum = 3
    // key1 = quorum-ok, key2 = quorum-by-time-fail, key3 = quorum by not enough replies
    ar.appendHttpCode('node1', 500);
    ar.appendHttpCode('node2',  400);
    ar.appendHttpCode('node3',  500);
    console.dir(ar, {depth: null});
    let r = ar.group(3);
    console.log(r);
    expect(r.summary.quorumResult).to.be.equal(QuorumResult.QUORUM_FAILED_NODE_REPLIES);
    expect(r.summary.keysWithoutQuorumCount).to.be.equal(0);
    expect(r.summary.keysWithoutQuorum.length).to.be.equal(0);
    expect(r.summary.keysWithoutQuorum).to.be.deep.equal([]);
    expect(r.summary.itemCount).to.be.equal(0);
    expect(r.items).to.be.deep.equal([]);
  });
});
