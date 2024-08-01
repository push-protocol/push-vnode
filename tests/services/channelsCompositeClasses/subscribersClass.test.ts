import chai from 'chai'
import chaiHttp from 'chai-http'
import 'mocha'
import { Container } from 'typedi'
import { startServer, stopServer } from '../../../src/appInit'
import subscribersClass from '../../../src/services/channelsCompositeClasses/subscribersClass'
import channelsClass from '../../../src/services/channelsCompositeClasses/channelsClass'
const BLOCKCHAIN_TYPE: Array<String> = ['ETH_TEST_KOVAN', 'POLYGON_TEST_MUMBAI']

var uuid = require('uuid')

chai.use(chaiHttp)
chai.should()
const expect = chai.expect

describe.skip('api/services/channelscompositeClasses/subscribersClass :: subscribersClass test', function () {
  before(async () => await startServer('error', true, 1))
  after(async () => await stopServer())

  it('api/services/channelscompositeClasses/subscribersClass :: subscribersClass :: subscribeTo test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const subscriberClass = Container.get(subscribersClass)
    const channelType = 2
    const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d'
    const channelClass = Container.get(channelsClass)
    const signature =
      '0x85ac85d8e5ebb986ea5eced6519eeefabdc46873dac1884a143561f9fb9190a73b7ea1d19f5f0620dae6c45b7ee18d17a1f80c0b059c44f677123e2b531752af1b'
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await subscriberClass.unsubscribeTo(channel, subscriber)
      const response = await subscriberClass.subscribeTo(channel, subscriber, signature)
      expect(response).to.have.any.keys('success')
      expect(response.success).to.be.equals(1)
    } catch (err) {
      console.error('🔥  error in subscribeTo test: %s', err)
      expect(err).to.be.null
    } finally {
      await subscriberClass.unsubscribeTo(channel, subscriber)
      await channelClass._deleteChannel(channel, identity)
    }
  })

  // Uncomment once buggy code is fixed

  /*it('api/services/channelscompositeClasses/subscribersClass :: subscribersClass :: isUserSubscribed test', async function() {
        const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
        const identity =
            '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
        const subscriberClass = Container.get(subscribersClass);
        const channelType = 2;
        const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d';
        const channelClass = Container.get(channelsClass);
        const signature = '0x85ac85d8e5ebb986ea5eced6519eeefabdc46873dac1884a143561f9fb9190a73b7ea1d19f5f0620dae6c45b7ee18d17a1f80c0b059c44f677123e2b531752af1b';
        try {
            await channelClass._deleteChannel(channel, identity);
            await channelClass.addChannel(channel, channelType, identity);
            await subscriberClass.unsubscribeTo(channel, subscriber);
            await subscriberClass.subscribeTo(channel, subscriber, signature);
            const response = await subscriberClass.isUserSubscribed(channel, subscriber, "ETH_TEST_KOVAN");
            expect(response).to.be.equals(true);
        } catch (err) {
            console.error('🔥  error in isUserSubscribed test: %s', err);
            expect(err).to.be.null;
        } finally {
            await subscriberClass.unsubscribeTo(channel, subscriber);
            await channelClass._deleteChannel(channel, identity);
        }
    });

    it('api/services/channelscompositeClasses/subscribersClass :: subscribersClass :: unsubscribeTo test', async function() {
        const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
        const identity =
            '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
        const subscriberClass = Container.get(subscribersClass);
        const channelType = 2;
        const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d';
        const channelClass = Container.get(channelsClass);
        const signature = '0x85ac85d8e5ebb986ea5eced6519eeefabdc46873dac1884a143561f9fb9190a73b7ea1d19f5f0620dae6c45b7ee18d17a1f80c0b059c44f677123e2b531752af1b';
        try {
            await channelClass._deleteChannel(channel, identity);
            await channelClass.addChannel(channel, channelType, identity);
            await subscriberClass.unsubscribeTo(channel, subscriber);
            await subscriberClass.subscribeTo(channel, subscriber, signature);
            const response = await subscriberClass.unsubscribeTo(channel, subscriber);
            expect(response).to.have.any.keys('success');
            expect(response.success).to.be.equals(1);
        } catch (err) {
            console.error('🔥  error in unsubscribeTo test: %s', err);
            expect(err).to.be.null;
        } finally {
            await subscriberClass.unsubscribeTo(channel, subscriber);
            await channelClass._deleteChannel(channel, identity);
        }
    });*/

  it('api/services/channelscompositeClasses/subscribersClass :: subscribersClass :: isUserSubscribed test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const subscriberClass = Container.get(subscribersClass)
    const channelType = 2
    const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d'
    const channelClass = Container.get(channelsClass)
    const signature =
      '0x85ac85d8e5ebb986ea5eced6519eeefabdc46873dac1884a143561f9fb9190a73b7ea1d19f5f0620dae6c45b7ee18d17a1f80c0b059c44f677123e2b531752af1b'
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await subscriberClass.unsubscribeTo(channel, subscriber)
      await subscriberClass.subscribeTo(channel, subscriber, signature)
      await subscriberClass.unsubscribeTo(channel, subscriber)
      const response = await subscriberClass.isUserSubscribed(channel, subscriber, 'ETH_TEST_KOVAN')
      expect(response).to.be.equals(false)
    } catch (err) {
      console.error('🔥  error in isUserSubscribed test: %s', err)
      expect(err).to.be.null
    } finally {
      await subscriberClass.unsubscribeTo(channel, subscriber)
      await channelClass._deleteChannel(channel, identity)
    }
  })

  // Uncomment once buggy code is fixed
  /*it('api/services/channelscompositeClasses/subscribersClass :: subscribersClass :: getSubscribers test', async function() {
        const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2';
        const identity =
            '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751';
        const subscriberClass = Container.get(subscribersClass);
        const channelType = 2;
        const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d';
        const channelClass = Container.get(channelsClass);
        const signature = '0x85ac85d8e5ebb986ea5eced6519eeefabdc46873dac1884a143561f9fb9190a73b7ea1d19f5f0620dae6c45b7ee18d17a1f80c0b059c44f677123e2b531752af1b';
        try {
            await channelClass._deleteChannel(channel, identity);
            await channelClass.addChannel(channel, channelType, identity);
            await subscriberClass.unsubscribeTo(channel, subscriber);
            await subscriberClass.subscribeTo(channel, subscriber, signature);
            await subscriberClass.unsubscribeTo(channel, subscriber);
            const response = await subscriberClass.getSubscribers(channel, 42);
            console.log(response)
            expect(response).to.have.any.keys('success');
            expect(response).to.have.any.keys('subscribers');
            expect(response.success).to.be.equals(1);
            expect(response.subscribers).to.contain(subscriber.toLowerCase());
        } catch (err) {
            console.error('🔥  error in getSubscribers test: %s', err);
            expect(err).to.be.null;
        } finally {
            await subscriberClass.unsubscribeTo(channel, subscriber);
            await channelClass._deleteChannel(channel, identity);
        }
    });*/

  it('api/services/channelscompositeClasses/subscribersClass :: subscribersClass :: getSubscribers with no data test', async function () {
    const channel = '0xf57a0B47aE01AaA88C9781F6b28D74AB774822k2'
    const identity =
      '0x312b516d6350456b323758757a6a326d38597075506f536e783269685a536665394e7639736f4c61527673366e714751'
    const subscriberClass = Container.get(subscribersClass)
    const channelType = 2
    const subscriber = '0x37510c9383690e1b8f99c57ec48a57ab6633a49d'
    const channelClass = Container.get(channelsClass)
    const signature =
      '0x85ac85d8e5ebb986ea5eced6519eeefabdc46873dac1884a143561f9fb9190a73b7ea1d19f5f0620dae6c45b7ee18d17a1f80c0b059c44f677123e2b531752af1b'
    try {
      await channelClass._deleteChannel(channel, identity)
      await channelClass.addChannel(channel, channelType, identity)
      await subscriberClass.unsubscribeTo(channel, subscriber)
      await subscriberClass.subscribeTo(channel, subscriber, signature)
      await subscriberClass.unsubscribeTo(channel, subscriber)
      const response = await subscriberClass.getSubscribers(channel, 42)
      expect(response).to.have.any.keys('success')
      expect(response).to.have.any.keys('subscribers')
      expect(response.success).to.be.equals(1)
      expect(response.subscribers).to.not.contain(subscriber.toLowerCase())
    } catch (err) {
      console.error('🔥  error in getSubscribers with no data test: %s', err)
      expect(err).to.be.null
    } finally {
      await subscriberClass.unsubscribeTo(channel, subscriber)
      await channelClass._deleteChannel(channel, identity)
    }
  })
})
