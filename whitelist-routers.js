// whitelist-routers.js
const { ethers } = require("ethers");
require("dotenv").config();

const contractAbi = require("./abi/MultiPairFlashArbitrage.json");
const CONTRACT_ADDRESS = "0x922bDfb69A5b4a5ADF3a9Ae909F2172d1eE080b5"; // Your deployed arbitrage contract

const ROUTERS = [
  "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap
  "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap
  "0x3B2b44Cd7F7C1f34ee1F19d3725f1994efcB72E5"  // PancakeSwap
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, wallet);

  for (const router of ROUTERS) {
    const isAllowed = await contract.allowedRouters(router);
    if (isAllowed) {
      console.log(`✅ Already whitelisted: ${router}`);
      continue;
    }

    try {
      const tx = await contract.addRouter(router);
      console.log(`⏳ Whitelisting: ${router} (tx: ${tx.hash})`);
      await tx.wait();
      console.log(`✅ Router added: ${router}`);
    } catch (err) {
      console.error(`❌ Failed to add router ${router}:`, err.message || err);
    }
  }
}

main().catch(console.error);
