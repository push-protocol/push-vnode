import { Container } from 'typedi'

import logger from '../../loaders/logger'
import FeedsService from '../../services/feedsService'

const LIVE_FEED_EVENT = 'liveFeeds'
const HISTORICAL_FEED_EVENT = 'historicalFeeds'
const MESSAGE_BLOCK_EVENT = 'messageBlockEvent'
export default class FeedEvents {
  io = null
  feeds = null

  constructor() {
    this.feeds = Container.get(FeedsService)
  }

  async sendLiveFeeds(socketID: any, feed: any) {
    this.io.to(socketID).emit(LIVE_FEED_EVENT, feed)
  }
  async sendHistoricalFeeds(
    socketID: any,
    startTime: number,
    endTime: number,
    page: number,
    pageSize: number
  ) {
    const response = await this.feeds.getFeedsBetweenTimeRange(startTime, endTime, page, pageSize)
    logger.info(
      'Sending feeds between :: %o and %o, page :: %o, pageSize :: %o feedCount :: %o',
      new Date(Number(startTime)),
      new Date(Number(endTime)),
      page,
      pageSize,
      response['count']
    )
    this.io.to(socketID).emit(HISTORICAL_FEED_EVENT, response)
  }

  async sendMessageBlockEvent(socketID: any, obj: any) {
    this.io.to(socketID).emit(MESSAGE_BLOCK_EVENT, obj)
  }
}
