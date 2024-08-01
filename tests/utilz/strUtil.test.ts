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
