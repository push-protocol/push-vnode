import {EnvLoader} from "./utilz/envLoader";

EnvLoader.loadEnvOrFail();

import express, {Application, Express, Router} from "express";
import 'reflect-metadata'
import {createServer, Server} from 'http'
import {createNewValidatorTables} from './services/messaging/validatorLoader'
import cors from 'cors'
import {WinstonUtil} from "./utilz/winstonUtil";
import * as http from "http";
import {MySqlUtil} from "./utilz/mySqlUtil";
import {Container} from "typedi";
import {ValidatorNode} from "./services/messaging/validatorNode";
import {ValidatorRpc} from "./api/routes/validatorRpc";
import {Check} from "./utilz/check";
import mysql from "mysql";
import {initMessaging} from "./api/routes/validatorRoutes";
import jsonRouter from "express-json-rpc-router";
import {ExpressUtil} from "./utilz/expressUtil";
import {QueueManager} from "./services/messaging/QueueManager";

let server: Server;

// RUN
startServer().catch((err) => {
  console.log('error while starting_' + err);
  console.error(err);
  process.exit(1)
})


async function startServer(logLevel: string = null, testMode = false, padder = 0) {

  await initValidator();

  const app: Express = express();
  server = http.createServer(app);

  initRoutes(app);

  let PORT = EnvLoader.getPropertyAsNumber("PORT", 4001);
  let logger = WinstonUtil.newLog("SERVER");
  server.listen(PORT, (err) => {
    if (err) {
      logger.error("error %o", err);
    }

    let artwork = `
      ██████╗ ██╗   ██╗███████╗██╗  ██╗    ███╗   ██╗ ██████╗ ██████╗ ███████╗
      ██╔══██╗██║   ██║██╔════╝██║  ██║    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝
      ██████╔╝██║   ██║███████╗███████║    ██╔██╗ ██║██║   ██║██║  ██║█████╗  
      ██╔═══╝ ██║   ██║╚════██║██╔══██║    ██║╚██╗██║██║   ██║██║  ██║██╔══╝  
      ██║     ╚██████╔╝███████║██║  ██║    ██║ ╚████║╚██████╔╝██████╔╝███████╗
      ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝    ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝                                                                          
    `;

    logger.info(`
      ################################################

      

      ${artwork}



      🛡️  Server listening on port: ${PORT} 🛡️

      ################################################
    `);
  });
}


async function initDb() {
  const dbpool = mysql.createPool({
    connectionLimit: 10,
    host: EnvLoader.getPropertyOrDefault("DB_HOST", "localhost"),
    user: EnvLoader.getPropertyOrDefault("DB_USER", "mysql"),
    database: EnvLoader.getPropertyOrDefault("DB_NAME", "vnode1"),
    password: EnvLoader.getPropertyOrDefault("DB_PASS", "mysql"),
  });

  MySqlUtil.init(dbpool)
  await createNewValidatorTables();
}

export async function initValidator() {
  await initDb();

  const qm = Container.get(QueueManager);
  await qm.postConstruct();

  const validatorNode = Container.get(ValidatorNode);
  await validatorNode.postConstruct();

  const validatorRpc = Container.get(ValidatorRpc);

  Check.notNull(validatorRpc, 'ValidatorRpc is null');
}

export function initRoutes(app: Application) {
  app.use(express.json());
  app.use(cors())
  initMessaging(app);
  initRpc(app);

  if (EnvLoader.getPropertyAsBool('VALIDATOR_HTTP_LOG')) {
    app.use(ExpressUtil.handle);
  }

  // app.use(notFoundMiddleware)
}

function initRpc(app: Router) {
  const validatorRpc = Container.get(ValidatorRpc);
  app.use(`/api/v1/rpc`, jsonRouter({methods: validatorRpc}));
}
