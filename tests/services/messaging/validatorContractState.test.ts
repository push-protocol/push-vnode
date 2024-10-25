import {ValidatorContractState} from "../../../src/services/messaging-common/validatorContractState";
import {assert} from "chai";

describe('Messaging validator contract', () => {

  it('do nothing', () => {
    assert.equal(ValidatorContractState.fixNodeUrl("https://mynode.local"), "https://mynode.local");
  })

  it('replace .local with localhost', () => {
    process.env["LOCALH"] = "true";
    // https + local -> https + localhost
    assert.equal(ValidatorContractState.fixNodeUrl("https://mynode.local"), "https://localhost");
    // http + local -> http + localhost
    assert.equal(ValidatorContractState.fixNodeUrl("http://mynode.local"), "http://localhost");
  })

  it('replace http with https', () => {
    process.env["LOCALH"] = "";
    // no .local processing
    assert.equal(ValidatorContractState.fixNodeUrl("https://mynode.local"), "https://mynode.local");
    // http -> https
    assert.equal(ValidatorContractState.fixNodeUrl("http://mynode.com"), "https://mynode.com");
  })
})