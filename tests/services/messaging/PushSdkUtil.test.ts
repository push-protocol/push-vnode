import {expect} from 'chai';
import 'mocha';
import {PushSdkUtil} from "../../../src/services/messaging-common/pushSdkUtil";
import {ChainUtil} from "../../../src/utilz/chainUtil";

describe('PushSdkUtil', () => {
  describe('pushAddrToEvmAddr', () => {
    it('should convert a valid Push address to the correct EVM address', () => {
      const pushAddress = 'pushconsumer1ulpxwud78ctaar5zgeuhmju5k8gpz8najcvxkn';
      const expectedEvmAddress = '0xE7C26771bE3E17dE8e8246797DCB94b1D0111E7D';
      const result = PushSdkUtil.pushAddrToEvmAddr(pushAddress);
      expect(result).to.equal(expectedEvmAddress);
    });

    it('should throw an error when given an empty string', () => {
      expect(() => PushSdkUtil.pushAddrToEvmAddr('')).to.throw();
    });

    it('should throw an error when given null', () => {
      expect(() => PushSdkUtil.pushAddrToEvmAddr(null as any)).to.throw();
    });

    it('should throw an error when given undefined', () => {
      expect(() => PushSdkUtil.pushAddrToEvmAddr(undefined as any)).to.throw();
    });

    it('should throw an error when given a Push address with wrong prefix', () => {
      const invalidPushAddress = 'wrongprefix1ulpxwud78ctaar5zgeuhmju5k8gpz8najcvxkn';
      expect(() => PushSdkUtil.pushAddrToEvmAddr(invalidPushAddress)).to.throw();
    });

    it('should throw an error when given an invalid Push address', () => {
      const invalidPushAddress = 'pushconsumer1!@#$%^&*()_+';
      expect(() => PushSdkUtil.pushAddrToEvmAddr(invalidPushAddress)).to.throw();
    });

    it('should throw an error when given a Push address with invalid checksum', () => {
      const validPushAddress = 'pushconsumer1ulpxwud78ctaar5zgeuhmju5k8gpz8najcvxkn';
      const invalidPushAddress = validPushAddress.slice(0, -1) + 'x';
      expect(() => PushSdkUtil.pushAddrToEvmAddr(invalidPushAddress)).to.throw();
    });

    it('should throw an error when Push address contains invalid characters', () => {
      const invalidPushAddress = 'pushconsumer1ulpxwud78ctaar5zgeuhmju5k8gpz8najcvxk!';
      expect(() => PushSdkUtil.pushAddrToEvmAddr(invalidPushAddress)).to.throw();
    });

    it('should throw an error when Push address is too short', () => {
      const shortPushAddress = 'pushconsumer1ulpxwud78ctaar5zgeuhmju5k8gpz8najc';
      expect(() => PushSdkUtil.pushAddrToEvmAddr(shortPushAddress)).to.throw();
    });

    it('should convert a Push address to EVM and back to the same Push address', () => {
      const pushAddress = 'pushconsumer1ulpxwud78ctaar5zgeuhmju5k8gpz8najcvxkn';
      const evmAddress = PushSdkUtil.pushAddrToEvmAddr(pushAddress);
      const resultPushAddress = PushSdkUtil.evmAddrToPushAddr(evmAddress);
      expect(resultPushAddress).to.equal(pushAddress);
    });
  });

  describe('evmAddrToPushAddr', () => {
    it('should convert a valid EVM address to the correct Push address', () => {
      const evmAddress = '0xE7C26771bE3E17dE8e8246797DCB94b1D0111E7D';
      const expectedPushAddress = 'pushconsumer1ulpxwud78ctaar5zgeuhmju5k8gpz8najcvxkn';
      const result = PushSdkUtil.evmAddrToPushAddr(evmAddress);
      expect(result).to.equal(expectedPushAddress);
    });

    it('should convert a lowercase EVM address correctly', () => {
      const evmAddress = '0xe7c26771be3e17de8e8246797dcb94b1d0111e7d';
      const expectedPushAddress = 'pushconsumer1ulpxwud78ctaar5zgeuhmju5k8gpz8najcvxkn';
      const result = PushSdkUtil.evmAddrToPushAddr(evmAddress);
      expect(result).to.equal(expectedPushAddress);
    });

    it('should convert an uppercase EVM address correctly', () => {
      const evmAddress = '0xE7C26771BE3E17DE8E8246797DCB94B1D0111E7D';
      const expectedPushAddress = 'pushconsumer1ulpxwud78ctaar5zgeuhmju5k8gpz8najcvxkn';
      const result = PushSdkUtil.evmAddrToPushAddr(evmAddress);
      expect(result).to.equal(expectedPushAddress);
    });

    it('should throw an error when given an empty string', () => {
      expect(() => PushSdkUtil.evmAddrToPushAddr('')).to.throw();
    });

    it('should throw an error when given null', () => {
      expect(() => PushSdkUtil.evmAddrToPushAddr(null as any)).to.throw();
    });

    it('should throw an error when given undefined', () => {
      expect(() => PushSdkUtil.evmAddrToPushAddr(undefined as any)).to.throw();
    });

    it('should throw an error when given an invalid EVM address with invalid characters', () => {
      const invalidEvmAddress = '0xE7C26771bE3E17dE8e8246797DCB94b1D0111E7Z';
      expect(() => PushSdkUtil.evmAddrToPushAddr(invalidEvmAddress)).to.throw();
    });

    it('should throw an error when EVM address contains non-hex characters', () => {
      const invalidEvmAddress = '0xG7C26771bE3E17dE8e8246797DCB94b1D0111E7D';
      expect(() => PushSdkUtil.evmAddrToPushAddr(invalidEvmAddress)).to.throw();
    });

    it('should throw an error when EVM address is too short', () => {
      const shortEvmAddress = '0xE7C26771bE3E17dE8e8246797DCB94b1D0111';
      expect(() => PushSdkUtil.evmAddrToPushAddr(shortEvmAddress)).to.throw();
    });

    it('should throw an error when EVM address is too long', () => {
      const longEvmAddress = '0xE7C26771bE3E17dE8e8246797DCB94b1D0111E7D12345';
      expect(() => PushSdkUtil.evmAddrToPushAddr(longEvmAddress)).to.throw();
    });

    it('should convert zero EVM address correctly', () => {
      const zeroEvmAddress = '0x0000000000000000000000000000000000000000';
      const expectedPushAddress = PushSdkUtil.evmAddrToPushAddr(zeroEvmAddress);
      const resultEvmAddress = PushSdkUtil.pushAddrToEvmAddr(expectedPushAddress);
      expect(resultEvmAddress).to.equal(zeroEvmAddress);
    });

    it('should convert maximum EVM address correctly', () => {
      const maxEvmAddress = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
      const expectedPushAddress = PushSdkUtil.evmAddrToPushAddr(maxEvmAddress);
      const resultEvmAddress = PushSdkUtil.pushAddrToEvmAddr(expectedPushAddress);
      expect(ChainUtil.isEqualEvmAddress(resultEvmAddress, maxEvmAddress)).to.equal(true);
    });

    it('should convert an EVM address to Push and back to the same EVM address', () => {
      const evmAddress = '0xE7C26771bE3E17dE8e8246797DCB94b1D0111E7D';
      const pushAddress = PushSdkUtil.evmAddrToPushAddr(evmAddress);
      const resultEvmAddress = PushSdkUtil.pushAddrToEvmAddr(pushAddress);
      expect(resultEvmAddress).to.equal(evmAddress);
    });
  });
});
