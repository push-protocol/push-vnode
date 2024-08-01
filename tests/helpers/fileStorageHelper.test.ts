import { expect } from 'chai'
import sinon from 'sinon'
import fs from 'fs'
import path from 'path'
import {
  writeJsonToFile,
  readJsonFromFile,
  deleteJsonFile
} from '../../src/helpers/fileStorageHelper'

describe('helpers/fileStorageHelper.ts unit tests', () => {
  const rootDir = './test-data'
  const id = 'test1234'
  const jsonData = { name: 'test' }
  let writeFileSyncStub, readFileSyncStub, existsSyncStub, mkdirSyncStub, unlinkSyncStub

  beforeEach(() => {
    // Stub the filesystem methods
    writeFileSyncStub = sinon.stub(fs, 'writeFileSync')
    readFileSyncStub = sinon.stub(fs, 'readFileSync')
    existsSyncStub = sinon.stub(fs, 'existsSync')
    mkdirSyncStub = sinon.stub(fs, 'mkdirSync')
    unlinkSyncStub = sinon.stub(fs, 'unlinkSync')
  })

  afterEach(() => {
    // Restore the original filesystem methods
    sinon.restore()
  })

  describe('writeJsonToFile', () => {
    it('should write JSON data to the correct file', async () => {
      existsSyncStub.returns(false)
      await writeJsonToFile(jsonData, id, rootDir)

      sinon.assert.calledWith(mkdirSyncStub, sinon.match.string, sinon.match.object)
      sinon.assert.calledWith(
        writeFileSyncStub,
        path.join(rootDir, '/1/2/3/4/', `${id}.json`),
        JSON.stringify(jsonData)
      )
    })

    it('should handle errors in file writing', async () => {
      writeFileSyncStub.throws(new Error('File write error'))

      try {
        await writeJsonToFile(jsonData, id, rootDir)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).to.equal('Error writing JSON data to file: Error: File write error')
      }
    })

    // Add more tests for different scenarios
  })

  describe('readJsonFromFile', () => {
    it('should return JSON data from a file', async () => {
      existsSyncStub.returns(true)
      readFileSyncStub.returns(JSON.stringify(jsonData))

      const data = await readJsonFromFile(id, rootDir)
      expect(data).to.deep.equal(jsonData)
    })

    it('should return null if file does not exist', async () => {
      existsSyncStub.returns(false)

      const data = await readJsonFromFile(id, rootDir)
      expect(data).to.be.null
    })

    // Add more tests for different scenarios
  })

  describe('deleteJsonFile', () => {
    it('should delete the specified file', async () => {
      existsSyncStub.returns(true)

      await deleteJsonFile(id, rootDir)
      sinon.assert.calledWith(unlinkSyncStub, path.join(rootDir, '/1/2/3/4/', `${id}.json`))
    })

    it('should throw an error if file does not exist', async () => {
      existsSyncStub.returns(false)

      try {
        await deleteJsonFile(id, rootDir)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).to.equal('Error deleting file: Error: File not found')
      }
    })
  })
})
