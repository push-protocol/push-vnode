import { GroupDTO, Rules, SpaceDTO } from './groupChat'

export * from './groupChat'

export enum ChatStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  ENDED = 'ENDED'
}

export enum GroupType {
  DEFAULT = 'default',
  SPACES = 'spaces'
}

export interface Chat {
  combinedDID: string
  threadhash: string | null
  intent: string
  intentSentBy: string
  readonly intentTimestamp?: Date
  chatId: string
  //for gitcoin and other specific collab purpose
  meta?: string
  // Group properties
  groupName?: string
  groupDescription?: string
  groupImage?: string
  admins?: string
  isPublic?: boolean
  contractAddressNFT?: string
  numberOfNFTs?: number
  contractAddressERC20?: string
  numberOfERC20?: number
  verificationProof?: string
  scheduleAt?: Date | null
  scheduleEnd?: Date | null
  groupType: GroupType
  status: ChatStatus | null
  sessionKey?: string | null
  rules?: Rules | null
  profileVerificationProof?: string
  configVerificationProof?: string
  groupVersion?: 'v1' | 'v2'
}

export interface User {
  did: string
  wallets: string
  profilePicture: string | null
  publicKey: string
  encryptedPrivateKey: string
  encryptionType: string
  encryptedPassword: string | null
  nftOwner: string | null
  signature: string
  sigType: string
  about: string | null
  name: string | null
  numMsg: number
  allowedNumMsg: number
  linkedListHash?: string | null
  origin?: string | null
}

export interface UserProfile {
  name: string | null
  desc: string | null
  picture: string | null
  blockedUsersList: Array<string> | null
  profileVerificationProof: string | null
}

export interface UserV2 {
  msgSent: number
  maxMsgPersisted: number
  did: string
  wallets: string
  profile: UserProfile
  encryptedPrivateKey: string | null
  publicKey: string | null
  verificationProof: string | null
  origin?: string | null
}

export interface RoleCounts {
  total: number
  pending: number
}

export interface ChatMemberCounts {
  overallCount: number
  adminsCount: number
  membersCount: number
  pendingCount: number
  approvedCount: number
  roles: {
    ADMIN: RoleCounts
    MEMBER: RoleCounts
  }
}

export interface ChatMemberProfile {
  address: string
  intent: boolean
  role: string
  userInfo: UserV2
}

export interface ChatMemberPublicKey {
  did: string
  publicKey: string
}

export interface ChatMember {
  id: number
  chat_id: string
  address: string
  role: string
  intent: number
}

export interface GroupMembersInfo {
  totalMembersCount: number
  members: ChatMemberProfile[]
}

export interface MemberUpdates {
  add: Record<string, string[]> // Each key is a role name, with an array of member addresses added to that role
  remove: Record<string, string[]> // Each key is a role name, with an array of member addresses removed from that role
  change: Array<{
    // An array of objects detailing changes, including previous and new roles
    address: string // The address of the member whose role is changing
    newRole: string // The new role of the member
    previousRole: string // The previous role of the member before the change
  }>
}

export interface UserCreate {
  caip10: string
  did: string
  publicKey: string
  encryptedPrivateKey: string
  encryptionType: string
  encryptedPassword: string | null
  name: string
  nftOwner: string | null
  signature: string | null
  sigType: string | null
  verificationProof?: string | null
  origin?: string | null
}

export interface EncryptionKeys {
  publicKeyArmored: string
  encryptedPrivateKey: string
}

export interface W2WMeta {
  publicKeyArmored: string
  encryptedPrivateKey: string
  messagesSent: number
  messagesMax: number
}

export interface UpdateIntent {
  fromDID: string
  toDID: string
  signature: string
  sigType: string
  status: IntentStatus
  verificationProof: string
  encryptedSecret?: string | null
}

export interface RejectIntent {
  fromDID: string
  toDID: string
  verificationProof: string
}

export enum IntentStatus {
  Approved = 'Approved',
  Reproved = 'Reproved'
}

export interface BaseInbox {
  did?: string
  wallets?: string
  profilePicture?: string
  publicKey?: string
  about?: string
  name?: string
  threadhash?: string
  intent?: string
  intentSentBy?: string
  intentTimestamp: Date
  combinedDID: string
}

export interface Inbox extends BaseInbox {
  chatId?: string
  groupInformation?: GroupDTO
}

export interface ChatInbox extends Inbox {
  msg: Message
}

export interface RequestInbox extends Inbox {
  msg: Message
}

export interface SpaceInbox extends BaseInbox {
  spaceId?: string
  spaceInformation?: SpaceDTO
}

export interface UserInfo {
  wallets: string
  image: string
  publicKey: string
  name: string
  isAdmin: boolean
}

export interface MessageDTO {
  fromCAIP10: string
  toCAIP10: string
  fromDID: string
  toDID: string
  messageType: string
  messageObj?:
    | {
        content: string
        meta: { [key: string]: any }
      }
    | string
  /**
   * @deprecated
   */
  messageContent: string
  /**
   * @deprecated
   */
  signature: string
  /**
   * @deprecated
   */
  sigType: string
  timestamp?: number
  encType: string
  encryptedSecret: string
  verificationProof?: string
  sessionKey?: string | null
}

export enum MessageType {
  Text = 1,
  Image = 2,
  /**
   * @deprecated
   */
  GIF = 3,
  /**
   * NOT IMPLEMENTED
   */
  Payment = 4,
  /**
   * NOT IMPLEMENTED
   */
  Video = 5,
  /**
   * NOT IMPLEMENTED
   */
  Audio = 6,
  File = 7,
  MediaEmbed = 8,
  Meta = 9,
  /**
   * NOT IMPLEMENTED
   */
  Custom = 10,
  /**
   * NOT IMPLEMENTED
   */
  Reply = 11,
  /**
   * NOT IMPLEMENTED
   */
  Composite = 12
}

export enum MessageCategory {
  Chat = 'Chat',
  Request = 'Request',
  Approve = 'Approve',
  Reject = 'Reject'
}

export interface Message extends MessageDTO {
  link: string | null
  reference?: string
}
