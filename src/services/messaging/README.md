This is main validator class.

# Sdk
- asks networkRandao from a random validator
- networkRandao is
  NetworkRandao = [NodeState]
  NodeState = nodeId: {randomString, [nodeId]:boolean, nodeSignature}
- getValidators(NetworkRandao):nodeId[]

# ValidatorNode
## as validator
- collects PayloadItem from user sdk calls in a MessageBlock
- processes its message block once every X seconds
    1. defines a new message block (with inputs as PayloadItems, outputs as FeedItems)
    2. converts PayloadItem[] -> FeedItem[]
       2.1. generate random vector of nodes: v1, a2, a3, s1, s2, s3
    3. asks every attester for it's signature
    4. calls storage nodes (todo calculate which one are mandatory)
    5. calls delivery node
## as attester
- receives message block from other validators
- checks each FeedItems signatures in the message block
- executes its own convertion PayloadItem[] -> FeedItem[]
- replies with a new signature

# Storage types

| Num | Data | Storage type | read api | write api |
| ---- | ----| ----- | ---- | ---- |
| 1 | per-user subscriptions (specifies what channel can send you data) <br>  and per-user channel notification settings (specifies how these notifications are filtered) | Validator DSet 'subscriptions' | Read Channel Settings , Get User Subscriptions, Get Channel Subscribers | Subscribe User, Set User Channel Settings |
| 2 | Channel settings (specifies which properties each channel notification has) | Blockchain -> Fetcher -> MySql table | Read Channel Settings | Set Channel Settings |
| 3 | per-user notifications | Validator -> Storage Node | Read Notifications by User | Send Notification |
| 4* | push profile (can store pgp keys) | Not Implemented| Read Push Profile | Set Push Profile |