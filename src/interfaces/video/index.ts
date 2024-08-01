import { VIDEO_NOTIFICATION_ACCESS_TYPE } from '../../enums/video'

export interface VideNotificationRules {
  access: {
    type: VIDEO_NOTIFICATION_ACCESS_TYPE
    data: {
      chatId?: string
    }
  }
}
