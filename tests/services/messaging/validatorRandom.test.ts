import {NetworkRandom, NodeRandom, ValidatorRandom} from "../../../src/services/messaging/validatorRandom";
import winston from "winston";
import {createLogger, format, Logger, transports} from "winston";
import {assert} from "chai";
import {RandomUtil} from "../../../src/utilz/randomUtil";
import {assertType} from "graphql/type";
import {WinstonUtil} from "../../../src/utilz/winstonUtil";


// todo logging doesn't log property, fix this
// prints: info:    buffer %o , hash (512bit) %o, nodeArr: %o
function getLog0(): Logger {
    return createLogger({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            // defaultFormatter
        ),
        transports: [new winston.transports.Console({
            format: winston.format.colorize()
        })]
    });

}

function getLog1() {
    return winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [new winston.transports.Console()],
    });
}

function getLog2() {
    return winston.createLogger({
        level: 'info',
        format: winston.format.cli(),
        transports: [new winston.transports.Console()],
    });
}

const log = WinstonUtil.newLog(null);


/**
 * A shortcut for testing
 * @param nodeIdAndRandomValue [nodeId, randomValueFromNodeId]
 * @param randomNodesRequired how many node ids do we need
 * @param seed seed, use it to get same or different results
 */
function doRunTest(nodeIdAndRandomValue: string[][], randomNodesRequired: number, seed: string = '', nodesToSkip:string[] = []): string[] {
    let nodeIds: string[] = [];
    let mapIdToRandom = new Map<string, string>();
    for (let i = 0; i < nodeIdAndRandomValue.length; i++) {
        const tuple = nodeIdAndRandomValue[i];
        nodeIds.push(tuple[0])
        mapIdToRandom.set(tuple[0], tuple[1]);
    }
    let result = ValidatorRandom.calculateValidationVector(nodeIds, mapIdToRandom, randomNodesRequired, seed, nodesToSkip);
    console.log('result', result);
    return result;
}

async function test1of1() {
    let nodeIdAndRandomValue = [['0x8e12dE12C35eABf35b56b04E53C4E468e46727E8', '44af1c9ad68ab56173d876883f77fd19c0294c20c8da6b24cd62c3a90c293b2c']];
    let res = doRunTest(nodeIdAndRandomValue, 1);
    assert.equal(1, res.length);
    assert.equal(nodeIdAndRandomValue[0][0], res[0]);
}

async function test_1of2_2of2() {
    let nodeIdAndRandomValue = [
        ['0x8e12dE12C35eABf35b56b04E53C4E468e46727E8', '44af1c9ad68ab56173d876883f77fd19c0294c20c8da6b24cd62c3a90c293b2c'],
        ['0xfDAEaf7afCFbb4e4d16DC66bD2039fd6004CFce8', '44af1c9ad68ab56173d876883f77fd19c0294c20c8da6b24cd62c3a90c293b2c']
    ];
    {
        let res = doRunTest(nodeIdAndRandomValue, 1);
        assert.equal(1, res.length);
        assert.equal(nodeIdAndRandomValue[0][0], res[0]);
    }
    {
        let res = doRunTest(nodeIdAndRandomValue, 2);
        assert.equal(2, res.length);
        assert.equal(nodeIdAndRandomValue[0][0], res[0]);
        assert.equal(nodeIdAndRandomValue[1][0], res[1]);
    }
}

async function test_1of2_withSkipNodes() {
    let nodeIdAndRandomValue = [
        ['0xA', '44af1c9ad68ab56173d876883f77fd19c0294c20c8da6b24cd62c3a90c293b2c'],
        ['0xB', '44af1c9ad68ab56173d876883f77fd19c0294c20c8da6b24cd62c3a90c293b2c']
    ];
    {
        let res = doRunTest(nodeIdAndRandomValue, 2, '', []);
        assert.equal(2, res.length);
    }
    {
        let res = doRunTest(nodeIdAndRandomValue, 1, '', ['0xB']);
        assert.equal(1, res.length);
        assert.equal(res[0], '0xA');
    }
    {
        let res = doRunTest(nodeIdAndRandomValue, 1, '', ['0xA']);
        assert.equal(1, res.length);
        assert.equal(res[0], '0xB');
    }
    {
        try {
            let res = doRunTest(nodeIdAndRandomValue, 1, '', ['0xB', '0xA']);
            assert.fail();
        } catch (e) {
        }
    }

}


async function test2of5() {
    let nodeIdAndRandomValue = [
        ['1', 'aaa'],
        ['2', 'bbbb'],
        ['3', 'cccccc'],
        ['4', 'cccccc'],
        ['5', 'ddddddd']
    ];
    {
        let count = 1;
        let res1 = doRunTest(nodeIdAndRandomValue, count);
        assert.equal(count, res1.length);
        let res2 = doRunTest(nodeIdAndRandomValue, count);
        assert.deepStrictEqual(res1, res2);
    }
    {
        let count = 2;
        let res1 = doRunTest(nodeIdAndRandomValue, count);
        assert.equal(count, res1.length);
        let res2 = doRunTest(nodeIdAndRandomValue, count);
        assert.deepStrictEqual(res1, res2);
    }
    {
        let count = 5;
        let res1 = doRunTest(nodeIdAndRandomValue, count);
        assert.equal(count, res1.length);
        let res2 = doRunTest(nodeIdAndRandomValue, count);
        assert.deepStrictEqual(res1, res2);
    }
}


async function test10of32() {
    let max = 32;

    let nodeIdAndRandomValue: string[][] = [];
    for (let i = 0; i < 32; i++) {
        nodeIdAndRandomValue.push([`${i}`, RandomUtil.getRandomBytesAsHex(32)])
    }

    {
        let count = 10;
        let res1 = doRunTest(nodeIdAndRandomValue, count);
        assert.equal(count, res1.length);
        let res2 = doRunTest(nodeIdAndRandomValue, count);
        assert.deepStrictEqual(res1, res2);
    }
    {
        let count = 32;
        let res1 = doRunTest(nodeIdAndRandomValue, count);
        assert.equal(count, res1.length);
        let res2 = doRunTest(nodeIdAndRandomValue, count);
        assert.deepStrictEqual(res1, res2);
    }
}

async function test1of64_different_seed() {
    let max = 64;

    let nodeIdAndRandomValue: string[][] = [];
    for (let i = 0; i < max; i++) {
        nodeIdAndRandomValue.push([`${i}`, RandomUtil.getRandomBytesAsHex(32)])
    }

    {
        // we check that every res1 is unique because of seed
        let uniqResult = new Set<string>();
        {
            let count = 1;
            let res1 = doRunTest(nodeIdAndRandomValue, count);
            assert.equal(count, res1.length);
            let res2 = doRunTest(nodeIdAndRandomValue, count);
            assert.deepStrictEqual(res1, res2);
            assert.isTrue(putIfAbsent(uniqResult, res1[0]));

        }
        {
            let count = 1;
            let seed = 'aaabbbabab';
            let res1 = doRunTest(nodeIdAndRandomValue, count, seed);
            assert.equal(count, res1.length);
            let res2 = doRunTest(nodeIdAndRandomValue, count, seed);
            assert.deepStrictEqual(res1, res2);
            assert.isTrue(putIfAbsent(uniqResult, res1[0]));
        }
        {
            let count = 1;
            let seed = '92374239847';
            let res1 = doRunTest(nodeIdAndRandomValue, count, seed);
            assert.equal(count, res1.length);
            let res2 = doRunTest(nodeIdAndRandomValue, count, seed);
            assert.deepStrictEqual(res1, res2);
            assert.isTrue(putIfAbsent(uniqResult, res1[0]));
        }
    }
}

function putIfAbsent(set: Set<string>, key: string): boolean {
    if (set.has(key)) {
        return false;
    }
    set.add(key);
    return true;
}

describe('test_ProcessAndValidateBy1Node', function () {
    it('test1of1', test1of1);
    it('test_1of2_2of2', test_1of2_2of2);
    it('test_1of2_withSkipNodes', test_1of2_withSkipNodes);
    it('test2of5', test2of5);
    it('test10of32', test10of32);
    it('test1of64_different_seed', test1of64_different_seed);
})

/*

describe('block tests', function () {

    it('test attest token', async function () {
        let token = "eyJub2RlcyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjYxNDg2NzAwMjQsInJhbmRvbUhleCI6ImIyNjdjYTFlZmFiY2Y4YmQyMGNiN2NhYzY1YzBjNTQyOGVlZmRmMzgiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MjYxNDg2NzAwMjAsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyNjE0ODY3MDAxNiwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4NDZjMWQyNzFmYzg2NzQ0NTkxODVhMmFiZWNmNzc3NjI5YTAxMzcwZjQzZjA3ZjQ5ZWI0MTYyNWFlZWVmMWQwMzVkMTlmZDJhZDJkNzIyMjcxYjQxZjNlNmNiMWU3NTAzODQ3MDZhYjgzNjY0NzY4N2U1OTRjYmNkYmNmMjFhZWYxYiJ9LHsibm9kZUlkIjoiMHg5OEY5RDkxMEFlZjlCM0I5QTQ1MTM3YWYxQ0E3Njc1ZUQ5MGE1MzU1IiwidHNNaWxsaXMiOjE3MjYxNDg2NzAwMjksInJhbmRvbUhleCI6ImMxZmIzOWE4MjJiOWQ4MmFkMmQ3NDczMjBiYWU4NjQwNjQ4ZjI1YTciLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjYxNDg2NzAwMTcsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweGZEQUVhZjdhZkNGYmI0ZTRkMTZEQzY2YkQyMDM5ZmQ2MDA0Q0ZjZTgiLCJ0c01pbGxpcyI6MTcyNjE0ODY3MDAyNCwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4ZmY3NzZlYzk3NjBiNWRhNDcyODIxMDM4YmRmMWRjY2VhYjMxMGZlMTIwMDdiYjNmNDNmNjRiNjQ1NTAyZGY0ZjM3MzIyNDMwZmUzMzZlNTE2YTVjNmE3NDYwODU0ZTQwMzBiNTYzNDQ2M2RjOGEwZGExNThhMWIwYzc4YTI2MGUxYiJ9LHsibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MjYxNDg2NzAwMzUsInJhbmRvbUhleCI6ImI5MzFlYzQxYjM5N2NiMWRlYjQ5ZTY1N2Q5ZDdiNzk4N2QxY2E3NTAiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MjYxNDg2NzAwMTUsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcyNjE0ODY3MDAyNSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4N2M5ZDQ4MjljNmFhYTY1NTlkZWQ4MzI0M2I2ZThkOGI2ZWIzMzZkOTA5MmEyYTBkZjI1MzFkYzNjZDllMmIzNTU3NWJkYjhiYTExNDIyYzJmYzRiYjY3N2UwZDljZTViZjQ0ZDU0ZmU1ODcyZjllMDc2YWMzOWQ1MDFiNzQ5NDMxYyJ9XX0=";
        const nr = NetworkRandom.read(token)
        const attestVector = ValidatorRandom.createValidationVector(
          this.log,
          this.contractState.getValidatorNodesMap(),
          this.contractState.contractCli.valPerBlock - 1,
          nr,
          'attest',
          this.contractState.contractCli.nodeRandomMinCount,
          this.contractState.contractCli.nodeRandomPingCount,
          [validatorNodeId]
        )
    })
}*/
