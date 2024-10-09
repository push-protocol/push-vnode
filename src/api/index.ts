import {Application, Router} from 'express'
import { EnvLoader } from '../utilz/envLoader'
import { ExpressUtil } from '../utilz/expressUtil'
import * as messaging from './routes/validatorRoutes'
import * as core from 'express-serve-static-core'
import {initMessaging} from "./routes/validatorRoutes";
import {Container} from "typedi";
import {ValidatorRpc} from "./routes/validatorRpc";
import jsonRouter from "express-json-rpc-router";


