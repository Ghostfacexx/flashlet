const { ethers } = require("ethers");

// Replace with your Polygon RPC URL
const RPC_URL = "https://polygon-rpc.com"; // or Alchemy/Infura URL if you use one
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Replace with your wallet address
const WALLET_ADDRESS = "0xcf3d0e86aE64b80fa80491651CD5caC7CAD3B67b";

(async () => {
  try {
    const balance = await provider.getBalance(WALLET_ADDRESS);
    const matic = ethers.utils.formatEther(balance);
    console.log(`💰 MATIC Balance for ${WALLET_ADDRESS}: ${matic}`);
  } catch (err) {
    console.error("❌ Error fetching balance:", err.message);
  }
})();
