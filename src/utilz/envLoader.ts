import dotenv from 'dotenv'
import StrUtil from './strUtil'
import {NumUtil} from "./numUtil";

export class EnvLoader {
  public static loadEnvOrFail() {
    const envFound = dotenv.config()
    if (envFound.error) {
      // This error should crash whole process
      throw new Error("⚠️  Couldn't find .env file  ⚠️")
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
  public static getPropertyAsBool(propName: string): boolean {
    const val = process.env[propName]
    return val != null && val.toLowerCase() === 'true'
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
