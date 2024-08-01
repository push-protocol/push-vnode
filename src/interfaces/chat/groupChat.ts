import { ChatStatus, GroupType } from '.'

export interface GroupChat {
  groupName: string
  groupDescription: string
  members: string[]
  groupImage: string
  admins: string[]
  isPublic: boolean
  contractAddressNFT: string | null
  numberOfNFTs: number
  contractAddressERC20: string | null
  numberOfERC20: number
  groupCreator: string
  verificationProof: string
  // for gitcoin and other specific collab purpose
  meta?: string | null | undefined
  scheduleAt?: Date | null
  scheduleEnd?: Date | null
  groupType: GroupType
  status: ChatStatus | null
  sessionKey?: string | null
  rules?: Rules
}

export enum ConditionType {
  PUSH = 'PUSH',
  GUILD = 'GUILD'
}

export type Data = {
  contract?: string
  amount?: number
  decimals?: number
  id?: string
  role?: string
  url?: string
  comparison?: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'all' | 'any'
  inviterRoles?: string[]
}

export type ConditionBase = {
  type?: ConditionType
  category?: string
  subcategory?: string
  data?: Data
  access?: Boolean
}

export interface AdditionalRuleMeta {
  isAutoJoin?: boolean
}

export type Condition = ConditionBase & {
  any?: ConditionBase[]
  all?: ConditionBase[]
}

export interface Rules {
  entry?: {
    conditions: Array<Condition | ConditionBase> | (Condition | ConditionBase)
  }
  chat?: {
    conditions: Array<Condition | ConditionBase> | (Condition | ConditionBase)
  }
}

export interface UpdateGroup {
  groupName: string
  groupDescription: string
  groupImage: string
  members: string[]
  admins: string[]
  address: string
  verificationProof: string
  //for gitcoin and other specific collab purpose
  meta?: string | null | undefined
  scheduleAt?: Date | null
  scheduleEnd?: Date | null
  status: ChatStatus | null
  encryptedSecret?: string | null
  rules?: Rules | null
}

export interface GroupInfoDTO {
  groupImage: string | null
  groupName: string
  isPublic: boolean
  groupDescription: string | null
  groupCreator: string
  chatId: string
  meta?: string | null
  scheduleAt?: Date | null
  scheduleEnd?: Date | null
  groupType: GroupType
  status: ChatStatus | null
  encryptedSecret?: string | null
  sessionKey?: string | null
  rules?: Rules | null
  profileVerificationProof?: string | null
}

export interface GroupDTO {
  members: { wallet: string; publicKey: string | null; isAdmin: boolean; image: string }[]
  pendingMembers: { wallet: string; publicKey: string | null; isAdmin: boolean; image: string }[]
  contractAddressERC20: string | null
  numberOfERC20: number
  contractAddressNFT: string | null
  numberOfNFTTokens: number
  verificationProof: string
  groupImage: string | null
  groupName: string
  isPublic: boolean
  groupDescription: string | null
  groupCreator: string
  chatId: string
  meta?: string | null
  scheduleAt?: Date | null
  scheduleEnd?: Date | null
  groupType: GroupType
  status: ChatStatus | null
  eventType?: string
  encryptedSecret?: string | null
  sessionKey?: string | null
  rules?: Rules | null
}

export interface SpaceDTO {
  members: { wallet: string; publicKey: string | null; isSpeaker: boolean; image: string }[]
  pendingMembers: { wallet: string; publicKey: string | null; isSpeaker: boolean; image: string }[]
  contractAddressERC20: string | null
  numberOfERC20: number
  contractAddressNFT: string | null
  numberOfNFTTokens: number
  verificationProof: string
  spaceImage: string | null
  spaceName: string
  isPublic: boolean
  spaceDescription: string | null
  spaceCreator: string
  spaceId: string
  meta?: string | null
  scheduleAt?: Date | null
  scheduleEnd?: Date | null
  status: ChatStatus | null
  eventType?: string
  rules?: Rules | null
}

export enum GroupEventType {
  create = 'create',
  update = 'update',
  leaveGroup = 'leaveGroup',
  joinGroup = 'joinGroup',
  request = 'request',
  remove = 'remove',
  roleChange = 'roleChange'
}

export enum SpaceEventType {
  create = 'create',
  update = 'update',
  start = 'start',
  stop = 'stop',
  leaveSpace = 'leaveSpace',
  joinSpace = 'joinSpace',
  request = 'request',
  remove = 'remove',
  roleChange = 'roleChange'
}

export interface GroupConfig {
  chatId?: string
  meta: string | null
  scheduleAt: Date | null
  scheduleEnd: Date | null
  status: ChatStatus | null
  configVerificationProof: string
}

export interface GroupProfile {
  chatId?: string
  groupName: string | null
  groupDescription: string | null
  groupImage: string | null
  rules: Rules | null
  isPublic: boolean
  groupType: GroupType
  profileVerificationProof: string
}

export interface GroupIdempotent {
  members: string[]
  admins: string[]
  idempotentVerificationProof: string
}

export interface GroupDelta {
  upsert: {
    members: string[]
    admins: string[]
  }
  remove: string[]
  encryptedSecret: string | null
  deltaVerificationProof: string
}

export interface CreateGroupV2 {
  /******************* PROFILE VERIFICATION PROOF PARAMS ********************/
  groupName: string | null
  groupDescription: string | null
  groupImage: string | null
  rules: Rules | null
  isPublic: boolean
  groupType: GroupType
  profileVerificationProof: string
  /******************* CONFIG VERIFICATION PROOF PARAMS ********************/
  config: {
    meta: string | null
    scheduleAt: Date | null
    scheduleEnd: Date | null
    status: ChatStatus | null
    configVerificationProof: string
  }
  /****************** IDEMPOTENT VERIFICATION PROOF PARAMS *****************/
  admins: string[]
  members: string[]
  idempotentVerificationProof: string
}
