import { create, IPFSHTTPClient } from 'ipfs-http-client'

// const IPFS: IPFSHTTPClient = create({ host: 'epns-gateway.infura-ipfs.io', port: 5001, protocol: 'https' })
const IPFS: IPFSHTTPClient = create()
export default IPFS
