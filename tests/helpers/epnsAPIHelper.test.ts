var epnsAPIHelper = require('../../src/helpers/epnsAPIHelper')
import { EventType } from '../../src/enums/EventType'
import config from '../../src/config'
import chai from 'chai'
import 'mocha'
import dotenv from 'dotenv'

chai.should()
const expect = chai.expect

const envFound = dotenv.config()
if (envFound.error) {
  // This error should crash whole process
  throw new Error("⚠️  Couldn't find .env file  ⚠️")
}

const getCoreContract = async function () {
  return await epnsAPIHelper.getInteractableContracts(
    config.web3EthereumNetwork,
    {
      etherscanAPI: config.etherscanAPI,
      infuraAPI: config.infuraAPI,
      alchemyAPI: config.alchemyAPI
    },
    null,
    config.deployedCoreContract,
    config.deployedCoreContractABI
  )
}

const getCommunicatorContract = async function () {
  return await epnsAPIHelper.getInteractableContracts(
    config.web3EthereumNetwork,
    {
      etherscanAPI: config.etherscanAPI,
      infuraAPI: config.infuraAPI,
      alchemyAPI: config.alchemyAPI
    },
    null,
    config.deployedCommunicatorContractEthereum,
    config.deployedCommunicatorContractABI
  )
}

describe.skip('api/helpers/epnsAPIHelper :: epnsAPIHelper test', function () {
  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: deriveContractFilter test', async function () {
    const contract = await getCoreContract()
    const response = epnsAPIHelper.deriveContractFilter(contract, EventType.ChannelVerified)
    expect(response).not.to.be.equals(null)
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getVerifyChannelEvents test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 30237270
    const toBlock = 30237280
    const response = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.ChannelVerified,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getVerifyChannelEvents with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 30237270
    const toBlock = 30237280
    const response = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.ChannelVerified,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getVerifyChannelList test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 30237270
    const toBlock = 30237280
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.ChannelVerified,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getVerifyChannelList with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.ChannelVerified,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getUnverifyChannelEvents test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 32538620
    const toBlock = 32538630
    const response = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.ChannelVerificationRevoked,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getUnverifyChannelEvents with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.ChannelVerificationRevoked,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getUnverifyChannelList test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 32538620
    const toBlock = 32538630
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.ChannelVerificationRevoked,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getUnverifyChannelList with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.ChannelVerificationRevoked,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getAddSubGraphEvents test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 32335850
    const toBlock = 32335860
    const response = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.AddSubGraph,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getAddSubGraphEvents with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.AddSubGraph,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getAddSubGraphList test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 32335850
    const toBlock = 32335860
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.AddSubGraph,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getAddSubGraphList with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.AddSubGraph,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getBlockChannelEvents test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 32538597
    const toBlock = 32538599
    const response = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.ChannelBlocked,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getBlockChannelEvents with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.ChannelBlocked,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getChannelBlockList test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 32538597
    const toBlock = 32538599
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.ChannelBlocked,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getChannelBlockList with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.ChannelBlocked,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getAddDelegateEvents test', async function () {
    const contract = await getCommunicatorContract()
    const fromBlock = 31944160
    const toBlock = 31944180
    const response = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.AddDelegate,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getAddDelegateEvents with no data test', async function () {
    const contract = await getCommunicatorContract()
    const fromBlock = 1
    const toBlock = 1
    const response = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.AddDelegate,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getAddDelegateList test', async function () {
    const contract = await getCommunicatorContract()
    const fromBlock = 31944160
    const toBlock = 31944180
    const response = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.AddDelegate,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.not.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getAddDelegateList with no data test', async function () {
    const contract = await getCommunicatorContract()
    const fromBlock = 1
    const toBlock = 1
    const response = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.AddDelegate,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getChannelDeactivationEvents with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const response = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.DeactivateChannel,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getChannelDeactivationList with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const response = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.DeactivateChannel,
      fromBlock,
      toBlock,
      false
    )
    expect(response).to.be.an('object')
    expect(response).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getChannelReactivationEvents with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.ReactivateChannel,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getChannelReactivationList with no data test', async function () {
    const contract = await getCoreContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.ReactivateChannel,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getRemoveDelegateEvents with no data test', async function () {
    const contract = await getCommunicatorContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEvents(
      contract.contract,
      EventType.RemoveDelegate,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })

  it('api/helpers/epnsAPIHelper :: epnsAPIHelper :: getRemoveDelegateList with no data test', async function () {
    const contract = await getCommunicatorContract()
    const fromBlock = 1
    const toBlock = 1
    const events = await epnsAPIHelper.getContractEventsList(
      contract.contract,
      EventType.RemoveDelegate,
      fromBlock,
      toBlock,
      false
    )
    expect(events).to.be.an('object')
    expect(events).to.be.an('object').that.is.empty
  })
})
