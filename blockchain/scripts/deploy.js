/**
 * Deploy AasaraParametric to a testnet.
 *
 * Usage:
 *   npm run deploy:sepolia      ← Ethereum Sepolia
 *   npm run deploy:amoy         ← Polygon Amoy
 *   npm run deploy:local        ← Local Hardhat node
 *
 * Required env vars (in backend/server/.env):
 *   DEPLOYER_PRIVATE_KEY        — private key of the deploying wallet
 *   SEPOLIA_RPC_URL             — Alchemy / Infura / Ankr RPC URL for Sepolia
 *   POLYGON_AMOY_RPC_URL        — RPC URL for Polygon Amoy
 *   CHAINLINK_SUBSCRIPTION_ID  — Chainlink Functions subscription ID (optional)
 *
 * After deploying, set in backend/server/.env:
 *   AASARA_CONTRACT_ADDRESS=<deployed address>
 *   CONTRACT_NETWORK=sepolia   (or polygonAmoy)
 */

const hre = require('hardhat');
const { ethers } = hre;

// Chainlink Functions router per network
const ROUTERS = {
  sepolia:     '0xb83E47C2bC239B3bf370bc41e1459A34b41238D0',
  polygonAmoy: '0xC22a79eBA640940ABB6dF0f7982cc119578E11De',
  hardhat:     '0x0000000000000000000000000000000000000001', // placeholder for local
};

// Chainlink DON IDs (bytes32)
const DON_IDS = {
  sepolia:     ethers.encodeBytes32String('fun-ethereum-sepolia-1'),
  polygonAmoy: ethers.encodeBytes32String('fun-polygon-amoy-1'),
  hardhat:     ethers.encodeBytes32String('fun-hardhat-local-1'),
};

async function main() {
  const network = hre.network.name;
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  AASARA Parametric — Deploy Script   ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`\n  Network:  ${network}`);

  const [deployer] = await ethers.getSigners();
  const balance     = await ethers.provider.getBalance(deployer.address);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n && network !== 'hardhat') {
    console.error('  ERROR: Deployer wallet has zero balance. Get testnet ETH first.');
    console.error('  Sepolia faucet: https://sepoliafaucet.com');
    console.error('  Amoy faucet:    https://faucet.polygon.technology');
    process.exit(1);
  }

  const router         = ROUTERS[network] || ROUTERS.sepolia;
  const donId          = DON_IDS[network]  || DON_IDS.sepolia;
  const subscriptionId = Number(process.env.CHAINLINK_SUBSCRIPTION_ID || 1);

  console.log(`  Chainlink Router: ${router}`);
  console.log(`  DON ID:           ${donId}`);
  console.log(`  Subscription ID:  ${subscriptionId}`);
  console.log(`\n  Deploying AasaraParametric...`);

  const Factory = await ethers.getContractFactory('AasaraParametric');
  const contract = await Factory.deploy(router, donId, subscriptionId);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const receipt  = await ethers.provider.getTransactionReceipt(
    contract.deploymentTransaction().hash
  );

  console.log(`\n  ✅ AasaraParametric deployed!`);
  console.log(`     Address:   ${address}`);
  console.log(`     Tx hash:   ${contract.deploymentTransaction().hash}`);
  console.log(`     Gas used:  ${receipt?.gasUsed?.toString() ?? 'n/a'}`);

  if (network === 'sepolia') {
    console.log(`     Explorer:  https://sepolia.etherscan.io/address/${address}`);
  } else if (network === 'polygonAmoy') {
    console.log(`     Explorer:  https://amoy.polygonscan.com/address/${address}`);
  }

  console.log(`\n  Add these to backend/server/.env:`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  AASARA_CONTRACT_ADDRESS=${address}`);
  console.log(`  CONTRACT_NETWORK=${network}`);
  console.log(`  ────────────────────────────────────\n`);

  // Persist deployment info
  const fs = require('fs');
  const info = {
    network,
    address,
    txHash: contract.deploymentTransaction().hash,
    router,
    donId: donId.toString(),
    subscriptionId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync('./deployments.json', JSON.stringify(info, null, 2));
  console.log(`  Deployment info saved → blockchain/deployments.json\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
