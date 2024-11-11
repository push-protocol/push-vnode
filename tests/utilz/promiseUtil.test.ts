import {PromiseUtil} from "../../src/utilz/promiseUtil";
import {assert} from "chai";


describe('testPromiseUtil', () => {
    it('testCreateThenResolve', async function () {
        let deferred = PromiseUtil.createDeferred();
        let promise1 = new Promise<void>(async (resolve, reject) => {
            console.log('waiting for promise');
            await deferred.promise;
            console.log('completed: waiting for promise');
            resolve();
        });
        setTimeout(() => {
            deferred.resolve();
        }, 300);
        await promise1;
    });
    it('testRejectByTimeout', async function () {
        let deferred = PromiseUtil.createDeferred(300);
        console.log('waiting for promise');
        try {
            await deferred.promise;
            assert.fail('does not throw an error')
        } catch (e) {
            console.log('completed: waiting for promise');
        }
    });
    it('testResolveByTimeout', async function () {
        let deferred = PromiseUtil.createDeferred(0, 300);
        console.log('waiting for promise');
        await deferred.promise;
        console.log('completed: waiting for promise');
    });

});


describe('test setTimeout', () => {
    it('runAndAbort', async function () {
        const p = PromiseUtil.setTimeoutEx(100, () => {
            console.log('waiting for promise');
        });
        p.abort();
    })

    it('runAndWait', async function () {
        const p = PromiseUtil.setTimeoutEx(100, () => {
            console.log('waiting for promise');
        });
        let res = await p;
    })
});
