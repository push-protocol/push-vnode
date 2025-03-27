import {EnvLoader} from "./utilz/envLoader";

EnvLoader.loadEnvOrFail();

import express, {Application, Express, Router} from "express";
import 'reflect-metadata'
import {createServer, Server} from 'http'
import cors from 'cors'
import {WinstonUtil} from "./utilz/winstonUtil";
import * as http from "http";
import {Container} from "typedi";
import {ValidatorNode} from "./services/messaging/validatorNode";
import {ValidatorRpc} from "./api/routes/validatorRpc";
import {Check} from "./utilz/check";
import mysql from "mysql";
import {initMessaging} from "./api/routes/validatorRoutes";
import jsonRouter from "express-json-rpc-router";
import {ExpressUtil} from "./utilz/expressUtil";
import {QueueManager} from "./services/messaging/QueueManager";

import v8 from "v8";

import util from "util";
import {ReflUtil} from "./utilz/reflUtil";
import {StrUtil} from "./utilz/strUtil";
import winston from "winston";
import pgPromise from 'pg-promise'
import {IClient} from 'pg-promise/typescript/pg-subset'
import {DbLoader} from "./services/messaging/dbLoader";
import {WebSocketManager} from "./services/WebSockets/WebSocketManager";
import {ValidatorContractState} from "./services/messaging-common/validatorContractState";
import {RateLimiter} from "./api/routes/rateLimiter";

let server: Server;
let log = WinstonUtil.newLog("SERVER");

// RUN
startServer().catch((err) => {
  console.log('error while starting_' + err);
  console.error(err);
  process.exit(1)
})

async function startServer(logLevel: string = null, testMode = false, padder = 0) {

  printMemoryUsage();

  setInterval(() => {
    printMemoryUsage();
  }, 5 * 60 * 1000);

  await initValidator();

  const validatorContractState = Container.get(ValidatorContractState);
  await validatorContractState.postConstruct();
  const validatorNode = Container.get(ValidatorNode);
  const archivalNodes = validatorContractState.getArchivalNodesMap();


  const app: Express = express();
  server = http.createServer(app);
  initRoutes(app);

  let PORT = EnvLoader.getPropertyAsNumber("PORT", 4001);

  server.listen(PORT, (err) => {
    if (err) {
      log.error("error %o", err);
    }

    let artwork =
      `    
 ____            _      __     __    _ _     _       _             
|  _ \\ _   _ ___| |__   \\ \\   / /_ _| (_) __| | __ _| |_ ___  _ __ 
| |_) | | | / __| '_ \\   \\ \\ / / _\` | | |/ _\` |/ _\` | __/ _ \\| '__|
|  __/| |_| \\__ \\ | | |   \\ V / (_| | | | (_| | (_| | || (_) | |   
|_|  _ \\__,_|___/_| |_|    \\_/ \\__,_|_|_|\\__,_|\\__,_|\\__\\___/|_|   
| \\ | | ___   __| | ___                                            
|  \\| |/ _ \\ / _\` |/ _ \\                                           
| |\\  | (_) | (_| |  __/                                           
|_| \\_|\\___/ \\__,_|\\___|                                                
`;

    log.info(`
      ################################################

      

      ${artwork}



      🛡️  HTTP Server listening on port: ${PORT} 🛡️

      ################################################
    `);
  });


  // Initialize WebSocket Manager with error handling
  try {
    const wsManager = Container.get(WebSocketManager);
    await wsManager.postConstruct(validatorNode.nodeId, validatorContractState.wallet, archivalNodes, server);
  } catch (error) {
    log.error('Failed to initialize WebSocket Manager: %o', error);
    log.warn('Continuing with HTTP server initialization despite WebSocket failure');
  }
}

function printMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const gib = 1024 ** 3;
  console.log(`Rss: ${(memoryUsage.rss / gib).toFixed(2)} GB`);
  console.log(`Heap Total: ${(memoryUsage.heapTotal / gib).toFixed(2)} GB`);
  console.log(`Heap Used: ${(memoryUsage.heapUsed / gib).toFixed(2)} GB`);
  console.log(`Heap Limit %d`, v8.getHeapStatistics().heap_size_limit / gib);
  console.log(`Heap stats %o`, v8.getHeapStatistics());
}


async function initPg() {
  await DbLoader.initPostgres();
  await DbLoader.initTables();
}

export async function initValidator() {
  await initPg();

  const qm = Container.get(QueueManager);
  await qm.postConstruct();

  const validatorNode = Container.get(ValidatorNode);
  await validatorNode.postConstruct();

  const validatorRpc = Container.get(ValidatorRpc);

  Check.notNull(validatorRpc, 'ValidatorRpc is null');
}

export function initRoutes(app: Application) {
  // app.use(express.json());
  const MAX_HTTP_PAYLOAD = EnvLoader.getPropertyOrDefault('MAX_HTTP_PAYLOAD', '20mb');
  app.use(express.json({limit: MAX_HTTP_PAYLOAD}));
  app.use(cors());
  initMessaging(app);
  initRpc(app);

  if (EnvLoader.getPropertyAsBool('VALIDATOR_HTTP_LOG')) {
    app.use(ExpressUtil.handle);
  }

  // app.use(notFoundMiddleware)
}

// todo think which methods should not be logged for security reasons
// todo perf considerations (!) for logging ;
// todo for logging = off, the gc overhead should be minimal (!)
function createBeforeAndAfterLoggingController(log: winston.Logger, object): [object, object] {
  const beforeController = {};
  const afterController = {};
  let methodNames = ReflUtil.getMethodNames(object);
  for (const method of methodNames) {
    beforeController[method] = async function (params: any, _: any, raw: any) {
      const reqId = "req" + raw?.req?.body?.id;
      if (log.isDebugEnabled()) {
        log.debug(`>>> Calling /%s(%s) [%s]`, method, reqId, StrUtil.fmt(params));
      }
      if (method === 'push_sendTransaction') {
        log.debug('push_sendTransaction, checking rate limit');
        let rl = Container.get(RateLimiter);
        if (!await rl.checkLimitsForRpc(raw?.req?.ip)) {
          throw new Error('Rate limit exceeded');
        }
      }
      // log.debug("%o", raw)
    };
    afterController[method] = [
      function (params: any, result: any, raw: any) {
        const reqId = "req" + raw?.req?.body?.id;
        if (log.isDebugEnabled()) {
          log.debug(`=== Reply /%s(%s) result: %o`, method, reqId, StrUtil.fmt(result));
        }
      }];
  }
  return [beforeController, afterController]
}

function initRpc(app: Router) {
  const validatorRpc = Container.get(ValidatorRpc);
  let before = null, after = null;
  if (EnvLoader.getPropertyAsBool('VALIDATOR_HTTP_LOG', false)) {
    [before, after] = createBeforeAndAfterLoggingController(validatorRpc.log, validatorRpc);
  }

  let rateLimitBefore = function (params: any, result: any, raw: any) {
    const reqId = "req" + raw?.req?.body?.id;
    log.debug(`=== Reply /%s(%s) result: %o`, method, reqId, StrUtil.fmt(result));
  };

  app.use(`/api/v1/rpc`,
    jsonRouter({
      methods: validatorRpc,
      beforeMethods: before,
      afterMethods: after,
      onError: (err, body) => {
        log.error('Error in JSON-RPC route: %o', err);
      }
    }));
}