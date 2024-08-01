import chai from 'chai'
const chaiAsPromised = require('chai-as-promised')

import chaiHttp from 'chai-http'
import 'mocha'
import { Container } from 'typedi'

import { startServer, stopServer } from '../../../src/appInit'
const axios = require('axios').default
import channelsClass from '../../../src/services/channelsCompositeClasses/channelsClass'
import subscribersClass from '../../../src/services/channelsCompositeClasses/subscribersClass'

var uuid = require('uuid')
var readline = require('readline')

chai.use(chaiHttp)
chai.use(chaiAsPromised)
chai.should()
const expect = chai.expect

const BASE_API_URL = 'http://[::1]:4000/apis'
const V1_RELATIVE_URL = `v1/channels`
const V1_BASE_URL = `${BASE_API_URL}/${V1_RELATIVE_URL}`

describe.skip('Testing :: api > routes > channels', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  describe(`Testing :: api > routes > channels :: /${V1_RELATIVE_URL}/`, function () {
    it(`should return http code 200`, async function () {
      const response = await axios.get(V1_BASE_URL + '/', {})
      expect(response).to.have.status(200)
    })

    it(`should return 10 channels (if sync is done)`, async function () {
      const response = await axios.get(V1_BASE_URL + '/', {})
      expect(response.data.count).equal(10)
    })

    it(`should follow pagination`, async function () {
      const response = await axios.get(V1_BASE_URL + '/', {
        params: {
          page: '2'
        }
      })
      expect(response).to.have.status(200)
    })

    it(`should return no result when page limit exceeds`, async function () {
      const response = await axios.get(V1_BASE_URL + '/', {
        params: {
          page: '500000'
        }
      })
      expect(response.data.results).to.be.empty
    })

    it(`should follow limit`, async function () {
      const response = await axios.get(V1_BASE_URL + '/', {
        params: {
          limit: '5'
        }
      })
      expect(response.data.count).equal(5)
    })

    it(`should follow min limit`, async function () {
      try {
        await axios.get(V1_BASE_URL + '/', {
          params: {
            limit: '0'
          }
        })
      } catch (err) {
        expect(err.response.data.message).to.equal('Validation failed')
      }
    })

    it(`should follow max limit`, async function () {
      try {
        await axios.get(V1_BASE_URL + '/', {
          params: {
            limit: '31'
          }
        })
      } catch (err) {
        expect(err.response.data.message).to.equal('Validation failed')
      }
    })
  })

  describe(`Testing :: api > routes > channels :: /${V1_RELATIVE_URL}/search/`, function () {
    it(`should return search result for 0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4`, async function () {
      const response = await axios.get(V1_BASE_URL + '/search', {
        params: {
          query: '0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4'
        }
      })
      expect(response.data.channels[0].channel).to.equal(
        '0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4'
      )
    })

    it(`should return search result for E`, async function () {
      const response = await axios.get(V1_BASE_URL + '/search', {
        params: {
          query: 'E'
        }
      })
      expect(response.data.count).to.be.greaterThanOrEqual(1)
    })

    it(`should return nothing for fake search (eip155:80001:0x1)`, async function () {
      try {
        await axios.get(V1_BASE_URL + '/search', {
          params: {
            search: 'eip155:80001:0x1'
          }
        })
      } catch (err) {
        expect(err.response.status).to.equal(400)
      }
    })
  })

  describe(`Testing :: api > routes > channels :: /${V1_RELATIVE_URL}/subscribe/`, function () {
    it('should throw error for not following caip standard', async function () {
      const channel = '0xD8634C39BBFd4033c0d3289C4515275102423681'
      const aliasAddress = '0xD8634C39BBFd4033c0d3289C4515275102423681'
      const channelType = 2
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const BLOCKCHAIN = 'ETH_TEST_KOVAN'
      const subscriber = '0xD8634C39BBFd4033c0d3289C4515275102423681'
      const signature =
        '0xebd397ba04549d5064046faa6f83397d966379d9c033042f2a8dfb66867f5e687d6f5b71176ff88b3665b9af892727806bdfdbe12f9be52b2cb4045f3feb52f81b'
      const message = {
        channel,
        subscriber,
        action: 'Subscribe'
      }
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      await subscriberClass._deleteSubscriber(channel, subscriber)
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._populateChannelData(
        channel,
        'channel_name',
        'channel_info',
        'channel_url',
        'channel_icon',
        aliasAddress,
        BLOCKCHAIN
      )
      try {
        await axios.post(V1_BASE_URL + '/' + channel + '/subscribe/', { signature, message })
      } catch (err) {
        expect(err.response.status).to.equal(403)
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, subscriber)
      }
    })

    it('should successfully subscribe a user', async function () {
      const channel = 'eip155:42:0xD8634C39BBFd4033c0d3289C4515275102423681'
      const aliasAddress = 'eip155:42:0xD8634C39BBFd4033c0d3289C4515275102423681'
      const channelType = 2
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const BLOCKCHAIN = 'ETH_TEST_KOVAN'
      const subscriber = 'eip155:42:0xD8634C39BBFd4033c0d3289C4515275102423681'
      const signature =
        '0xebd397ba04549d5064046faa6f83397d966379d9c033042f2a8dfb66867f5e687d6f5b71176ff88b3665b9af892727806bdfdbe12f9be52b2cb4045f3feb52f81b'
      const message = {
        channel,
        subscriber,
        action: 'Subscribe'
      }
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      await subscriberClass._deleteSubscriber(channel.split(':')[2], subscriber.split(':')[2])
      await channelClass._deleteChannel(channel.split(':')[2], identity)
      await channelClass.addChannel(channel.split(':')[2], channelType, identity)
      await channelClass._populateChannelData(
        channel,
        'channel_name',
        'channel_info',
        'channel_url',
        'channel_icon',
        aliasAddress,
        BLOCKCHAIN
      )
      try {
        const response = await axios.post(V1_BASE_URL + '/' + channel + '/subscribe/', {
          signature,
          message
        })
        expect(response).to.have.status(204)
      } catch (err) {
        console.error('🔥  error in /subscribe/ test: %o', err)
        expect(err).to.be.null
      } finally {
        await channelClass._deleteChannel(channel.split(':')[2], identity)
        await subscriberClass._deleteSubscriber(channel.split(':')[2], subscriber.split(':')[2])
      }
    })
  })

  describe(`Testing :: api > routes > channels :: /${V1_RELATIVE_URL}/:channelsInCAIP/unsubscribe/`, function () {
    it('should throw error for not following caip standard', async function () {
      const channel = '0xD8634C39BBFd4033c0d3289C4515275102423681'
      const aliasAddress = '0xD8634C39BBFd4033c0d3289C4515275102423681'
      const channelType = 2
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const BLOCKCHAIN = 'ETH_TEST_KOVAN'
      const unsubscriber = '0xD8634C39BBFd4033c0d3289C4515275102423681'
      const signature =
        '0xa8f961fc36436760ccac77c20f602153c4f44e3db70e5c5fc9a0bf5cff9ecd4924846740714acb6257ed0e0074a32f0872266eeb9d22cb5a92a8ac4987475f361b'
      const message = {
        channel,
        unsubscriber,
        action: 'Unsubscribe'
      }
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await channelClass._populateChannelData(
        channel,
        'channel_name',
        'channel_info',
        'channel_url',
        'channel_icon',
        aliasAddress,
        BLOCKCHAIN
      )
      try {
        await axios.post(V1_BASE_URL + '/' + channel + '/unsubscribe/', { signature, message })
      } catch (err) {
        expect(err.response.status).to.equal(403)
      } finally {
        await channelClass._deleteChannel(channel, identity)
        await subscriberClass._deleteSubscriber(channel, unsubscriber)
      }
    })

    it('should successfully unsubscribe a user', async function () {
      const channel = 'eip155:42:0xD8634C39BBFd4033c0d3289C4515275102423681'
      const aliasAddress = 'eip155:42:0xD8634C39BBFd4033c0d3289C4515275102423681'
      const channelType = 2
      const identity =
        '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
      const BLOCKCHAIN = 'ETH_TEST_KOVAN'
      const unsubscriber = 'eip155:42:0xD8634C39BBFd4033c0d3289C4515275102423681'
      const signature =
        '0xa8f961fc36436760ccac77c20f602153c4f44e3db70e5c5fc9a0bf5cff9ecd4924846740714acb6257ed0e0074a32f0872266eeb9d22cb5a92a8ac4987475f361b'
      const message = {
        channel,
        unsubscriber,
        action: 'Unsubscribe'
      }
      const channelClass = Container.get(channelsClass)
      const subscriberClass = Container.get(subscribersClass)
      await subscriberClass.subscribeTo(
        channel.split(':')[2],
        aliasAddress.split(':')[2],
        unsubscriber.split(':')[2],
        42,
        signature
      )
      await channelClass._deleteChannel(channel.split(':')[2], identity)
      await channelClass.addChannel(channel.split(':')[2], channelType, identity)
      await channelClass._populateChannelData(
        channel,
        'channel_name',
        'channel_info',
        'channel_url',
        'channel_icon',
        aliasAddress,
        BLOCKCHAIN
      )
      try {
        const response = await axios.post(V1_BASE_URL + '/' + channel + '/unsubscribe/', {
          signature,
          message
        })
        expect(response).to.have.status(204)
      } catch (err) {
        console.error('🔥  error in /alias/ test: %o', err)
        expect(err).to.be.null
      } finally {
        await channelClass._deleteChannel(channel.split(':')[2], identity)
        await subscriberClass._deleteSubscriber(channel.split(':')[2], unsubscriber.split(':')[2])
      }
    })
  })

  // it('api/routes/channels :: /apis/channels/unsubscribe_offchain :: unsubscribe offchain to channel test', async function() {
  //   const channel = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const subscriber = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const contractAddress = '0x87da9Af1899ad477C67FeA31ce89c1d2435c77DC';
  //   const channelType = 2;
  //   const chainId = 42;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);

  //   const message = {
  //     channel: channel,
  //     unsubscriber: subscriber,
  //     action: 'Unsubscribe',
  //   };

  //   const signature =
  //     '0xa4d05c38d256ed409ec166c582edf39bed3186e2f096041a13d19185f28f3cb72b22f0320cadd777f91f1acbc56fe146f8f7fa40b675eb2245393c6846b1e2d51b';

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/unsubscribe_offchain', {
  //       signature: signature,
  //       message: message,
  //       op: 'write',
  //       chainId: chainId,
  //       contractAddress: contractAddress,
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.equals(true);
  //   } catch (err) {
  //     console.error('🔥  error in subscribe offchain to channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/unsubscribe_offchain :: unsubscribe offchain to channel test with invalid signature', async function() {
  //   const channel = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const subscriber = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714752';
  //   const contractAddress = '0x87da9Af1899ad477C67FeA31ce89c1d2435c77DC';
  //   const channelType = 2;
  //   const chainId = 42;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);

  //   const message = {
  //     channel: channel,
  //     unsubscriber: subscriber,
  //     action: 'Unsubscribe',
  //   };

  //   const signature =
  //     '0xa4d05c38d256ed409ec166c582edf39bed3186e2f096041a13d19185f28f3cb72b22f0320cadd777f91f1acbc56fe146f8f7fa40b675eb2245393c6846b1e2d51b';

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/unsubscribe_offchain', {
  //       signature: signature,
  //       message: message,
  //       op: 'write',
  //       chainId: 42,
  //       contractAddress: contractAddress,
  //     });
  //   } catch (err) {
  //     expect(err).to.be.not.null;
  //   } finally {
  //     await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/add :: add new channel test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/add', {
  //       channel: channel,
  //       channelType: channelType,
  //       identity: identity,
  //     });
  //     expect(response).to.have.status(201);
  //   } catch (err) {
  //     console.error('🔥  error in create channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get :: get channel test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get', {
  //       channel: channel,
  //     });
  //     expect(response).to.have.status(201);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.include({ channel: channel });
  //   } catch (err) {
  //     console.error('🔥  error in get channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/update :: update channel test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/update', {
  //       channel: channel,
  //       identity: identity,
  //     });
  //     expect(response).to.have.status(201);
  //   } catch (err) {
  //     console.error('🔥  error in update channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/subscribe :: subscribe to channel test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const channelType = 2;

  //   const channelService = Container.get(channelsClass);
  //   await channelService._deleteChannel(channel, identity);
  //   await channelService.addChannel(channel, channelType, identity);
  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/subscribe', {
  //       channel: channel,
  //       subscriber: subscriber,
  //     });
  //     expect(response).to.have.status(201);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.include({ success: true });
  //   } catch (err) {
  //     console.error('🔥  error in subscribe to channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelService._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/subscribe_offchain :: subscribe offchain to channel test', async function() {
  //   const channel = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const subscriber = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const contractAddress = '0x87da9Af1899ad477C67FeA31ce89c1d2435c77DC';
  //   const channelType = 2;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);

  //   const message = {
  //     channel: channel,
  //     subscriber: subscriber,
  //     action: 'Subscribe',
  //   };

  //   const signature =
  //     '0x85ac85d8e5ebb986ea5eced6519eeefabdc46873dac1884a143561f9fb9190a73b7ea1d19f5f0620dae6c45b7ee18d17a1f80c0b059c44f677123e2b531752af1b';

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/subscribe_offchain', {
  //       signature: signature,
  //       message: message,
  //       op: 'write',
  //       chainId: 42,
  //       contractAddress: contractAddress,
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.equals(true);
  //   } catch (err) {
  //     console.error('🔥  error in subscribe offchain to channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/subscribe_offchain :: subscribe offchain to channel test with invalid signature', async function() {
  //   const channel = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const subscriber = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const contractAddress = '0x87da9Af1899ad477C67FeA31ce89c1d2435c77DC';
  //   const channelType = 2;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);

  //   const message = {
  //     channel: channel,
  //     subscriber: subscriber,
  //     action: 'Subscribe',
  //   };

  //   const signature =
  //     '0x85ac85d8e5ebb986ea5eced6519eeefabdc46873dac1884a143561f9fb9190a73b7ea1d19f5f0620dae6c45b7ee18d17a1f80c0b059c44f677123e2b531752af1c';

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/subscribe_offchain', {
  //       signature: signature,
  //       message: message,
  //       op: 'write',
  //       chainId: 42,
  //       contractAddress: contractAddress,
  //     });
  //   } catch (err) {
  //     expect(err).to.be.not.null;
  //   } finally {
  //     await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/unsubscribe_offchain :: unsubscribe offchain to channel test', async function() {
  //   const channel = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const subscriber = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const contractAddress = '0x87da9Af1899ad477C67FeA31ce89c1d2435c77DC';
  //   const channelType = 2;
  //   const chainId = 42;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);

  //   const message = {
  //     channel: channel,
  //     unsubscriber: subscriber,
  //     action: 'Unsubscribe',
  //   };

  //   const signature =
  //     '0xa4d05c38d256ed409ec166c582edf39bed3186e2f096041a13d19185f28f3cb72b22f0320cadd777f91f1acbc56fe146f8f7fa40b675eb2245393c6846b1e2d51b';

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/unsubscribe_offchain', {
  //       signature: signature,
  //       message: message,
  //       op: 'write',
  //       chainId: chainId,
  //       contractAddress: contractAddress,
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.equals(true);
  //   } catch (err) {
  //     console.error('🔥  error in subscribe offchain to channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/unsubscribe_offchain :: unsubscribe offchain to channel test with invalid signature', async function() {
  //   const channel = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const subscriber = '0x4D0c6Eab977677c7790d3707842Df2780aF03C51';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714752';
  //   const contractAddress = '0x87da9Af1899ad477C67FeA31ce89c1d2435c77DC';
  //   const channelType = 2;
  //   const chainId = 42;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);

  //   const message = {
  //     channel: channel,
  //     unsubscriber: subscriber,
  //     action: 'Unsubscribe',
  //   };

  //   const signature =
  //     '0xa4d05c38d256ed409ec166c582edf39bed3186e2f096041a13d19185f28f3cb72b22f0320cadd777f91f1acbc56fe146f8f7fa40b675eb2245393c6846b1e2d51b';

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/unsubscribe_offchain', {
  //       signature: signature,
  //       message: message,
  //       op: 'write',
  //       chainId: 42,
  //       contractAddress: contractAddress,
  //     });
  //   } catch (err) {
  //     expect(err).to.be.not.null;
  //   } finally {
  //     await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/is_user_subscribed :: is user subscribed to channel test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const channelType = 2;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //   await channelService.subscribe(channel, subscriber, BLOCKCHAIN);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/is_user_subscribed', {
  //       channel: channel,
  //       subscriber: subscriber,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.equal(true);
  //   } catch (err) {
  //     console.error('🔥  error in is user subscribed to channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/is_user_subscribed :: is user not subscribed to channel test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const channelType = 2;

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   try {
  //     // Here random subscriber is generated to check it is not part of channel
  //     const subscriber = uuid.v4();
  //     const response = await axios.post(CHANNEL_BASE_URL + '/is_user_subscribed', {
  //       channel: channel,
  //       subscriber: subscriber,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.equal(false);
  //   } catch (err) {
  //     console.error('🔥  error in is user not subscribed to channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/unsubscribe :: unsubscribe to channel test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const channelType = 2;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.subscribe(channel, subscriber, BLOCKCHAIN);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/unsubscribe', {
  //       channel: channel,
  //       subscriber: subscriber,
  //     });
  //     expect(response).to.have.status(201);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.include({});
  //   } catch (err) {
  //     console.error('🔥  error in unsubscribe to channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_subscribers :: get_subscribers of channel test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const channelType = 2;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const channelService = Container.get(channelsService);
  //   await channelService.subscribe(channel, subscriber, BLOCKCHAIN);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_subscribers', {
  //       channel: channel,
  //       op: 'read',
  //     });

  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.include({ success: 1 });
  //     expect(response.data).to.have.any.keys('subscribers');
  //     expect(response.data.subscribers).to.be.an('array');
  //     expect(response.data.subscribers).to.include(subscriber);
  //   } catch (err) {
  //     console.error('🔥  error in get_subscribers of channel test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelService.unsubscribe(channel, subscriber, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_dai_to_push :: get_dai_to_push test', async function() {
  //   const value = 50;
  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_dai_to_push', {
  //       value: value,
  //     });

  //     expect(response).to.have.status(201);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.have.any.keys('response');
  //     expect(response.data.response).to.have.any.keys('data');
  //     expect(response.data.response.data).to.have.any.keys('amount');
  //     expect(response.data.response.data.amount).to.equal(value);
  //   } catch (err) {
  //     console.error('🔥  error in get_dai_to_push test: %s', err);
  //     expect(err).to.be.null;
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/fetch_channels :: fetch_channels test', async function() {
  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/fetch_channels', {
  //       page: 1,
  //       pageSize: 10,
  //       op: 'write',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.have.any.keys('results');
  //     expect(response.data).to.have.any.keys('count');
  //     expect(response.data.results).to.be.an('array');
  //     expect(response.data.count).to.be.an('number');
  //     expect(response.data.count).to.be.greaterThanOrEqual(0);
  //   } catch (err) {
  //     console.error('🔥  error in fetch_channels test: %s', err);
  //     expect(err).to.be.null;
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_channels_with_sub :: get_channels_with_subscribers test', async function() {
  //   try {
  //     const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_channels_with_sub', {
  //       address: channel,
  //       page: 1,
  //       pageSize: 10,
  //       blockchain: 42,
  //       op: 'read',
  //     });

  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.have.any.keys('channelsDetail');
  //     expect(response.data).to.have.any.keys('count');
  //     expect(response.data.channelsDetail).to.be.an('array');
  //     expect(response.data.count).to.be.an('number');
  //     expect(response.data.count).to.be.greaterThanOrEqual(0);
  //   } catch (err) {
  //     console.error('🔥  error in get_channels_with_sub test: %s', err);
  //     expect(err).to.be.null;
  //   }
  // });

  // it('api/routes/channels :: /delegatee/add_delegate :: add_delegate test', async function() {
  //   const channelClass = Container.get(channelsClass);
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const delegate = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const channelType = 2;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   try {
  //     await channelClass._deleteChannel(channel, identity);
  //     await channelClass.addChannel(channel, channelType, identity);
  //     const response = await axios.post(CHANNEL_BASE_URL + '/delegatee/add_delegate', {
  //       channelAddress: channel,
  //       delegateeAddress: delegate,
  //       blockchain: BLOCKCHAIN,
  //     });

  //     expect(response).to.have.status(200);
  //     expect(response.data).to.have.any.keys('channelAddress');
  //     expect(response.data).to.have.any.keys('delegateeAddress');
  //     expect(response.data.channelAddress).to.equal(channel);
  //     expect(response.data.delegateeAddress).to.equal(delegate);
  //   } catch (err) {
  //     console.error('🔥  error in add_delegate test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /delegatee/get_delegate :: get_delegate test', async function() {
  //   const channelClass = Container.get(channelsClass);
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const delegate = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const channelType = 2;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   try {
  //     await channelClass._deleteChannel(channel, identity);
  //     await channelClass.addChannel(channel, channelType, identity);
  //     await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN);
  //     await channelClass.setDelegateeAddress(channel, delegate, BLOCKCHAIN);

  //     const response = await axios.post(CHANNEL_BASE_URL + '/delegatee/get_delegate', {
  //       channelAddress: channel,
  //       blockchain: BLOCKCHAIN,
  //     });

  //     expect(response).to.have.status(200);
  //     expect(response.data).to.have.any.keys('delegateAddress');
  //     expect(response.data.delegateAddress).to.be.an('array');
  //     expect(response.data.delegateAddress).to.include(delegate.toLowerCase());
  //   } catch (err) {
  //     console.error('🔥  error in get_delegate test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /delegatee/get_channels :: get_delegate_channels test', async function() {
  //   const channelClass = Container.get(channelsClass);
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const delegate = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const channelType = 2;
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   try {
  //     await channelClass._deleteChannel(channel, identity);
  //     await channelClass.addChannel(channel, channelType, identity);
  //     await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN);
  //     await channelClass.setDelegateeAddress(channel, delegate, BLOCKCHAIN);

  //     const response = await axios.post(CHANNEL_BASE_URL + '/delegatee/get_channels', {
  //       delegateAddress: delegate,
  //       blockchain: BLOCKCHAIN,
  //       op: 'read',
  //     });

  //     expect(response).to.have.status(200);
  //     expect(response.data).to.have.any.keys('channelOwners');
  //     expect(response.data.channelOwners).to.be.an('array');
  //     expect(response.data.channelOwners).to.include(channel);
  //     expect(response.data.length).to.be.an('number');
  //     expect(response.data.length).to.be.greaterThanOrEqual(0);
  //   } catch (err) {
  //     console.error('🔥  error in get_delegate_channels test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass.removeDelegateeAddress(channel, delegate, BLOCKCHAIN);
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/check_update_alias :: check and update alias test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/check_update_alias', {
  //       ethAddress: channel,
  //       aliasAddress: aliasAddress,
  //       aliasChainId: 8001,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //   } catch (err) {
  //     console.error('🔥  error in check_update_alias test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_eth_address :: get_eth_address verified alias test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);
  //   await channelClass._populateChannelData(
  //     channel,
  //     'channel_name',
  //     'channel_info',
  //     'channel_url',
  //     'channel_icon',
  //     aliasAddress,
  //     BLOCKCHAIN
  //   );

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_eth_address', {
  //       aliasAddress: aliasAddress,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).to.have.any.keys('ethAddress');
  //     expect(response.data.ethAddress).to.equal(channel);
  //   } catch (err) {
  //     console.error('🔥  error in get_eth_address verified alias test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_eth_address :: get_eth_address unverified alias test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_eth_address', {
  //       aliasAddress: aliasAddress,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).to.have.any.keys('ethAddress');
  //     expect(response.data.ethAddress).to.equal(null);
  //   } catch (err) {
  //     console.error('🔥  error in get_eth_address unverified alias test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_alias_details :: get_alias_details test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   const alias = Container.get(Alias);
  //   await alias.checkAndUpdateAlias(channel, channelType, identity);

  //   await channelClass._populateChannelData(
  //     channel,
  //     'channel_name',
  //     'channel_info',
  //     'channel_url',
  //     'channel_icon',
  //     aliasAddress,
  //     BLOCKCHAIN
  //   );

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_alias_details', {
  //       channel: channel,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).to.have.any.keys('aliasAddress');
  //     expect(response.data.aliasAddress).to.equal(aliasAddress);
  //   } catch (err) {
  //     console.error('🔥  error in get_alias_details test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/batch_process_alias :: batch_process_alias test', async function() {
  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/batch_process_alias');
  //     expect(response).to.have.status(200);
  //   } catch (err) {
  //     console.error('🔥  error in batch_process_alias test: %s', err);
  //     expect(err).to.be.null;
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_alias_verification_status :: get_alias_verification_status for unverified alias test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_alias_verification_status', {
  //       aliasAddress: aliasAddress,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).to.include({ success: true, status: false });
  //   } catch (err) {
  //     console.error('🔥  error in get_alias_verification_status for unverified test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_alias_verification_status :: get_alias_verification_status for verified alias test', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);
  //   await channelClass._populateChannelData(
  //     channel,
  //     'channel_name',
  //     'channel_info',
  //     'channel_url',
  //     'channel_icon',
  //     aliasAddress,
  //     BLOCKCHAIN
  //   );
  //   await channelClass._verifyChannelAlias(channel);

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_alias_verification_status', {
  //       aliasAddress: aliasAddress,
  //       op: 'read',
  //     });

  //     expect(response).to.have.status(200);
  //     expect(response.data).to.include({ success: true, status: true });
  //   } catch (err) {
  //     console.error('🔥  error in get_alias_verification_status for verified test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/get_all_subgraph :: get_all_subgraph test', async function() {
  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/get_all_subgraph');
  //     expect(response).to.have.status(201);
  //   } catch (err) {
  //     console.error('🔥  error in get_all_subgraph test: %s', err);
  //     expect(err).to.be.null;
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/search :: search channels test with random query', async function() {
  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/search', {
  //       query: uuid.v4(),
  //       page: 1,
  //       pageSize: 10,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.have.any.keys('channels');
  //     expect(response.data).to.have.any.keys('count');
  //     expect(response.data.channels).to.be.an('array');
  //     expect(response.data.count).to.be.an('number');
  //     expect(response.data.count).to.be.greaterThanOrEqual(0);
  //   } catch (err) {
  //     console.error('🔥  error in search channels test with random query test: %s', err);
  //     expect(err).to.be.null;
  //   }
  // });

  // it('api/routes/channels :: /apis/channels/search ::  search channels test with channel name as query', async function() {
  //   const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
  //   const aliasAddress = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k1';
  //   const channelType = 2;
  //   const identity =
  //     '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
  //   const BLOCKCHAIN = 'ETH_TEST_KOVAN';
  //   const channelName = uuid.v4();

  //   const channelClass = Container.get(channelsClass);
  //   await channelClass._deleteChannel(channel, identity);
  //   await channelClass.addChannel(channel, channelType, identity);
  //   await channelClass._populateChannelData(
  //     channel,
  //     channelName,
  //     'channel_info',
  //     'channel_url',
  //     'channel_icon',
  //     aliasAddress,
  //     BLOCKCHAIN
  //   );

  //   try {
  //     const response = await axios.post(CHANNEL_BASE_URL + '/search', {
  //       query: channelName,
  //       page: 1,
  //       pageSize: 10,
  //       op: 'read',
  //     });
  //     expect(response).to.have.status(200);
  //     expect(response.data).not.to.be.null;
  //     expect(response.data).to.have.any.keys('channels');
  //     expect(response.data).to.have.any.keys('count');
  //     expect(response.data.channels).to.be.an('array');
  //     expect(response.data.count).to.be.an('number');
  //     expect(response.data.count).to.be.greaterThanOrEqual(1);
  //   } catch (err) {
  //     console.error('🔥  error in search channels test with channel name as query test: %s', err);
  //     expect(err).to.be.null;
  //   } finally {
  //     await channelClass._deleteChannel(channel, identity);
  //   }
  // });
})
