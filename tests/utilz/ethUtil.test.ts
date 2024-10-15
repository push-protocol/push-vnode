import 'mocha'
import {assert, expect} from "chai";
import {Wallet} from "ethers";
import {EthUtil} from "../../src/utilz/ethUtil";
import crypto from "crypto";
import {BitUtil} from "../../src/utilz/bitUtil";
import {readFileSync} from "fs";
import {ChainUtil} from "../../src/utilz/chainUtil";
import {Check} from "../../src/utilz/check";
import {BlockUtil} from "../../src/services/messaging-common/blockUtil";

import * as ed from '@noble/ed25519';
import StrUtil from "../../src/utilz/strUtil";

describe('api test3', function () {
  it('testSig', async function () {
    // create random private key, encrypt it with password, and store as encryptedJsonWallet
    const wallet1PrivKey = "0x" + crypto.randomBytes(32).toString("hex");
    console.log("pk", wallet1PrivKey);
    const wallet1 = new Wallet(wallet1PrivKey);
    console.log("address", await wallet1.getAddress());
    console.log("pubkey", wallet1.publicKey);
    // create sig
    let metaObj = {address: "0x1"};
    let obj = {name: "user1", type: 1};
    let sig1 = await EthUtil.create(wallet1, metaObj, obj);
    // check sig
    let metaObj2 = {address: "0x1"};
    let obj2 = {type: 1, name: "user1"}; // reverse order
    let targetWallet = await wallet1.getAddress();
    assert.isTrue(EthUtil.check(sig1, targetWallet, metaObj2, obj2));
  })

  it('testSigRecovery', async function () {
    let msg = '08d0';

    let mnemonic = "radar blur cabbage chef fix engine embark joy scheme fiction master release";
    let wallet = Wallet.fromMnemonic(mnemonic);
    let signature = await EthUtil.signBytes(wallet, BitUtil.base16ToBytes(msg));
    let recoveredPubKey = await EthUtil.recoverAddressFromMsg(BitUtil.base16ToBytes(msg), signature);
    console.log(wallet.address, recoveredPubKey);
    assert.equal(wallet.address, recoveredPubKey);
  })

  it('testCAIPParsing', async function () {
    {
      // # Ethereum mainnet (canonicalized with [EIP-55][] checksum)
      let addr = 'eip155:1:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{
        namespace: "eip155",
        chainId: "1",
        addr: "0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb"
      }, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.true;
    }
    {
      // not full
      let addr = 'eip155:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{
        namespace: "eip155",
        chainId: null,
        addr: "0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb"
      }, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.false;
      let shardId = BlockUtil.calculateAffectedShard(addr, 32);
      console.log('shardId: %s', shardId);
    }
    {
      // # Solana address
      // Solana “addresses” are base-58 encoded 256-bit Ed25519 public keys with length varying from 32 to 44 characters.
      let addr = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{
        namespace: "solana",
        chainId: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        addr: "7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv"
      }, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.true;
    }
    {
      // # StarkNet Testnet
      let addr = 'starknet:SN_GOERLI:0x02dd1b492765c064eac4039e3841aa5f382773b598097a40073bd8b48170ab57';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{
        namespace: "starknet",
        chainId: "SN_GOERLI",
        addr: "0x02dd1b492765c064eac4039e3841aa5f382773b598097a40073bd8b48170ab57"
      }, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.true;
    }
    {
      // incorrect
      let addr = ':1:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb';
      let c = ChainUtil.parseCaipAddress(addr);
      Check.isTrue(c[1] != null && c[1].length > 1);
      Check.isTrue(c[0] == null);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.false;
    }
    {
      // # Dummy max length (64+1+8+1+32 = 106 chars/bytes)
      let addr = 'chainstd:8c3444cf8970a9e41a706fab93e7a6c4:6d9b0b4b9994e8a6afbd3dc3ed983cd51c755afb27cd1dc7825ef59c134a39f7';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{
        namespace: "chainstd",
        chainId: "8c3444cf8970a9e41a706fab93e7a6c4",
        addr: "6d9b0b4b9994e8a6afbd3dc3ed983cd51c755afb27cd1dc7825ef59c134a39f7"
      }, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.true;
    }


    // OTHER NETWORKS (WE DON"T SUPPORT THEM YET)
    {
      // # Bitcoin mainnet
      let addr = 'bip122:000000000019d6689c085ae165831e93:128Lkh3S7CkDTBZ8W7BbpsN3YYizJMp8p6';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{
        namespace: "bip122",
        chainId: "000000000019d6689c085ae165831e93",
        addr: "128Lkh3S7CkDTBZ8W7BbpsN3YYizJMp8p6"
      }, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.true;
    }

    {
      // # Cosmos Hub
      let addr = 'cosmos:cosmoshub-3:cosmos1t2uflqwqe0fsj0shcfkrvpukewcw40yjj6hdc0';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{
        namespace: "cosmos",
        chainId: "cosmoshub-3",
        addr: "cosmos1t2uflqwqe0fsj0shcfkrvpukewcw40yjj6hdc0"
      }, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.true;
    }
    {
      // # Kusama network
      let addr = 'polkadot:b0a8d493285c2df73290dfb7e61f870f:5hmuyxw9xdgbpptgypokw4thfyoe3ryenebr381z9iaegmfy';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{
        namespace: "polkadot",
        chainId: "b0a8d493285c2df73290dfb7e61f870f",
        addr: "5hmuyxw9xdgbpptgypokw4thfyoe3ryenebr381z9iaegmfy"
      }, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.true;
    }
    {
      // # Hedera address (with optional checksum suffix per [HIP-15][])
      let addr = 'hedera:mainnet:0.0.1234567890-zbhlt';
      let c = ChainUtil.parseCaipAddress(addr);
      expect(c).to.deep.equal([{namespace: "hedera", chainId: "mainnet", addr: "0.0.1234567890-zbhlt"}, null]);
      expect(ChainUtil.isFullCAIPAddress(addr)).to.be.true;
    }
  })
})
