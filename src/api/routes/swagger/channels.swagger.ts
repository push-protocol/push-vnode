/**
 * @swagger
 * tags:
 *   - name: Channels
 *     description: Channel related APIs
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Channel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the channel
 *         channel:
 *           type: string
 *           description: The address of the channel
 *         ipfshash:
 *           type: string
 *           description: The ipfshash address of the channel
 *         name:
 *           type: string
 *           description: The name of the channel
 *         info:
 *           type: string
 *           description: The channel info
 *         url:
 *           type: string
 *           description: The channel url
 *         icon:
 *           type: string
 *           description: The channel icon
 *         iconV2:
 *           type: string
 *           description: The channel base64 icon
 *         processed:
 *           type: integer
 *           description: The channel status
 *         attempts:
 *           type: integer
 *           description: The attempts of channel
 *         alias_address:
 *           type: string
 *           description: The alias address of channel
 *         alias_blockchain_id:
 *           type: string
 *           description: The alias blockchain id of channel
 *         is_alias_verified:
 *           type: integer
 *           description: Is channel alias verified
 *         blocked:
 *           type: integer
 *           description: Is channel blocked
 *         alias_verification_event:
 *           type: string
 *           description: The alias verification event of channel
 *         activation_status:
 *           type: integer
 *           description: The activation status of channel
 *         verified_status:
 *           type: integer
 *           description: The verified status of channel
 *         subgraph_details:
 *           type: string
 *           description: The subgraph details of channel
 *         counter:
 *           type: integer
 *           description: The channel counter
 *         timestamp:
 *           type: string
 *           description: The channel creation timestamp
 *         itemcount:
 *           type: integer
 *           description: The total channel count
 *         subscriber_count:
 *           type: integer
 *           description: The subscriber count of channel
 *       example:
 *         id: 4
 *         channel: '0x6cDF5Bf36e89a526c723E39c1f8c4D485aBb6722'
 *         ipfshash: 'bafkreidmlfisdypciucfewfqtsoov7ol5svmxcrappinohhuw2n7whcv4i'
 *         name: null,
 *         info: null,
 *         url: null,
 *         icon: null,
 *         iconV2: null,
 *         processed: 0,
 *         attempts: 3,
 *         alias_address: null,
 *         alias_blockchain_id: null,
 *         is_alias_verified: 0,
 *         blocked: 0,
 *         alias_verification_event: null,
 *         activation_status: 1,
 *         verified_status: 0,
 *         subgraph_details: null,
 *         counter: null,
 *         timestamp: 2022-09-02T22:04:57.000Z,
 *         itemcount: 118,
 *         subscriber_count: 2
 */

/**
 * @swagger
 * /apis/v1/channels:
 *   get:
 *     summary: Returns the list of all the channels in a paginated manner
 *     tags: [Channels]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *           minimum: 1
 *           default: 1
 *         required: false
 *         description: Page number of the channels
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 1
 *           maximum: 30
 *           minimum: 1
 *           default: 10
 *         required: false
 *         description: Number of channels per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: subscribers
 *           default: subscribers
 *         required: false
 *         description: Sort channels based on attribute
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           example: desc
 *           default: desc
 *           enum: [asc, desc]
 *         required: false
 *         description: Sort channels based on attribute
 *     responses:
 *       200:
 *         description: The list of the channels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *                 itemcount:
 *                   type: integer
 *                   example: 750
 */

/**
 * @swagger
 * /apis/v1/channels/search:
 *   get:
 *     summary: Returns the list of all the channels with in search criteria in a paginated manner
 *     tags: [Channels]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *           minimum: 1
 *           default: 1
 *         required: false
 *         description: Page number of the channels
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 1
 *           maximum: 30
 *           minimum: 1
 *           default: 10
 *         required: false
 *         description: Number of channels per page
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *           example: eip155:42:0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4
 *           default: eip155:42:0x778D3206374f8AC265728E18E3fE2Ae6b93E4ce4
 *         required: true
 *         description: Query value which is used for searching the channel
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           example: desc
 *           default: desc
 *           enum: [asc, desc]
 *         required: false
 *         description: Sort channels based on attribute
 *     responses:
 *       200:
 *         description: The list of the channels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *                 itemcount:
 *                   type: integer
 *                   example: 750
 */

/**
 * @swagger
 * /apis/v1/channels/{channelsInCAIP}/subscribe:
 *   post:
 *     summary: Subscribe to a channel
 *     tags: [Channels]
 *     parameters:
 *       - in: path
 *         name: channelAddressInCAIP
 *         schema:
 *           type: string
 *           example: 'eip155:42:0x26c10f76ecdec3d43c492061640ab67093cb89ef'
 *         required: true
 *         description: Channel address in CAIP format
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *                verificationProof:
 *                  type: string
 *                  required: true
 *                  example: "Need to add"
 *                message:
 *                  type: string
 *                  required: true
 *                  example: "Need to add"
 *     responses:
 *       204:
 *         description: Subscribed to the channel successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /apis/v1/channels/{channelsInCAIP}/unsubscribe:
 *   post:
 *     summary: Unsubscribe to a channel
 *     tags: [Channels]
 *     parameters:
 *       - in: path
 *         name: channelAddressInCAIP
 *         schema:
 *           type: string
 *           example: 'eip155:42:0x26c10f76ecdec3d43c492061640ab67093cb89ef'
 *         required: true
 *         description: Channel address in CAIP format
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *                verificationProof:
 *                  type: string
 *                  required: true
 *                  example: "Need to add"
 *                message:
 *                  type: string
 *                  required: true
 *                  example: "Need to add"
 *     responses:
 *       204:
 *         description: Unsubscribed to the channel successfully
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /apis/v1/channels/{channelsInCAIP}:
 *   get:
 *     summary: Get channel by address
 *     tags: [Channels]
 *     parameters:
 *       - in: path
 *         name: channelAddressInCAIP
 *         schema:
 *           type: string
 *           example: 'eip155:42:0x26c10f76ecdec3d43c492061640ab67093cb89ef'
 *         required: true
 *         description: Channel address in CAIP format
 *     responses:
 *       200:
 *         description: The list of the channels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               $ref: '#/components/schemas/Channel'
 */
