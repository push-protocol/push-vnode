# Push Validator Node

  

## About Validator Node

Validator nodes play a crucial role in the Push Network by ensuring the integrity and authenticity of notifications. Here’s a more technical yet approachable explanation:

**What is a Validator Node?**
A validator node in the Push Network is responsible for validating notifications before they are distributed across the network. These nodes are essential for maintaining the security and reliability of the network.

**How Does It Work?**
1. Staking Requirement:
To operate a validator node, participants must stake a certain amount of tokens. This staking process serves as a security deposit, ensuring that validators act in the network's best interest.

2. Validation Process:
When a notification is generated, the Push Network’s SDK randomly selects one validator node to verify the notification's authenticity and correctness.
After the initial verification, the notification is sent to three other randomly chosen validators for attestation. This ensures a consensus is reached and minimizes the risk of a single validator acting maliciously.

3. Quorum and Attestation:
A quorum is the minimum number of validator approvals required for a notification to be considered verified. Once this quorum is met, the notification is marked as verified.

4. Storage and Indexing:
After the notification is validated, it is stored in the queue storage of the validator node which then can be fetched by the storage nodes to index and deliver notification.

**Security Mechanisms**
1. Slashing:
If a validator node is found to be acting maliciously—such as approving fraudulent notifications—the network can penalize the validator by slashing a portion of their staked tokens. This penalty deters malicious activity and ensures that validators have a financial incentive to act honestly.
2. Random Selection:
The random selection of validators for both the initial verification and subsequent attestation adds an extra layer of security. It prevents collusion among validators and ensures that the validation process remains fair and unbiased.
  

## Project Setup Guide

  

### Pre-Installation Requirements

  

Before starting, ensure you have the following tools installed:

  

1.  **NVM (Node Version Manager)** - [Install NVM on macOS using Homebrew](https://tecadmin.net/install-nvm-macos-with-homebrew/)

2.  **Node.js versions 18 & 20** - Needed for different parts of the project (switch between them using `nvm`).

3.  **NPM (Node Package Manager)** - Required for running Hardhat.

4.  **Yarn** - Used for managing project dependencies.

  

## Installation Steps

  
### Pre-Installation Requirements

1. **Install Node.js versions**:
```bash

# For Hardhat (to  prevent  warnings)

nvm install 18

# For development (anything  works)

nvm install 20

# Switch to the latest Node.js version

nvm use 20

```

  

2. **Verify installed versions (approximates are fine)**:
```bash

nvm --version # Expected output: 0.39.1

node --version # Expected output: v20.6.1

npm --version # Expected output: 9.8.1

yarn --version # Expected output: 1.22.19

```

 3.  **Using `do.sh`**
The `do.sh` script is included inside the **`zips`** folder. It provides shortcuts for running various commands, including publishing a default test key and executing Hardhat with arguments. Ensure you review the code before executing any commands.

- **Setting up `do.sh`**
	 - Place `do.sh` in a directory accessible by your environment (e.g., your home directory).
	 - Grant execute privileges to the script:
		 ```bash
		 chmod +x do.sh
		 ```

- **Running `do.sh`**
	There are multiple ways to execute the `do.sh` script:
	 - **Full Path Execution:**
		 Navigate to the project directory:
		 ```bash
		 cd /path/to/push-storage-node-project-dir /home/user/do.sh command1 command2 command3
		 ```
	 - **Add `do.sh` to Your Path:**
		 Follow the instructions in [this Apple discussion](https://discussions.apple.com/thread/254226896?sortBy=best) to add `do.sh` to your system path. Then, navigate to the project directory:
	     ```bash
	     cd /path/to/push-storage-node-project-dir 
	     ./do.sh command1 command2 command3
	     ```
	 - **Create an Alias for `do.sh` (Recommended):**
	 Add an alias to your shell configuration:
		 ```bash
		 # Open .zshrc file 
		 nano $HOME/.zshrc 
		 # Add this line to the file 
		 alias do='/Users/your-username/Documents/projects/do.sh' 
		 # Save and close the file
		 ```
		Restart your shell to apply changes. Now, you can use `do` to run commands:
		```bash
		cd /path/to/push-storage-node-project-dir 
		do command1 command2 command3
		```

### Validator Nodes (Also called V Nodes)

1. **Install the dependencies:**
	```bash
	yarn install
	```
2. **Configure docker directories:**
To set up the validator nodes, you'll need to configure specific directories for each node. This setup ensures that each node runs independently with its own environment and key files.

    - Download and Unpack Docker Directory:
    Get the `docker-dir-for-vnodes.zip` file from the `zips` folder and extract it into your project's root directory. After extraction, you'll find a `/docker` directory containing subdirectories for each node: `/docker/01, /docker/02, and /docker/03`.
Each node directory (e.g., docker/01, docker/02, docker/03) contains the necessary configuration files and scripts to run the node.

    - Key Files within Each Node Directory:
**.env**: This file contains environment-specific properties, such as database credentials, node identifiers, and other configuration settings that the node requires to operate.
**validator_eth_key.json**: This file holds the Ethereum key for the validator node. The key is password-encrypted to ensure security. This key is essential for the node to sign and validate transactions on the network.
**History Fetcher Configuration:** For demonstration purposes, the history fetcher is turned off. This means that the nodes will not retrieve or process historical data, which simplifies the setup and reduces resource consumption during testing.

3. **MySQL Database Setup:**
For the nodes to function correctly, you need to set up three separate MySQL databases, one for each node. These databases will store the data related to each validator node.

    -  Access the MySQL command-line interface by running the following command in your terminal:
   ```bash
   mysql -u root -p PASSWORD=pass
   ```
    - Once you're in the MySQL CLI, create each of the databases by running the following commands:
    ```bash
    CREATE DATABASE vnode1 CHARACTER SET utf8 COLLATE utf8_general_ci;
    CREATE DATABASE vnode2 CHARACTER SET utf8 COLLATE utf8_general_ci;
    CREATE DATABASE vnode3 CHARACTER SET utf8 COLLATE utf8_general_ci;

    ```
    - Run the nodes in separate terminals:
    ```bash
    # Run Validator Node 1
    do debug.v1

    # Run Validator Node 2
    do debug.v2

    # Run Validator Node 3
    do debug.v3
    ```
    - After starting the nodes, you can add mock data to each database to simulate channel subscriptions. This helps in syncing with the local EVM for demonstration purposes.
    ```shell
    INSERT INTO channels (channel, ipfshash, name, info, url, icon, processed, attempts, alias_address, alias_blockchain_id, is_alias_verified, blocked, alias_verification_event, activation_status, verified_status, subgraph_details, subgraph_attempts, counter, timestamp, channel_settings)
    VALUES ('eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681', 'QmTX8zZjzuKpiLZmn4ShNzyKDakNdbBQfwi449TBw7wgoK', 'testing goerli', 'Testing', 'https://dev.push.org/', 'https://gateway.ipfs.io/ipfs/bafybeidkt3qrlcplntabfazs7nnzlxdzu36mmieth2ocyphm2kp4sh333a/QmTX8zZjzuKpiLZmn4ShNzyKDakNdbBQfwi449TBw7wgoK', 1, 0, 'NULL', 'NULL', 0, 0, null, 1, 0, null, 0, null, '2023-08-11 13:45:05', null);

    INSERT INTO subscribers (is_currently_subscribed, channel, alias, subscriber, signature, timestamp, sub_timestamp, unsub_timestamp, user_settings) 
    VALUES (1, 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681', null, 'eip155:0x5ac9E6205eACA2bBbA6eF716FD9AabD76326EEee', 'eip155:5:0xba3f4df977fc09614e86c84ab4857ce9b113d52dde258aedfa263fc29018f611', '2022-10-04 08:10:12', '2022-10-04 08:10:12', null, 'null');

    INSERT INTO subscribers (is_currently_subscribed, channel, alias, subscriber, signature, timestamp, sub_timestamp, unsub_timestamp, user_settings) 
    VALUES (1, 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681', null, 'eip155:0x69e666767Ba3a661369e1e2F572EdE7ADC926029', 'eip155:5:0xc5147c36467f489c212460e01dfd1ede1d853d67d17c042e994100b89a0d5a9d', '2022-10-20 12:27:48', '2022-10-20 12:27:48', null, 'null');

    INSERT INTO subscribers (is_currently_subscribed, channel, alias, subscriber, signature, timestamp, sub_timestamp, unsub_timestamp, user_settings) 
    VALUES (1, 'eip155:5:0xD8634C39BBFd4033c0d3289C4515275102423681', null, 'eip155:0xD8634C39BBFd4033c0d3289C4515275102423681', 'eip155:5:0xba3f4df977fc09614e86c84ab4857ce9b113d52dde258aedfa263fc29018f611', '2022-10-04 08:10:12', '2022-10-04 08:10:12', null, 'null');

    ```


## Testing the node with CURL

1. Get a validator Token
**Request:**
    ```curl
     curl --location 'http://localhost:4001/apis/v1/messaging/validatorToken'
    ```
    **Response:**
    ```json
    {"validatorToken":"eyJub2RlcyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE2OTUxODg4ODAwMjQsInJhbmRvbUhleCI6ImE1MDBhYmE5MjFmM2FiOGIwYjdiODY2Y2NmZDFkZjk2ZDdjNzg2MGIiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE2OTUxODg4ODAwMTYsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTY5NTE4ODg4MDAxNSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4N2Q2YzJkOTczMzg0ODIwNGFiYmNmZjcwZjYwYzJkZDg5MDFlZDJhOWUyODg1NWQ3YTdkZjgwYzI1NzBjZTQ3NzM0NThhMzBjNDBkM2FkYjU4NmIzYzNmYmJkYjhmZmQyYmQwYTIzMjhjNDRjMjBjNWM3OTQ3M2RmZjA2Y2JlZmIxYyJ9LHsibm9kZUlkIjoiMHg5OEY5RDkxMEFlZjlCM0I5QTQ1MTM3YWYxQ0E3Njc1ZUQ5MGE1MzU1IiwidHNNaWxsaXMiOjE2OTUxODg4ODAwMjMsInJhbmRvbUhleCI6IjE4ZjlhMTg5NDNmYzMyY2M0MDdkZTYwZDgzMmNjNDk2NjAxMjg2ZTciLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE2OTUxODg4NTAwMzgsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweGZEQUVhZjdhZkNGYmI0ZTRkMTZEQzY2YkQyMDM5ZmQ2MDA0Q0ZjZTgiLCJ0c01pbGxpcyI6MTY5NTE4ODg1MDAzNiwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4ZDFjNmM5NjUwM2I4YTk5YzgxY2EwZmJkODE3Y2NlNmY2ODU1MTVkMWQ4NDA2YmE5ZjgzNTZkZmU1NTc3YTFlNzAwMjc0MDIxMTFjZTNkNjkyMDQ0Y2I2NDIzMzEzZWY0NzkzM2RmYmNkYWY0ZWNmNzhlN2YzOTk0ZjJkZGQ1NjAxYiJ9LHsibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE2OTUxODg4ODAwMzAsInJhbmRvbUhleCI6ImZmNTQxNWI1ZDFkNzM1MWRlMTI5ZjU1M2NjMzRiNDQ2MTRhODdjMjIiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE2OTUxODg4ODAwMTksInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTY5NTE4ODg4MDAxOCwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4NzIyYTIwOTNjOTM5OTkzYzIxYjhjYzEzNGY3MDc1NGRiYjk1YjExODZlODk2ZmY2YjE0OWMyODMwYmUwMDIzMTI5ZGY2ZTkxYjFlZjMwYWE0Zjc5MmQ5NTAxYjgwN2RlZGY4YjMyNDU4ZDZkZTE4MmMyNzNiYzI0N2Y0M2I5ZTkxYiJ9XX0=","validatorUrl":"http://localhost:4001"}%  

    ```
2. Send Notification with Pre-existing API Token
    **Request:**
    ```curl
    curl --location 'http://localhost:4001/apis/v1/messaging/addBlocking' \
    --header 'Content-Type: application/json' \
    --data '{
	"verificationProof": "eip712v2:0x37ba76d10dceff2c4675d186a17b0e0ffe6020eef42ba170a2436192051996ad3daf835bb660bbad587f44a4e153bd9285fe0a166b35abd978453942f0b325ec1c::uid::1675756031",
	"sender": "eip155:1155111:0xD8634C39BBFd4033c0d3289C4515275102423681",
	"recipient": "eip155:1155111:0xD8634C39BBFd4033c0d3289C4515275102423681",
	"identity": "0+1+Hey From Push Nodes+Dropping test directly on push nodes ",
	"source": "ETH_TEST_GOERLI",
    "validatorToken": "eyJub2RlcyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MDM5Mjk1NjAwMjcsInJhbmRvbUhleCI6IjEwYjFlNzJlOWMxYzU0MGM3YmNmMmRjZjMyOTgwZjU0MTI0MGJiNDYiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MDM5Mjk1NjAwMTYsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcwMzkyOTU2MDAyNSwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4OTE5YzIzOGYzNGIzMGFjYWRkMTdkMzU1ZmE2YzIxOGNkMmI4OWY4MjkyYzVhMTRjNjdhOWVkYTNmMDEzYzU1MjFjNjQ0NDkxMzE0ODViMjViYmRlOWFiM2IxZjlmNWU5ZmY2ZGQ4NTM3MjM5Mzk5YTFhOThjNjVmMGRjNTJiNDExYyJ9LHsibm9kZUlkIjoiMHg5OEY5RDkxMEFlZjlCM0I5QTQ1MTM3YWYxQ0E3Njc1ZUQ5MGE1MzU1IiwidHNNaWxsaXMiOjE3MDM5Mjk1NjAwMjgsInJhbmRvbUhleCI6IjM4MjY4ZjUyZGQyODU1Zjk3Y2FiZGViYTFiZmIwM2U2NDQ0YjA4NzciLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MDM5Mjk1NjAwMTksInN0YXR1cyI6MX0seyJub2RlSWQiOiIweGZEQUVhZjdhZkNGYmI0ZTRkMTZEQzY2YkQyMDM5ZmQ2MDA0Q0ZjZTgiLCJ0c01pbGxpcyI6MTcwMzkyOTU2MDAyMywic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4NmI1NDE2M2VjN2M3ODRiYzQ1Y2E2Y2Y1MTE1ZWQwYWZkNTlmM2IxMzJmNTc4OGQ1YzFhOTcyODgzZmZjM2JiOTY5MjJiNWNkMmM2ZDJhMjkxYjRiMzVjYTliMWM2MTA0N2IwYjNkNWQ4OTdiZTE3ZmNjZWRlOTNjYmUwY2Q1MTAxYyJ9LHsibm9kZUlkIjoiMHg4ZTEyZEUxMkMzNWVBQmYzNWI1NmIwNEU1M0M0RTQ2OGU0NjcyN0U4IiwidHNNaWxsaXMiOjE3MDM5Mjk1NjAwMjksInJhbmRvbUhleCI6IjVkMzAxNTU5YjgyM2FjYmQwNGM0YWRiODU4MmIxYWI3OWQxMWI0MTIiLCJwaW5nUmVzdWx0cyI6W3sibm9kZUlkIjoiMHhmREFFYWY3YWZDRmJiNGU0ZDE2REM2NmJEMjAzOWZkNjAwNENGY2U4IiwidHNNaWxsaXMiOjE3MDM5Mjk1NjAwMTUsInN0YXR1cyI6MX0seyJub2RlSWQiOiIweDk4RjlEOTEwQWVmOUIzQjlBNDUxMzdhZjFDQTc2NzVlRDkwYTUzNTUiLCJ0c01pbGxpcyI6MTcwMzkyOTU2MDAyOCwic3RhdHVzIjoxfV0sInNpZ25hdHVyZSI6IjB4NmZhMzZiZDE4MDNkZGVhYWMzODRmN2VhNDUzY2FhZDNjZWJlNTJmN2E3ZTRkZTY1YmY2ZTNjZTY3OGQxMTM3ODNkOGY1MGNhNTIxMzgzNzA2ODNlODYzN2MwYWJkOGY2ZjE1ZGIwZjVjOTdmNmVhMjE0ZmFkNzQ2Y2M5OWViOWIxYiJ9XX0="
    }'
    ```
3. Show subscribers (Works for any VNode)
    **Request:**
    ```curl
    curl --location 'http://localhost:4001/apis/v1/messaging/settings/eip155:11155111:0xD8634C39BBFd4033c0d3289C4515275102423681/ETH_TEST_GOERLI'
    ```

