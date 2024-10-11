import {BitUtil} from "../../src/utilz/bitUtil";
import {assert} from "chai";
import StrUtil from "../../src/utilz/strUtil";

describe('strUtil test', () => {
    it('test1', test1);
})


function test1() {
    {
        assert.isFalse(StrUtil.isHex(null))
        assert.isFalse(StrUtil.isHex(undefined))
        assert.isFalse(StrUtil.isHex(''))
    }
    {
        assert.isFalse(StrUtil.isHex('0xABCD'))
        assert.isFalse(StrUtil.isHex('abcdefg'))
        assert.isFalse(StrUtil.isHex('0xabc'))
    }
    {
        assert.isTrue(StrUtil.isHex('ABCDEF'))
        assert.isTrue(StrUtil.isHex('0123456789abcdef'))
    }
}

describe('str format', () => {
    it('test2', test2);
})
function test2() {
    {
        {
            let s1 = new Set();
            s1.add(1);
            s1.add(2);
            console.log(StrUtil.fmt(s1));
        }
        {
            let s1 = new Set();
            s1.add("1");
            s1.add("2");
            console.log(StrUtil.fmt(s1));
        }
        {
            let a1 = ['a', 'b', 'c']
            console.log(StrUtil.fmt(a1));
        }
        {
            let a1 = {
                user: "x",
                array: [1,2,3],
                set: new Set(["A", "B"]),
                map: new Map([['today', 10], ['tomorrow', 20]]),
                subObj: {
                    "val1" : null,
                    "val2" : null
                }
            }
            console.log(StrUtil.fmt(a1));

            let circularObj:any = a1;
            circularObj.self = circularObj;
            circularObj.subObj.val1 = circularObj;
            console.log(StrUtil.fmt(circularObj));
        }
    }
}
