import { mainnet, sepolia } from 'viem/chains'
import { ethers, Wallet } from 'ethers'
import { Address } from 'viem'

const VALIDATOR_PRIVATE_KEY = process.env.VALIDATOR_PRIVATE_KEY || ''
const BEACONCHAIN_API_KEY = process.env.BEACONCHAIN_API_KEY || ''

export function parseSearchParams(
  params: URLSearchParams
): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    query[key] = value
  }
  return query
}

export type Signature = {
  r: `0x${string}`
  s: `0x${string}`
  _vs: string
  recoveryParam: number
  v: number
  yParityAndS: string
  compact: string
}

export const createDomainSeparator = (
  name: string,
  contractAddress: string,
  network: string,
  tokenId = '1'
): string => {
  // tokenId is use for 1155s, where each tokenId has different mint requirements.
  // for 712s, tokenId is always 1.

  const networkId = network === 'homestead' ? mainnet.id : sepolia.id

  const DOMAIN_SEPARATOR = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'uint256', 'address'],
      [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name)),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(tokenId)),
        networkId,
        contractAddress,
      ]
    )
  )

  return DOMAIN_SEPARATOR
}

export const generateSignature = async (
  address: string,
  validatorIndex: number,
  domainSeparator: string
) => {
  const signer = new Wallet(VALIDATOR_PRIVATE_KEY)

  const payloadHash = ethers.utils.defaultAbiCoder.encode(
    ['bytes32', 'address', 'uint256'],
    [domainSeparator, address, validatorIndex]
  )
  const messageHash = ethers.utils.keccak256(payloadHash)

  const signedAddress = await signer.signMessage(
    ethers.utils.arrayify(messageHash)
  )
  const signature: ethers.Signature = ethers.utils.splitSignature(signedAddress)
  return signature
}

export const generateMintingSignature = async (
  memberAddress: string,
  validatorIndex: number,
  projectSlug: string,
  contractAddress: string,
  network: string
): Promise<Signature> => {
  const domainSeparator = createDomainSeparator(
    projectSlug,
    contractAddress,
    network
  )
  const signature = await generateSignature(memberAddress, validatorIndex, domainSeparator)
  return signature as Signature
}

type ValidatorResponse = {
  status: string
  data: Array<{
    publickey: string
    validatorindex: number
  }>
}

type ExecutionResponse = {
  status: string
  data: Array<{
    blockHash: string
    blockNumber: number
    timestamp: number
    blockReward: number
    blockMevReward: number
    producerReward: number
    feeRecipient: string
    gasLimit: number
    gasUsed: number
    baseFee: number
    txCount: number
    internalTxCount: number
    uncleCount: number
    parentHash: string
    uncleHash: string
    difficulty: number
    posConsensus: {
      executionBlockNumber: number
      proposerIndex: number
      slot: number
      epoch: number
      finalized: boolean
    }
    relay: {
      tag: string
      builderPubkey: string
      producerFeeRecipient: string
    }
    consensusAlgorithm: string
  }>
}

export async function fetchBeaconChainData(userAddress: Address): Promise<{ executionData: ExecutionResponse, validatorIndex: number } | undefined > {
  try {
    const validatorUrl = `https://beaconcha.in/api/v1/validator/withdrawalCredentials/${userAddress}?limit=10&offset=0&apikey=${BEACONCHAIN_API_KEY}`
    const validatorRes = await fetch(validatorUrl)
    const validatorData: ValidatorResponse = await validatorRes.json()

    if (validatorData.status === 'OK' && validatorData.data.length > 0) {
      const validatorIndex = validatorData.data[0].validatorindex

      const executionUrl = `https://beaconcha.in/api/v1/execution/${validatorIndex}/produced?offset=0&limit=10&sort=desc&APIKEY=${BEACONCHAIN_API_KEY}`
      const executionRes = await fetch(executionUrl)
      const executionData: ExecutionResponse = await executionRes.json()

      if (executionData.status === 'OK') {
        const executionInfo = executionData.data
        // Do something with executionInfo
        console.log(executionInfo)
        return { executionData, validatorIndex }
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error)

  }
}
