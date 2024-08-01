import { Container } from 'typedi'

import { convertCaipToAddress, isValidCAIP10Address } from '../../helpers/caipHelper'
import FeedsService from '../../services/feedsService'
export default class TargetEvents {
  io = null
  feeds = null
  feedsEvent = 'feed'
  spamEvent = 'spam'
  eachFeedEvent = 'userFeeds'
  eachSpamEvent = 'userSpamFeeds'
  page
  pageNumber

  constructor() {
    this.feeds = Container.get(FeedsService)
  }

  async sendTragetedFeeds(address: any, socketID: any) {
    const feedResponse = await this.feeds.getFeeds(address, this.page, this.pageNumber)
    feedResponse.feeds.map(
      (each) =>
        (each.sender = isValidCAIP10Address(each.sender)
          ? convertCaipToAddress(each.sender).result
          : each.sender)
    )
    this.io.to(socketID).emit(this.feedsEvent, feedResponse)
  }

  async sendTargetedSpam(address: any, socketID: any) {
    const feedResponse = await this.feeds.getSpamFeeds(address, this.page, this.pageNumber)
    feedResponse.feeds.map(
      (each) =>
        (each.sender = isValidCAIP10Address(each.sender)
          ? convertCaipToAddress(each.sender).result
          : each.sender)
    )
    this.io.to(socketID).emit(this.spamEvent, feedResponse)
  }

  async sendSingleTargetedFeed(socketID: any, feedResponse: any) {
    feedResponse.sender = isValidCAIP10Address(feedResponse.sender)
      ? convertCaipToAddress(feedResponse.sender).result
      : feedResponse.sender
    this.io.to(socketID).emit(this.eachFeedEvent, feedResponse)
  }

  async sendSingleTargetedSpam(socketID: any, feedResponse: any) {
    feedResponse.sender = isValidCAIP10Address(feedResponse.sender)
      ? convertCaipToAddress(feedResponse.sender).result
      : feedResponse.sender
    this.io.to(socketID).emit(this.eachSpamEvent, feedResponse)
  }
}
