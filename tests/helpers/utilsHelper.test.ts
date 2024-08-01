import * as utilsHelper from '../../src/helpers/utilsHelper'
import chai from 'chai'
import 'mocha'

chai.should()
const expect = chai.expect

describe('utilsHelper.ts', function () {
  describe('generateRandomWord', function () {
    it('Should generate word with correct lenght and pattern with no symbols', function () {
      const wordLength = 40
      const word = utilsHelper.generateRandomWord(wordLength, false)
      expect(word).to.have.lengthOf(wordLength)
      expect(word.match(/^[a-z0-9]+$/i) == null).to.equal(false)
    })

    it('Should generate word with correct lenght and pattern with symbols', function () {
      const wordLength = 50
      const word = utilsHelper.generateRandomWord(wordLength, true)
      expect(word).to.have.lengthOf(wordLength)
      expect(word.match(/^[a-z0-9]+$/i) == null).to.equal(true)
    })
  })

  describe('Test parseChannelSetting', function () {
    it('Should generate expanded notification setting', function () {
      const channelSetting = `4+1-0+2-1-15-10.5-99,5-0.5+2-0-20-5-50-1+1-1`
      const description = `test1+test2+test3+test4`
      const expandedSetting = utilsHelper.parseChannelSetting(channelSetting, description)
      // console.log(expandedSetting)
      expect(expandedSetting.length).to.be.equal(4)
    })

    it('Should generate for only boolean type', function () {
      const channelSetting = `5+1-0+1-0+1-1+1-1`
      const description = `test1+test2+test3+test4`
      const expandedSetting = utilsHelper.parseChannelSetting(channelSetting, description)
      // console.log(expandedSetting)
      expect(expandedSetting.length).to.be.equal(4)
    })

    it('Should generate for only slider type', function () {
      const channelSetting = `5+2-1-50-40-100-1+2-0-5000-2000000-10000000-10+2-1-5-2-10-0.5+2-\-20-\-50-10`
      const description = `test1+test2+test3`
      const expandedSetting = utilsHelper.parseChannelSetting(channelSetting, description)
      // console.log(expandedSetting)
      expect(expandedSetting.length).to.be.equal(3)
    })

    it('Should skip invalid setting option', function () {
      const channelSetting = `5+1-0+2-0-50-20-100-1+3-1+2-0-78-10-150`
      const description = `test1+test2+test3+test4`
      const expandedSetting = utilsHelper.parseChannelSetting(channelSetting, description)
      expect(expandedSetting.length).to.be.equal(3)
    })

    it('Should work for range type: enabled by default', function () {
      const channelSetting = `1+3-1-3-5-0-10-1`
      const description = `test1`
      const expandedSetting = utilsHelper.parseChannelSetting(channelSetting, description)
      console.log(expandedSetting)
      expect(expandedSetting.length).to.be.equal(1)
    })

    it('Should work for range type: disbaled by default', function () {
      const channelSetting = `1+3-0-3-5-0-10-1`
      const description = `test1`
      const expandedSetting = utilsHelper.parseChannelSetting(channelSetting, description)
      console.log(expandedSetting)
      expect(expandedSetting.length).to.be.equal(1)
    })

    it('Should work for range type: disbaled by default', function () {
      const channelSetting = `1+3-0-3-5-0-10-1.5`
      const description = `test1`
      const expandedSetting = utilsHelper.parseChannelSetting(channelSetting, description)
      console.log(expandedSetting)
      expect(expandedSetting.length).to.be.equal(1)
    })
  })

  describe('Test parseUserSetting', function () {
    it('Should generate expanded notification setting for user(boolean type)', function () {
      const userSetting = `1+1-1`
      const channelSetting = [
        {
          index: 1,
          type: 1,
          default: false,
          notificationDescription: 'xyz2'
        }
      ]
      const output = utilsHelper.parseUserSetting(userSetting, channelSetting)
      expect(output.length).to.be.equal(1)
      expect(output[0]).to.include.keys('user')
    })

    it('Should generate expanded notification setting for user(slider type)', function () {
      const userSetting = `1+1-1-70`
      const channelSetting = [
        {
          index: 1,
          type: 2,
          upperLimit: 100,
          lowerLimit: 20,
          default: 50,
          enabled: true,
          notificationDescription: 'abcd'
        }
      ]
      const output = utilsHelper.parseUserSetting(userSetting, channelSetting)
      expect(output.length).to.be.equal(1)
      expect(output[0]).to.include.keys('user')
      expect(output[0]).to.have.property('user', 70)
    })

    it('Should generate expanded notification setting for user(range type)', function () {
      const userSetting = `1+3-1-20-100`
      const channelSetting = [
        {
          index: 1,
          type: 3,
          upperLimit: 100,
          lowerLimit: 20,
          default: { lower: 25, upper: 50 },
          enabled: true,
          notificationDescription: 'abcd'
        }
      ]
      const output = utilsHelper.parseUserSetting(userSetting, channelSetting)
      expect(output.length).to.be.equal(1)
      expect(output[0]).to.include.keys('user')
    })

    it('Should generate expanded notification setting for user(range type)', function () {
      const userSetting = `2+2-1-10+3-1-20-100`
      const channelSetting = [
        {
          index: 1,
          type: 2,
          upperLimit: 100,
          lowerLimit: 1,
          default: 50,
          enabled: true,
          notificationDescription: 'abcd'
        },
        {
          index: 1,
          type: 3,
          upperLimit: 100,
          lowerLimit: 20,
          default: { lower: 25, upper: 50 },
          enabled: true,
          notificationDescription: 'efgh'
        }
      ]
      const output = utilsHelper.parseUserSetting(userSetting, channelSetting)
      expect(output.length).to.be.equal(2)
      expect(output[0]).to.include.keys('user')
    })

    it('Should generate expanded notification setting for user(slider type+boolean)', function () {
      const userSetting = `1+2-1-70+1-0`
      const channelSetting = [
        {
          index: 1,
          type: 2,
          upperLimit: 100,
          lowerLimit: 20,
          default: 50,
          enabled: false,
          notificationDescription: 'abcd'
        },
        {
          index: 2,
          type: 1,
          default: true,
          notificationDescription: 'xyz'
        }
      ]
      const output = utilsHelper.parseUserSetting(userSetting, channelSetting)
      expect(output.length).to.be.equal(2)
      expect(output[0]).to.include.keys('user')
      expect(output[0]).to.have.property('user', 70)
    })

    it('Should set use setting to default(boolean type)', function () {
      const userSetting = ''
      const channelSetting = [
        {
          index: 1,
          type: 1,
          default: false,
          notificationDescription: 'xyz2'
        }
      ]
      const output = utilsHelper.parseUserSetting(userSetting, channelSetting)
      expect(output.length).to.be.equal(1)
      expect(output[0]).to.include.keys('user')
      expect(output[0]).to.have.property('user', false)
    })

    it('Should set use setting to default(slider type)', function () {
      const userSetting = ''
      const channelSetting = [
        {
          index: 1,
          type: 2,
          upperLimit: 100,
          lowerLimit: 20,
          default: 50,
          enabled: true,
          notificationDescription: 'abcd'
        }
      ]
      const output = utilsHelper.parseUserSetting(userSetting, channelSetting)
      expect(output.length).to.be.equal(1)
      expect(output[0]).to.include.keys('user')
      expect(output[0]).to.have.property('user', 50)
    })

    it('Should not set setting for option not selected by user(slider type)', function () {
      const userSetting = '1+1-0'
      const channelSetting = [
        {
          index: 1,
          type: 2,
          upperLimit: 100,
          lowerLimit: 20,
          default: 50,
          notificationDescription: 'abcd'
        }
      ]
      const output = utilsHelper.parseUserSetting(userSetting, channelSetting)
      // console.log(output)
      expect(output.length).to.be.equal(1)
      expect(output[0]).to.include.keys('user')
    })
  })
})
