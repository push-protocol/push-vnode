import dotenv from 'dotenv'
import {StrUtil} from './strUtil'
import {NumUtil} from "./numUtil";

export class EnvLoader {

  public static loadEnvOrFail(fail: boolean = false) {
    // loads all .env variables into process.env.* variables
    // Optional support for CONFIG_DIR variable
    console.log(`config dir is ${process.env.CONFIG_DIR}`)
    let options = {}
    if (process.env.CONFIG_DIR) {
      options = {path: `${process.env.CONFIG_DIR}/.env`}
    }
    const envFound = dotenv.config(options);
    if (envFound.error) {
      if (fail) {
        throw new Error("⚠️  Couldn't find .env file  ⚠️")
      } else {
        console.log("[WARN] no .env file; if you wanted to load a specific .env please specify CONFIG_DIR env variable ");
      }
    }
  }

  public static getPropertyOrFail(propName: string): string {
    const val = process.env[propName]
    if (StrUtil.isEmpty(val)) {
      throw new Error(`process.env.${propName} is empty`)
    }
    return val
  }

  // for undefined: defaults to false
  public static getPropertyAsBool(propName: string, defaultValue: boolean = true): boolean {
    const val = process.env[propName];
    if (StrUtil.isEmpty(val)) {
      return defaultValue;
    }
    return val.toLowerCase() === 'true'
  }

  public static getPropertyOrDefault(propName: string, def:string): string {
    const val = process.env[propName]
    if (StrUtil.isEmpty(val)) {
      return def;
    }
    return val
  }

  public static getPropertyAsNumber(propName: string, defaultValue:number): number {
    const val = process.env[propName]
    return NumUtil.parseInt(val, defaultValue);
  }
}
