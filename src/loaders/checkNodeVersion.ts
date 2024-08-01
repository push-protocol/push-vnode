import semver from 'semver'

import { engines } from '../../package.json'
import LoggerInstance from './logger'

const version = engines.node
export default () => {
  if (!semver.satisfies(process.version, version)) {
    LoggerInstance.error(
      `Required node version ${version} not satisfied with current version ${process.version}.`
    )
    process.exit(1)
  }
}
