import {EnvLoader} from "./utilz/envLoader";
EnvLoader.loadEnvOrFail();

import express from "express";
import 'reflect-metadata'
import { createServer, Server } from 'http'
import { initValidator } from './services/messaging/validatorLoader'


import {WinstonUtil} from "./utilz/winstonUtil";
import {initRoutes} from "./api";

let server: Server;

// RUN
startServer().catch((err) => {
  console.log('error while starting_' + err);
  console.error(err);
  process.exit(1)
})


async function startServer(logLevel: string = null, testMode = false, padder = 0) {
  const app = express();
  server = createServer(app);

  await initValidator();

  initRoutes(app); // error here

  let PORT = EnvLoader.getPropertyAsNumber("PORT", 4001);
  let logger = WinstonUtil.newLog("SERVER");

  server.listen(PORT, (err) => {
    if (err) {
      logger.error(err);
      process.exit(1);
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
