require("dotenv").config();
const { ConfigHelper, Aquarius } = require("@oceanprotocol/lib");
const ethers = require("ethers");

async function oceanConfig() {
  const configHelper = new ConfigHelper();
  const network = process.env.OCEAN_NETWORK || 'sepolia';
  
  let config = configHelper.getConfig(network);

  if (!config) {
    throw new Error(`No config found for network: ${network}`);
  }

  console.log('Network configuration:', JSON.stringify(config, null, 2));

  let provider;
  if (process.env.INFURA_PROJECT_ID) {
    provider = new ethers.providers.InfuraProvider(network, process.env.INFURA_PROJECT_ID);
  } else {
    // Fallback to a public RPC endpoint for Sepolia
    provider = new ethers.providers.JsonRpcProvider("https://rpc.sepolia.org");
  }

  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const connectedNetwork = await provider.getNetwork();
  console.log('Connected to network:', connectedNetwork);

  if (connectedNetwork.chainId !== config.chainId) {
    throw new Error(`Connected to wrong network. Expected ${config.chainId} (${network}), got ${connectedNetwork.chainId} (${connectedNetwork.name})`);
  }

  console.log('Signer address:', await signer.getAddress());

  const aquarius = new Aquarius(config.metadataCacheUri);

  config = {
    ...config,
    provider: provider,
    signer: signer,
    providerUri: process.env.PROVIDER_URL || config.providerUri,
    aquarius: aquarius
  };

  return config;
}

module.exports = {
  oceanConfig
};