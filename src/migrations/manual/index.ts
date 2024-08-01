import os from 'os'
import path from 'path'

import { readJsonFromFile, writeJsonToFile } from '../../helpers/fileStorageHelper'
import { migrateFeedsToNewIconFormat } from './migrationV7'

export const getMigrationStatus = async (migrationFile: string = 'migrationStatus') => {
  const FILE_STORAGE_DIR: string = path.join(os.homedir(), 'manual_migrations')
  const migrationStatus: { started: boolean; completed: boolean } | null = await readJsonFromFile(
    migrationFile,
    FILE_STORAGE_DIR
  )
  if (migrationStatus === null) {
    return {
      started: false,
      completed: false
    }
  }
  return migrationStatus
}

export const changeMigrationStatus = async (
  migrationFile: string,
  {
    started,
    completed
  }: {
    started: boolean
    completed: boolean
  }
) => {
  const FILE_STORAGE_DIR: string = path.join(os.homedir(), 'manual_migrations')
  await writeJsonToFile({ started, completed }, migrationFile, FILE_STORAGE_DIR)
}

export const startManualMigration = async () => {
  const VERSION = 7
  const migrationStatus = await getMigrationStatus(`MIGRATION_V${VERSION}`)
  if (migrationStatus.started || migrationStatus.completed) {
    return
  }
  await changeMigrationStatus(`MIGRATION_V${VERSION}`, { started: true, completed: false })

  await migrateFeedsToNewIconFormat()

  await changeMigrationStatus(`MIGRATION_V${VERSION}`, { started: false, completed: true })
}
