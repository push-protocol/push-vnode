import { getMigrationStatus } from '../../migrations/manual'

/**
 * @param {*} req Express req Object
 * @param {*} res  Express res Object
 * @param {*} next  Express next Function
 */
const onlyAfterMigration = async (req, res, next) => {
  try {
    const migrationStatus = await getMigrationStatus()
    if (!migrationStatus.completed) {
      return res.status(400).json({ info: 'Functionality Unavailable !! Migration is in progress' })
    }

    return next()
  } catch (e) {
    throw e
    return next(e)
  }
}

export default onlyAfterMigration
