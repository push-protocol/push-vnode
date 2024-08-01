import fs from 'fs'
import { Container } from 'typedi'
import { Logger } from 'winston'

import config from '../config'
import { getProtocolMetaValues, updateProtocolMetaValues } from '../helpers/protocolMetaHelper'
import { DynamicLogger } from '../loaders/dynamicLogger'

// MIGRATION HELPERS
const execMigrationVersion = async (folderPath, version, upgrade) => {
  return await new Promise(async (resolve) => {
    const logger: Logger = Container.get('logger')
    const dynamicLogger: DynamicLogger = Container.get('dynamicLogger')
    const suffix = process.env.NODE_ENV === 'production' ? 'js' : 'ts'
    const absPath = `${folderPath}/migrationV${version}.${suffix}`
    const relativePath = `../migrationV${version}.${suffix}`

    if (fs.existsSync(absPath)) {
      const migrateScript = await import(absPath)
      await migrateScript.default(upgrade)
    } else {
      dynamicLogger.updateFooterLogs(null)
      dynamicLogger.stopRendering()
      dynamicLogger.reset()
      logger.hijackLogger(null)

      logger.error(`${relativePath} Not Found... can't proceed without file`)
      process.exit(1)
    }

    resolve(true)
  })
}

const doMigration = async (from, to, upgrade) => {
  const logger: Logger = Container.get('logger')
  const dynamicLogger: DynamicLogger = Container.get('dynamicLogger')
  const migrationFolderPath = `${__dirname}/../migrations/versioned`

  const total = to - from

  return await new Promise(async (resolve, reject) => {
    let counter = 0

    dynamicLogger.updateLogs(0, {
      chalkIt: `blue`,
      title: 'Upgrading Versions',
      progress: counter,
      total: total,
      append: `Applying Patches...`
    })

    // handle edge case of genesis 1
    while (from != to) {
      upgrade ? from++ : to--
      dynamicLogger.updateLogs(0, {
        chalkIt: `blue`,
        title: 'Upgrading Versions',
        progress: counter,
        total: total,
        append: `Applying Patch: Version ${upgrade ? from : to} [${
          upgrade ? 'Upgrading' : 'Downgrading'
        }]`
      })

      await execMigrationVersion(migrationFolderPath, upgrade ? from : to + 1, upgrade)
        .then(async () => {
          counter++

          await updateProtocolMetaValues(
            [
              {
                type: `migrationVersion`,
                value: from.toString()
              }
            ],
            6,
            logger
          ).catch((err) => {
            logger.error(
              'Error while updating migration version doMigration() | MigrationHelper with err: %o',
              err
            )
            reject(err)
          })
        })
        .catch((err) => {
          logger.error('Error while trying to execute migrating version with err: %o', err)
          reject(err)
        })

      dynamicLogger.updateLogs(0, {
        chalkIt: `blue`,
        title: 'Upgrading Versions',
        progress: counter,
        total: total,
        append: `Applying Patch: Version ${upgrade ? from : to} [${
          upgrade ? 'Upgrading' : 'Downgrading'
        }]`
      })

      await new Promise((r) => setTimeout(r, 300))
    }

    resolve(true)
  })
}

// START MIGRATION SCRIPT
export const startMigration = async () => {
  const logger: Logger = Container.get('logger')
  const dynamicLogger: DynamicLogger = Container.get('dynamicLogger')

  const success = true
  return await new Promise(async (resolve) => {
    const offset = 23

    // Turn off normal logger
    if (config.enableDynamicLogs && !dynamicLogger.isDisabled()) {
      dynamicLogger.reset()
      dynamicLogger.updatePadding(offset)

      dynamicLogger.updateTitle({
        chalkIt: `blue`,
        title: `Migrating...`
      })
      dynamicLogger.updateLogs(0, {
        chalkIt: `blue`,
        title: `Checking Migration Status`
      })

      logger.hijackLogger(dynamicLogger)
      dynamicLogger.startRendering(logger)
    }

    const forTypes = ['migrationVersion']
    let currentMigVersion = config.migrationVersion
    const configMigVersion = config.migrationVersion

    await getProtocolMetaValues(forTypes, offset, logger)
      .then((protocolMeta) => {
        currentMigVersion = parseInt(protocolMeta.migrationVersion)

        dynamicLogger.updateTitle({
          chalkIt: `blue`,
          title: `Migrating... Current Version: ${currentMigVersion}`
        })
      })
      .catch((err) => {
        logger.error('🔥 error in retriving migrationVersion: %o', err)
        process.exit(1)
      })

    if (currentMigVersion == configMigVersion) {
      dynamicLogger.updateLogs(0, {
        chalkIt: `blue`,
        title: 'Upgrading Versions',
        progress: 1,
        total: 1,
        append: `Migration versions match, no patch to apply`
      })
    } else {
      // Start Migration Script
      const upgrade = currentMigVersion < configMigVersion ? true : false
      const from = upgrade ? currentMigVersion : configMigVersion
      const to = upgrade ? configMigVersion : currentMigVersion

      await doMigration(from, to, upgrade).catch((err) => {
        dynamicLogger.stopRendering()
        dynamicLogger.reset()
        logger.hijackLogger(null)

        logger.error('Error while executing doMigration() | MigrationHelper with err: %o', err)
        reject(err)
        process.exit(0)
      })
    }

    dynamicLogger.updateFooterLogs(null)
    dynamicLogger.stopRendering('👍  ')
    dynamicLogger.reset()
    logger.hijackLogger(null)

    resolve(true)
  })
}
