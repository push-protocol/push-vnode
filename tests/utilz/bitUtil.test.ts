import {BitUtil} from "../../src/utilz/bitUtil";
import {assert} from "chai";

describe('test bitUtil.xor', () => {

    it('test1', function () {
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
    });

    it('testEmptyCase', function () {
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

    });

    it('testBase64', function () {
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
    });

    it('testParse', () => {
        let arr = BitUtil.base16ToBytes("34042057163d3aebcfaa352fa1f935637fa57450c6952285e03b0589b8b7d8cd7c69fcc954109bfded37738e3fda295fe4c89875df74872eb57cb3442607bde31c");
        console.log(arr);
        assert.isTrue(arr.length === 65);
        assert.isTrue(arr[0]==52);
        assert.isTrue(arr[64]==28);
    })
})



import { expect } from 'chai';

describe('BitUtil', () => {
    const asciiString = 'Hello, World!';
    const unicodeString = 'Hello, World! こんにちは世界🌍';

    describe('String and Base64 conversions', () => {
        it('should correctly convert ASCII string to base64 and back', () => {
            const base64 = BitUtil.stringToBase64(asciiString);
            const resultString = BitUtil.base64ToString(base64);
            expect(resultString).to.equal(asciiString);
        });

        it('should correctly convert Unicode string to base64 and back', () => {
            const base64 = BitUtil.stringToBase64(unicodeString);
            const resultString = BitUtil.base64ToString(base64);
            expect(resultString).to.equal(unicodeString);
        });

        it('should correctly convert ASCII string to base64 using strToBase64 and back using base64ToStr', () => {
            const base64 = BitUtil.strToBase64(asciiString);
            const resultString = BitUtil.base64ToStr(base64);
            expect(resultString).to.equal(asciiString);
        });

        it('should correctly convert Unicode string to base64 using strToBase64 and back using base64ToStr', () => {
            const base64 = BitUtil.strToBase64(unicodeString);
            const resultString = BitUtil.base64ToStr(base64);
            expect(resultString).to.equal(unicodeString);
        });
    });

    describe('String and UTF-8 bytes conversions', () => {
        it('should correctly convert ASCII string to bytes and back', () => {
            const bytes = BitUtil.stringToBytesUtf(asciiString);
            const resultString = BitUtil.bytesUtfToString(bytes);
            expect(resultString).to.equal(asciiString);
        });

        it('should correctly convert Unicode string to bytes and back', () => {
            const bytes = BitUtil.stringToBytesUtf(unicodeString);
            const resultString = BitUtil.bytesUtfToString(bytes);
            expect(resultString).to.equal(unicodeString);
        });
    });

    describe('Bytes and Base16 (hex) conversions', () => {
        it('should correctly convert bytes to base16 and back for ASCII string', () => {
            const bytes = BitUtil.stringToBytesUtf(asciiString);
            const hexString = BitUtil.bytesToBase16(bytes);
            const resultBytes = BitUtil.base16ToBytes(hexString);
            const resultString = BitUtil.bytesUtfToString(resultBytes);
            expect(resultString).to.equal(asciiString);
        });

        it('should correctly convert bytes to base16 and back for Unicode string', () => {
            const bytes = BitUtil.stringToBytesUtf(unicodeString);
            const hexString = BitUtil.bytesToBase16(bytes);
            const resultBytes = BitUtil.base16ToBytes(hexString);
            const resultString = BitUtil.bytesUtfToString(resultBytes);
            expect(resultString).to.equal(unicodeString);
        });
    });

    describe('Bytes and Base64 conversions', () => {
        it('should correctly convert bytes to base64 and back for ASCII string', () => {
            const bytes = BitUtil.stringToBytesUtf(asciiString);
            const base64String = BitUtil.bytesToBase64(bytes);
            const resultBytes = BitUtil.base64ToBytes(base64String);
            expect(resultBytes).to.deep.equal(bytes);
        });

        it('should correctly convert bytes to base64 and back for Unicode string', () => {
            const bytes = BitUtil.stringToBytesUtf(unicodeString);
            const base64String = BitUtil.bytesToBase64(bytes);
            const resultBytes = BitUtil.base64ToBytes(base64String);
            expect(resultBytes).to.deep.equal(bytes);
        });
    });

    describe('Base64 and Base16 conversions', () => {
        it('should correctly convert base64 to base16 and back for ASCII string', () => {
            const base64String = BitUtil.stringToBase64(asciiString);
            const base16String = BitUtil.base64ToBase16(base64String);
            const bytesFromBase16 = BitUtil.base16ToBytes(base16String);
            const bytesFromBase64 = BitUtil.base64ToBytes(base64String);
            expect(bytesFromBase16).to.deep.equal(bytesFromBase64);
        });

        it('should correctly convert base64 to base16 and back for Unicode string', () => {
            const base64String = BitUtil.stringToBase64(unicodeString);
            const base16String = BitUtil.base64ToBase16(base64String);
            const bytesFromBase16 = BitUtil.base16ToBytes(base16String);
            const bytesFromBase64 = BitUtil.base64ToBytes(base64String);
            expect(bytesFromBase16).to.deep.equal(bytesFromBase64);
        });
    });

    describe('bytesBufToBase16', () => {
        it('should correctly convert Buffer to base16 for ASCII string', () => {
            const bytes = BitUtil.stringToBytesUtf(asciiString);
            const buffer = Buffer.from(bytes);
            const hexString = BitUtil.bytesBufToBase16(buffer);
            const resultBytes = BitUtil.base16ToBytes(hexString);
            const resultString = BitUtil.bytesUtfToString(resultBytes);
            expect(resultString).to.equal(asciiString);
        });

        it('should correctly convert Buffer to base16 for Unicode string', () => {
            const bytes = BitUtil.stringToBytesUtf(unicodeString);
            const buffer = Buffer.from(bytes);
            const hexString = BitUtil.bytesBufToBase16(buffer);
            const resultBytes = BitUtil.base16ToBytes(hexString);
            const resultString = BitUtil.bytesUtfToString(resultBytes);
            expect(resultString).to.equal(unicodeString);
        });
    });
});


