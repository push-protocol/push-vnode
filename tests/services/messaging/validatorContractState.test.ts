import {ValidatorContractState} from "../../../src/services/messaging-common/validatorContractState";
import {assert} from "chai";

describe('Messaging validator contract', () => {

  it('do nothing', () => {
    assert.equal(ValidatorContractState.fixNodeUrl("https://mynode.local"), "https://mynode.local");
  })

  it('replace .local with localhost', () => {
    process.env["LOCALH"] = "true";
    assert.equal(ValidatorContractState.fixNodeUrl("https://mynode.local"), "https://localhost");
    process.env["LOCALH"] = "";
    assert.equal(ValidatorContractState.fixNodeUrl("https://mynode.local"), "https://mynode.local");
  })

  it('replace http with https', () => {
    assert.equal(ValidatorContractState.fixNodeUrl("http://mynode.com"), "https://mynode.com");
  })
})