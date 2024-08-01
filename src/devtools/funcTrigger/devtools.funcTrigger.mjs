// Hacky way to use import in node > 14
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

const parseArgs = require('minimist')(process.argv.slice(2))

// Import Begins
import chalk from 'chalk'
import fs from 'fs'

import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// It all starts here
const main = async function () {
  console.log(
    chalk.bgGray.bold.white(
      '\nCALLING FUNCTION (--module=MODULE_NAME --func=FUNC_NAME ) if it exists and is passed in param function\n'
    )
  )

  const folderPath = `${__dirname}`
  const relativePath = `modules/${parseArgs.module}.mjs`
  const absPath = `${folderPath}/${relativePath}`

  if (!fs.existsSync(absPath)) {
    console.log(
      chalk.red(`     ❌  ${relativePath} Not Found... can't proceed without valid module\n`)
    )
    process.exit(1)
  } else {
    console.log(chalk.green(`${relativePath} Found... Loading\n`))
    const migrateScript = await import(`./${relativePath}`)
    await migrateScript.default(parseArgs.func)
  }
}

main()
