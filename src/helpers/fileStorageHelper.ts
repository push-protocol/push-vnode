import fs from 'fs'
import path from 'path'

/**
 * Writes JSON data to a file in a structured directory based on the provided ID.
 *
 * @param {Object} jsonData - The JSON data to be written to the file.
 * @param {string} id - The unique identifier for the file.
 * @param {string} rootDir - The root directory for storing files.
 */
export async function writeJsonToFile(jsonData: any, id: string, rootDir: string): Promise<void> {
  try {
    // Extract the last four characters of the ID
    const subdirPath = path.join(rootDir, id.slice(-4).split('').join('/'))

    // Create the root directory if it doesn't exist
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true })
    }

    // Create the subdirectory path if it doesn't exist
    if (!fs.existsSync(subdirPath)) {
      fs.mkdirSync(subdirPath, { recursive: true })
    }

    // Write the JSON data to a file with the given ID in the local subdirectory
    const filePath = path.join(subdirPath, `${id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(jsonData))
  } catch (error) {
    throw new Error(`Error writing JSON data to file: ${error}`)
  }
}

/**
 * Retrieves JSON data from a file based on the provided ID.
 *
 * @param {string} id - The unique identifier for the file.
 * @param {string} rootDir - The root directory where files are stored.
 * @returns {Promise<any>} A promise that resolves to the JSON data, or null if an error occurs or the file doesn't exist.
 */
export async function readJsonFromFile(id: string, rootDir: string): Promise<any> {
  try {
    // Extract the last four characters of the ID to determine the subdirectory path
    const subdirPath = path.join(rootDir, id.slice(-4).split('').join('/'))

    // Construct the full path to the target file using the subdirectory path and the ID
    const sourcePath = path.join(subdirPath, `${id}.json`)

    // Check if the file exists at the constructed path
    if (!fs.existsSync(sourcePath)) {
      // If the file doesn't exist, return null
      return null
    }

    // Read the contents of the file synchronously, expecting a UTF-8 encoded string
    const jsonData = fs.readFileSync(sourcePath, 'utf8')

    // Parse the string as JSON and return the resulting object
    return JSON.parse(jsonData)
  } catch (error) {
    // In case of any errors during file reading or JSON parsing, return null
    return null
  }
}

/**
 * Deletes a JSON file based on the provided ID.
 *
 * @param {string} id - The unique identifier for the file.
 * @param {string} rootDir - The root directory where files are stored.
 */
export async function deleteJsonFile(id: string, rootDir: string): Promise<void> {
  try {
    // Extract the last four characters of the ID to determine the subdirectory path
    const subdirPath = path.join(rootDir, id.slice(-4).split('').join('/'))

    // Construct the full path to the target file using the subdirectory path and the ID
    const filePath = path.join(subdirPath, `${id}.json`)

    // Check if the file exists
    if (fs.existsSync(filePath)) {
      // Delete the file
      fs.unlinkSync(filePath)
    } else {
      // If the file doesn't exist, throw an error
      throw new Error('File not found')
    }
  } catch (error) {
    // In case of any errors during file deletion, throw an error
    throw new Error(`Error deleting file: ${error}`)
  }
}
