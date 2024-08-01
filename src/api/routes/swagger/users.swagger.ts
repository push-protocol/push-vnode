/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User related APIs
 */

/**
 * @swagger
 * /apis/v1/users/{userAddressInCAIP}/subscriptions:
 *   get:
 *     summary: Returns the list of channels which the user has subscribed
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userAddressInCAIP
 *         schema:
 *           type: string
 *           example: 'eip155:42:0x36cd360396Cb05a6B44D08Da992339461093B22B'
 *         required: true
 *         description: User's wallet address in CAIP format
 *     responses:
 *       200:
 *         description: The list of the channels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subscriptions:
 *                    type: array
 *                    items :
 *                      type: object
 *                      properties:
 *                        channel:
 *                          type: string
 *                      example:
 *                            channel: '0x4989f31eCbA30903d562ae6eE2780360485D909f'
 */

/**
 * @swagger
 * /apis/v1/users/{userAddressInCAIP}/delegations:
 *   get:
 *     summary: Returns the list of delegations for a given user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userAddressInCAIP
 *         schema:
 *           type: string
 *           example: 'eip155:42:0x87cd9E5a85960FdA817b29299465BDdbBeD51f9b'
 *         required: true
 *         description: User's wallet address in CAIP format
 *     responses:
 *       200:
 *         description: The list of the delegations for a given user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 delegations:
 *                    type: array
 *                    items :
 *                      type: object
 *                      properties:
 *                        channel:
 *                          type: string
 *                      example:
 *                            channel: '0x4A90581c1e5aBe2Ee7f1F7ffc0E5837572b79052'
 */

/**
 * @swagger
 * /apis/v1/users/{userAddressInCAIP}/feeds:
 *   get:
 *     summary: Returns the list of feeds for a given user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userAddressInCAIP
 *         schema:
 *           type: string
 *           example: 'eip155:42:0x26c10f76ecdec3d43c492061640ab67093cb89ef'
 *         required: true
 *         description: User's wallet address in CAIP format
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *           minimum: 1
 *           default: 1
 *         required: false
 *         description: Page number of the feeds
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 1
 *           maximum: 30
 *           minimum: 1
 *           default: 10
 *         required: false
 *         description: Number of feeds per page
 *       - in: query
 *         name: spam
 *         schema:
 *           type: boolean
 *           example: false
 *           default: false
 *         required: false
 *         description: Fetch spam feeds
 *     responses:
 *       200:
 *         description: The list of the feeds for a given user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 feeds:
 *                    type: array
 *                    items :
 *                      type: object
 *                      properties:
 *                        payload_id:
 *                          type: integer
 *                        sender:
 *                          type: string
 *                        epoch:
 *                          type: string
 *                        payload:
 *                          type: object
 *                        source:
 *                          type: string
 *                        etime:
 *                          type: string
 *                      example:
 *                            payload_id: 43
 *                            sender: '0x26c10F76ECdEC3D43C492061640AB67093cb89EF'
 *                            epoch: '2022-09-01T05:31:52.000Z'
 *                            payload: {}
 *                            source: 'ETH_TEST_KOVAN'
 *                            etime: '2022-09-01T05:31:52.000Z'
 */
