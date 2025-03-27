import {Request, Response, NextFunction} from 'express';
import {EnvLoader} from "../../utilz/envLoader";
import {Container, Inject, Service} from "typedi";
import {RedisClient} from "../../services/messaging-common/redisClient";
import {Check} from "../../utilz/check";
import {WinstonUtil} from "../../utilz/winstonUtil";

@Service()
export class RateLimiter {

  @Inject()
  private redisCli: RedisClient

  private TX_LIMIT_PER_MINUTE_PER_IP = EnvLoader.getPropertyAsNumber("TX_LIMIT_PER_MINUTE_PER_IP", 10);
  private WINDOW_SECONDS = EnvLoader.getPropertyAsNumber("TX_LIMIT_WINDOW_SECONDS", 60);
  private log = WinstonUtil.newLog(RateLimiter);

  async checkLimitsForRpc(ip: string): Promise<boolean> {
    const redisKey = `rate_limit:${ip}`;
    const redisClient = Container.get(RedisClient).getClient();
    Check.notNull(redisClient, 'Redis client is null');
    try {
      const current = await redisClient.incr(redisKey);
      if (current === 1) {
        await redisClient.expire(redisKey, this.WINDOW_SECONDS);
      }
      if (current > this.TX_LIMIT_PER_MINUTE_PER_IP) {
        this.log.info(`Rate limiter: ${ip} exceeded limits, ${current} > ${this.TX_LIMIT_PER_MINUTE_PER_IP} per minute`);
        return false;
      }
      this.log.debug(`Rate limiter: ${ip} total calls ${current}`);
      return true;
    } catch (error) {
      return true;
    }
  }

}