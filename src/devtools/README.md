# The purpose of this file is to keep the folder alive on remote git
# devtools folder exists only for development tools and debugging
# To use, ensure secrets.smaple.json has everything secrets.json need or at least the fuction for which you want to call this function

## Available tools
### Notification Payload Generation
yarn devtools src/devtools/notification/devtools.verificationEIP712V2.mjs

### Subscribe / Unsubscribe Payload Generation
yarn devtools src/devtools/subscription/devtools.verificationEIP712V2.mjs

### Encryption Key Payload Generation
yarn devtools src/devtools/encryptionKey/devtools.verificationEIP712V2.mjs

### Chat New User Payload Generation
yarn devtools src/devtools/chat/devtools.newUserPayload.mjs

### Chat New User Payload Generation Without Domain
yarn devtools src/devtools/chat/devtools.newUserPayloadWithoutDomain.mjs

### Channel Precache verification proof
yarn devtools src/devtools/channel/channelPrecache.mjs

### Call Contract Functions
## Add Delegate
yarn devtools src/devtools/contract/devtools.addDelegate.mjs
### Function Calls
Call a function by passing --func= and --module= 