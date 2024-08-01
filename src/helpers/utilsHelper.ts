import { ethers } from 'ethers'
import { Container } from 'typedi'
import { File, Web3Storage } from 'web3.storage'
import { Logger } from 'winston'

import config from '../config'
import { createFileCID, uploadToIPFS } from '../db-access/w2w'

const token = config.web3StorageToken
const SETTING_DELIMITER = '+'
const OPTION_DELIMITER = '-'
// To Generate Random Password
export function generateRandomWord(length: number, includeSpecial: boolean): string {
  let result = ''
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  if (includeSpecial) {
    characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{}~<>;:-='
  }
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }

  return result
}

// To remove a file
export async function removeFile(filepath) {
  return await new Promise((resolve, reject) => {
    require('fs').unlink(filepath, (err) => {
      if (err) {
        const Logger: Logger = Container.get('logger')
        Logger.log(err)
        reject(err)
      } else {
        resolve(true)
      }
    })
  })
}

export async function checkFileSize(base64) {
  if (!base64) {
    return true
  }
  const sizeOf = require('image-size')
  const base64Data = base64.split(';base64,').pop()
  const img = Buffer.from(base64Data, 'base64')
  const dimensions = sizeOf(img)
  if (dimensions.width > 256 || dimensions.height > 256) {
    const Logger: Logger = Container.get('logger')
    Logger.error('Image size check failed... returning')
    return false
  }

  return true
}
// To Handle Base 64 file writing
export async function writeBase64File(base64, filename) {
  // Remove png or jpg
  const sizeOf = require('image-size')
  const base64Data = base64.split(';base64,').pop()
  const img = Buffer.from(base64Data, 'base64')
  const dimensions = sizeOf(img)

  // Only proceed if image is equal to or less than 256, allowign it though should be only 128x128
  if (dimensions.width > 256 || dimensions.height > 256) {
    const Logger: Logger = Container.get('logger')
    Logger.error('Image size check failed... returning')
    return false
  }

  // only proceed if png or jpg
  // This is brilliant: https://stackoverflow.com/questions/27886677/javascript-get-extension-from-base64-image
  // char(0) => '/' : jpg
  // char(0) => 'i' : png
  let fileext
  if (base64Data.charAt(0) == '/') {
    fileext = '.jpg'
  } else if (base64Data.charAt(0) == 'i') {
    fileext = '.png'
  } else {
    return false
  }

  const filepath = config.staticCachePath + filename + fileext

  // Write the file
  return await new Promise((resolve, reject) => {
    require('fs').writeFile(filepath, base64Data, 'base64', function (err) {
      if (err) {
        const Logger: Logger = Container.get('logger')
        Logger.log(err)
        reject(err)
      } else {
        resolve(config.fsServerURL + filename + fileext)
      }
    })
  })
}

export async function writeToIPFS(base64, filename) {
  const client = new Web3Storage({ token })

  // let ipfsURL = ipfsLocal;
  // let ipfs: any;
  // try {
  //   ipfs = await create(ipfsURL);
  // } catch (err) {
  //   Logger.error(err);
  //   //eg: when url = abcd (invalid)
  //   // Logger.info(`[${new Date(Date.now())}]- Couldn't connect to ipfs url: %o | Error: %o `, ipfsURL, err);
  //   // ipfsURL = ipfsInfura
  //   // ipfs = create(ipfsURL);
  //   // Logger.info(`[${new Date(Date.now())}]-Switching to : %o `, ipfsURL);
  // }

  // Remove png or jpg
  const sizeOf = require('image-size')
  const base64Data = base64.split(';base64,').pop()
  const img = Buffer.from(base64Data, 'base64')
  const dimensions = sizeOf(img)
  const file = [new File([img], filename)]

  // Only proceed if image is equal to or less than 256, allowign it though should be only 128x128
  if (dimensions.width > 256 || dimensions.height > 256) {
    const Logger: Logger = Container.get('logger')
    Logger.error('Image size check failed... returning')
    return false
  }

  // const ipfsUpload = async () => {
  //   return new Promise(async (resolve, reject) => {
  //     ipfs
  //       .add(img)
  //       .then(async (data: any) => {
  //         Logger.info(`[${new Date(Date.now())}]-Success --> uploadToIPFS(): %o `, data);
  //         Logger.info(`[${new Date(Date.now())}] - 🚀 CID: %o`, data.cid.toString());
  //         await ipfs.pin
  //           .add(data.cid)
  //           .then((pinCid: any) => {
  //             Logger.info(`[${new Date(Date.now())}]- 🚀 pinCid: %o`, pinCid.toString());
  //             resolve(pinCid.toString());
  //           })
  //           .catch((err: Error) => {
  //             Logger.error(`[${new Date(Date.now())}]-!!!Error --> ipfs.pin.add(): %o`, err);
  //             reject(err);
  //           });
  //       })
  //       .catch(async (err: Error) => {
  //         //eg: when url = /ip4/0.0.0.0/tcp/5001 and local ipfs node is not running
  //         Logger.info(
  //           `[${new Date(Date.now())}]- Couldn't connect to ipfs url: %o | ipfs.add() error: %o`,
  //           ipfsURL,
  //           err
  //         );
  //         // if (ipfsURL !== ipfsInfura) {
  //         //   ipfsURL = ipfsInfura
  //         //   ipfs = create(ipfsURL);
  //         //   Logger.info(`[${new Date(Date.now())}]-Switching to : %o `, ipfsURL);
  //         //   await ipfsUpload()
  //         //     .then(cid => {
  //         //       resolve(cid)
  //         //     })
  //         //     .catch(err => {
  //         //       Logger.error(`[${new Date(Date.now())}]-!!!Error --> ipfsUpload(): %o`, err);
  //         //       reject(err)
  //         //     })
  //         // }
  //         // else {
  //         //   reject(err)
  //         // }
  //       });
  //   });
  // };
  return new Promise(async (resolve, reject) => {
    try {
      const cid = await client.put(file)
      resolve(`${cid}/${filename}`)
    } catch (err) {
      const Logger: Logger = Container.get('logger')
      Logger.error(`[${new Date(Date.now())}]-!!!Error --> ipfsUpload(): %o`, err)
      reject(err)
    }
  })
}

export function isValidAddress(address: string): boolean {
  return ethers.utils.isAddress(address.toLowerCase())
}

// ERC20 and NFT contract addresses needs to be in the full CAIP10 format because we need the chain Id to know which chain to query
// for the contract information
export function isValidActualCAIP10Address(realCAIP10: string): boolean {
  const walletComponent = realCAIP10.split(':')
  if (isNaN(Number(walletComponent[1]))) return false
  return (
    walletComponent.length === 3 &&
    walletComponent[0] === 'eip155' &&
    isValidAddress(walletComponent[2])
  )
}

export function getCallerFile() {
  const err = new Error()
  Error.prepareStackTrace = (_, stack) => stack
  const stack = err.stack
  Error.prepareStackTrace = undefined

  return stack[1].getFileName().replace(/^.*[\\\/]/, '')
}

export function generateExpandedBooleanSetting(booleanSettingArray: string[]) {
  return {
    type: config.notificationSettingType.BOOLEAN_TYPE,
    default: !!parseInt(booleanSettingArray[1])
  }
}

export function generateExpandedSliderSetting(sliderSettingArray: string[]) {
  return {
    type: config.notificationSettingType.SLIDER_TYPE,
    enabled: !!parseInt(sliderSettingArray[1]),
    default: parseFloat(sliderSettingArray[2]),
    lowerLimit: parseFloat(sliderSettingArray[3]),
    upperLimit: parseFloat(sliderSettingArray[4]),
    ticker: sliderSettingArray[5] != undefined ? parseFloat(sliderSettingArray[5]) : 1
  }
}

export function generateExpandedRangeSetting(rangeSettingArray: string[]) {
  return {
    type: config.notificationSettingType.RANGE_TYPE,
    enabled: !!parseInt(rangeSettingArray[1]),
    default: { lower: parseFloat(rangeSettingArray[2]), upper: parseFloat(rangeSettingArray[3]) },
    lowerLimit: parseFloat(rangeSettingArray[4]),
    upperLimit: parseFloat(rangeSettingArray[5]),
    ticker: rangeSettingArray[6] != undefined ? parseFloat(rangeSettingArray[6]) : 1
  }
}

export function checkValidBooleanSetting(settingArray: string[]): boolean {
  return settingArray[0] == config.notificationSettingType.BOOLEAN_TYPE && settingArray.length == 2
}

export function checkValidSliderSetting(settingArray: string[]): boolean {
  return (
    settingArray[0] == config.notificationSettingType.SLIDER_TYPE &&
    (settingArray.length == 5 || settingArray.length == 6)
  )
}

export function checkValidRangeSetting(settingArray: string[]): boolean {
  return (
    settingArray[0] == config.notificationSettingType.RANGE_TYPE &&
    (settingArray.length == 7 || settingArray.length == 6)
  )
}

export function parseChannelSetting(channelSetting: string, notificationDescription: string) {
  const expandedChannelSetting = []
  const numberOfSettings = channelSetting.split(SETTING_DELIMITER)[0]
  const channelSettingDelimited = channelSetting.split(`${numberOfSettings}${SETTING_DELIMITER}`)[1]
  const setting = channelSettingDelimited.split(SETTING_DELIMITER)
  const notificationDescriptionArray = notificationDescription.split(SETTING_DELIMITER)
  for (let i = 0; i < setting.length; i++) {
    const settingComponents = setting[i].split(OPTION_DELIMITER)
    if (checkValidBooleanSetting(settingComponents)) {
      expandedChannelSetting.push({
        ...generateExpandedBooleanSetting(settingComponents),
        index: i + 1,
        description: notificationDescriptionArray[i]
      })
    } else if (checkValidSliderSetting(settingComponents)) {
      expandedChannelSetting.push({
        ...generateExpandedSliderSetting(settingComponents),
        index: i + 1,
        description: notificationDescriptionArray[i]
      })
    } else if (checkValidRangeSetting(settingComponents)) {
      expandedChannelSetting.push({
        ...generateExpandedRangeSetting(settingComponents),
        index: i + 1,
        description: notificationDescriptionArray[i]
      })
    }
  }

  return expandedChannelSetting
}

export function parseUserSetting(
  userSetting: string,
  channelSettings: any,
  useDefault: boolean = false
) {
  if (!channelSettings || channelSettings.length == 0) {
    return null
  }
  // user has not set the setting
  if (useDefault || userSetting.length == 0) {
    for (let i = 0; i < channelSettings.length; i++) {
      if (channelSettings[i]['type'] == config.notificationSettingType.BOOLEAN_TYPE) {
        channelSettings[i]['user'] = channelSettings[i]['default']
      } else if (
        channelSettings[i]['type'] == config.notificationSettingType.SLIDER_TYPE ||
        channelSettings[i]['type'] == config.notificationSettingType.RANGE_TYPE
      ) {
        channelSettings[i]['user'] = channelSettings[i]['default']
      }
    }
  } else {
    const setting = userSetting.split(/\+/)
    setting.shift()
    if (setting.length == channelSettings.length) {
      for (let i = 0; i < setting.length; i++) {
        const settingComponet = setting[i].split(OPTION_DELIMITER)
        const userNotificationIndex = parseInt(settingComponet[0])
        //TODO: change it to switch
        if (channelSettings[i]['type'] == config.notificationSettingType.BOOLEAN_TYPE) {
          channelSettings[i]['user'] = !!parseInt(settingComponet[1])
        } else if (channelSettings[i]['type'] == config.notificationSettingType.SLIDER_TYPE) {
          channelSettings[i]['user'] = parseFloat(settingComponet[2])
          channelSettings[i]['enabled'] = !!parseInt(settingComponet[1])
        } else if (channelSettings[i]['type'] == config.notificationSettingType.RANGE_TYPE) {
          channelSettings[i]['enabled'] = !!parseInt(settingComponet[1])
          channelSettings[i]['user'] = {
            lower: parseFloat(settingComponet[2]),
            upper: parseFloat(settingComponet[3])
          }
        }
      }
    }
  }
  return channelSettings
}

export async function verifyPayloadIPFSHash(
  payload: string,
  ipfsData: { [x: string]: any },
  ipfsHash: string
): Promise<number> {
  let _cid: string

  // Format : Qm
  if (ipfsHash.length === 46) {
    const { cid } = await uploadToIPFS(payload)
    _cid = cid.toString()
  }
  // Format: Bayk
  else if (ipfsHash.length === 59) {
    _cid = await createFileCID(payload)
  }

  // Verification
  if (_cid === ipfsHash) {
    return 1
  } else if (JSON.stringify(ipfsData) === payload && _cid !== ipfsHash) {
    return -2
  } else {
    return -3
  }
}
