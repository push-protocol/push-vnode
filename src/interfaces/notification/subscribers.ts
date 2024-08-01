export interface IChannelAndAliasVerificationResponse {
  success: boolean
  ethAddress: string | null
  aliasAddress: string | null
  channelSetting: string | null
  error: string | null
}

export interface ISubscribeResponse {
  success: boolean | null
  verified: boolean | null
  error: any | null
  isDataFromEVMLog?: boolean
}

export interface IUserSettings {
  index: number
  type: number
  upperLimit?: number
  lowerLimit?: number
  default: number | boolean
  notificationDescription: string
  user: number | boolean
}
