import IPFSClient from '../helpers/ipfsClient'

export default async () => {
  await IPFSClient.connect()
}
