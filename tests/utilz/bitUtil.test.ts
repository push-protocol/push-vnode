import {BitUtil} from "../../src/utilz/bitUtil";
import {assert} from "chai";

describe('test bitUtil.xor', () => {
    it('test1', test1);
    it('testEmptyCase', testEmptyCase);
    it('testBase64', testBase64);
})

function testBase64() {
    {
        try {
            let value64 = BitUtil.strToBase64(null);
            assert.fail();
        } catch (e) {
        }

        try {
            let value2 = BitUtil.base64ToStr(null);
            assert.fail();
        } catch (e) {
        }
    }
    {
        let value = '';
        let value64 = BitUtil.strToBase64(value);
        let value2 = BitUtil.base64ToStr(value64);
        assert.strictEqual(value2, value2);
    }
    {
        let value = 'hello this is test!';
        let value64 = BitUtil.strToBase64(value);
        console.log(value64);
        let value2 = BitUtil.base64ToStr(value64);
        console.log(value2);
        assert.strictEqual(value2, value2);
    }
}

function test1() {
    {
        let src = new Buffer([0xFF]);
        let add = new Buffer([0xAA]);
        let result = BitUtil.xor(src, add);
        assert.deepStrictEqual(new Buffer([0x55]), result);
    }
    {
        let src = new Buffer([0xFF]);
        let add = new Buffer([0xFF, 0xAA]);
        let result = BitUtil.xor(src, add);
        assert.deepStrictEqual(new Buffer([0x00, 0xAA]), result);
    }
    {
        let src = new Buffer([0xFF, 0xAA]);
        let add = new Buffer([0xFF]);
        let result = BitUtil.xor(src, add);
        assert.deepStrictEqual(new Buffer([0x00, 0xAA]), result);
    }
}

function testEmptyCase() {
    {
        let src = null;
        let add = null;
        let result = BitUtil.xor(src, add);
        assert.deepStrictEqual(Buffer.alloc(0), result);
    }
    {
        let src = new Buffer([0xFF]);
        let add = null;
        let result = BitUtil.xor(src, add);
        assert.deepStrictEqual(new Buffer([0xFF]), result);
    }
    {
        let src = null;
        let add = new Buffer([0xAA]);
        let result = BitUtil.xor(src, add);
        assert.deepStrictEqual(new Buffer([0xAA]), result);
    }
    {
        let src = new Buffer([]);
        let add = new Buffer([]);
        let result = BitUtil.xor(src, add);
        assert.deepStrictEqual(new Buffer([]), result);
    }
    {
        let src = new Buffer([]);
        let add = new Buffer([0xAA]);
        let result = BitUtil.xor(src, add);
        assert.deepStrictEqual(new Buffer([0xAA]), result);
    }

}