import {WaitNotify} from "../../src/utilz/waitNotify";

const objMonitor = new WaitNotify();

describe('api test3', () => {
    it('testSig', testWait10Times);
})

function testWait10Times() {
    (async () => {
        setInterval(() => {
            objMonitor.notify();
        }, 1000);
    })();

    (async () => {
        let count = 10;
        while (count > 0) {
            try {
                await objMonitor.wait();
            } catch (e) {
                console.log(e);
            }
            count--;
            console.log('wait notify count', count);
        }
    })();
}