const fs = require('fs');
const path = require('path');
const { oceanConfig } = require('./config');
const { 
  NftFactory, 
  Nft, 
  getHash, 
  FixedRateExchange,
  ZERO_ADDRESS
} = require('@oceanprotocol/lib');
const { ethers } = require('ethers');

// Read the configuration file
const nftConfigPath = path.join(__dirname, 'nft-config.json');
console.log(`Reading configuration from: ${nftConfigPath}`);
const nftConfig = JSON.parse(fs.readFileSync(nftConfigPath, 'utf8'));
console.log('Configuration loaded:', nftConfig);

async function createDataNFT() {
  try {
    console.log('Initializing Ocean configuration...');
    const config = await oceanConfig();
    console.log(`Using network: ${config.network}`);
    console.log('Ocean configuration:', JSON.stringify(config, null, 2));

    // Check network connection
    const network = await config.provider.getNetwork();
    console.log('Connected to network:', network.name, network.chainId);

    if (network.chainId !== config.chainId) {
      throw new Error(`Connected to wrong network. Expected ${config.chainId}, got ${network.chainId}`);
    }

    // Check account balance
    const balance = await config.provider.getBalance(await config.signer.getAddress());
    console.log('Account balance:', ethers.utils.formatEther(balance), 'ETH');

    if (balance.isZero()) {
      throw new Error('Account has no ETH. Please fund your account with Sepolia ETH.');
    }

    console.log('Creating NftFactory instance...');
    const nftFactory = new NftFactory(config.nftFactoryAddress, config.signer);
    console.log(`NftFactory created with address: ${config.nftFactoryAddress}`);

    // Check if contract is deployed
    const code = await config.provider.getCode(nftFactory.address);
    if (code === '0x') {
      throw new Error('No contract deployed at the NFTFactory address');
    }

    // Test simple call
    try {
      const owner = await nftFactory.getOwner();
      console.log('NFT Factory owner:', owner);
    } catch (error) {
      console.error('Error getting NFT Factory owner:', error);
      throw error;
    }

    console.log('Preparing NFT parameters...');
    const nftParams = {
      name: nftConfig.nft.name,
      symbol: nftConfig.nft.symbol,
      templateIndex: 1,
      tokenURI: '',
      transferable: true,
      owner: await config.signer.getAddress()
    };
    console.log('NFT parameters:', JSON.stringify(nftParams, null, 2));

    console.log('Creating NFT...');
    try {
      const templateCount = await nftFactory.getCurrentNFTTemplateCount();
      console.log('Current NFT template count:', templateCount);

      const tx = await nftFactory.createNFT(nftParams);
      console.log('NFT creation transaction hash:', tx.hash);
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('Transaction confirmed. Receipt:', JSON.stringify(receipt, null, 2));
      const nftAddress = receipt.events[0].args.newTokenAddress;
      console.log('NFT created at address:', nftAddress);

      // Set metadata
      console.log('Setting metadata...');
      const nft = new Nft(config.signer);
      const metadataState = 0; // Active
      const metadata = {
        name: nftConfig.metadata.name,
        description: nftConfig.metadata.description,
        author: nftConfig.metadata.author,
        type: 'dataset',
        license: 'CC-BY',
        tags: ['sample', 'ocean', 'tutorial'],
        additionalInformation: {
          crypto: "payments"
        }
      };

      const metadataHash = await getHash(JSON.stringify(metadata));
      await nft.setMetadata(
        nftAddress,
        await config.signer.getAddress(),
        metadataState,
        config.providerUri,
        '',
        '0x2',
        JSON.stringify(metadata),
        metadataHash
      );

      console.log('Metadata set for NFT');

      // Set up pricing
      console.log('Setting up fixed rate exchange...');
      const fixedRate = new FixedRateExchange(config.fixedRateExchangeAddress, config.signer);
      const datatokenAddress = await nft.getDatatokenAddress(nftAddress);
      
      await fixedRate.createExchange(
        datatokenAddress,
        config.oceanTokenAddress,
        await config.signer.getAddress(),
        nftConfig.pricing.price,
        nftConfig.pricing.oceanAmount,
        await config.signer.getAddress(),
        '0'
      );
      
      console.log('Fixed rate exchange created');
      console.log('NFT creation, metadata setup, and pricing complete!');
      console.log('NFT Address:', nftAddress);
      console.log('Datatoken Address:', datatokenAddress);
    } catch (error) {
      console.error('Error in NFT creation process:', error);
      throw error;
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

console.log('Starting NFT creation process...');
createDataNFT().then(() => {
  console.log('NFT creation process completed.');
  process.exit(0);
}).catch((error) => {
  console.error('NFT creation process failed:', error);
  process.exit(1);
});