import { VideNotificationRules } from '../video'
export * from './channels'
export * from './feeds'
export * from './subscribers'

export interface SignatureVerification {
  success: boolean
  verified: boolean
  error: any | null
}

// SendNotificationRules can be extended in the future for other use cases
export interface SendNotificationRules extends VideNotificationRules {}

export type INotificaiton = {
  timestamp: string
  from: string
  to: string | string[]
  notifID: number
  channel: {
    name: string
    icon: string
    url: string
  }
  meta: {
    type: string
  }
  message: {
    notification: {
      title: string
      body: string
    }
    payload: {
      title: string
      body: string
      cta: string
      embed: string
      meta: {
        domain: string
        type: string
        data: any
      } | null
    }
  }
  config: {
    expiry: string
    silent: boolean
    hidden: boolean
  }
  source: string
  verificationProof?: string
}
