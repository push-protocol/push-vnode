import {assert} from "chai";
import {StrUtil} from "../../src/utilz/strUtil";

describe('strUtil test', () => {
    it('test1', function () {
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
    });
})


describe('str format', () => {
    it('test2', function () {
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
                    array: [1, 2, 3],
                    set: new Set(["A", "B"]),
                    map: new Map([['today', 10], ['tomorrow', 20]]),
                    subObj: {
                        "val1": null,
                        "val2": null
                    }
                }
                console.log(StrUtil.fmt(a1));

                let circularObj: any = a1;
                circularObj.self = circularObj;
                circularObj.subObj.val1 = circularObj;
                console.log(StrUtil.fmt(circularObj));
            }
        }
    });

    it('test3', function () {

        const stringifyObject = function(obj, indent = 0){
            const indentStr = " ".repeat(indent);
            const entries = Object.entries(obj).map(([key, value]) => {
                if (typeof value === "function")
                    return `${indentStr}    ${key}: ${value.toString()},`;
                else if (typeof value === "object" && value !== null)
                    return `${indentStr}    ${key}: ${stringifyObject(value, indent + 4)},`;
                return `${indentStr}    ${key}: ${JSON.stringify(value)},`;
            }).join("\n");
            return `{\n${entries}\n${indentStr}}`;
        };

        const obj = {
            foo: {
                bar: 1,
                baz: true,
            },
            stuff: {
                a: "foo",
                c: () => "abc",
                d: function(x){
                    let a = 1 + x;
                    return ++a;
                },
            },
        };

        console.log("const obj = " + stringifyObject(obj));
    })
})
