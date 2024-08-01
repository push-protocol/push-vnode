export type IChannelSetting = {
  index: number
  type: number
  upperLimit?: number
  lowerLimit?: number
  default: number | boolean
  notificationDescription: string
}
