import {PromiseUtil} from "../../src/utilz/promiseUtil";
import {assert} from "chai";
import {StrUtil} from "../../src/utilz/strUtil";


describe('testPromiseUtil', () => {
    it('testCreateThenResolve', testCreateThenResolve);
    it('testRejectByTimeout', testRejectByTimeout);
    it('testResolveByTimeout', testResolveByTimeout);
})

async function testCreateThenResolve() {
    let deferred = PromiseUtil.createDeferred();
    let promise1 = new Promise<void>(async (resolve, reject) => {
        console.log('waiting for promise');
        await deferred.promise;
        console.log('completed: waiting for promise');
        resolve();
    });
    setTimeout(() => {
        deferred.resolve();
    }, 1000);
    await promise1;
}

async function testRejectByTimeout() {
    let deferred = PromiseUtil.createDeferred(1000);
    console.log('waiting for promise');
    try {
        await deferred.promise;
        assert.fail('does not throw an error')
    } catch (e) {
        console.log('completed: waiting for promise');
    }
}

async function testResolveByTimeout() {
    let deferred = PromiseUtil.createDeferred(0, 1000);
    console.log('waiting for promise');
    await deferred.promise;
    console.log('completed: waiting for promise');
}
