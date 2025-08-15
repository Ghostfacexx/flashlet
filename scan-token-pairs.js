require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const { simulateWithFallback } = require("./SmartSimulator");
const contractJson = require("./abi/MultiPairFlashArbitrage.json");

const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  contractJson,
  wallet
);

const routerIn = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";  // QuickSwap
const routerOut = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"; // SushiSwap

const tokens = JSON.parse(fs.readFileSync("./tokens-fallback.json", "utf8"));

let tokenCache = {
  badPairs: new Set()
};

function saveTokenCache() {}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

(async () => {
  for (let i = 0; i < tokens.length; i++) {
    for (let j = 0; j < tokens.length; j++) {
      if (i === j) continue;

      const tokenA = tokens[i];
      const tokenB = tokens[j];

      try {
        const result = await simulateWithFallback({
          tokenA,
          tokenB,
          routerIn,
          routerOut,
          provider,
          contract,
          tokenCache,
          saveTokenCache,
          minNetProfitUSD: 0.01 // Lower to capture more results
        });

        if (result.executed || result.netProfit > 0) {
          log(`💸 Profitable Pair: ${tokenA.symbol} → ${tokenB.symbol} | Net: $${result.netProfit.toFixed(4)} | Tx: ${result.txHash || "simulated"}`);
        }
      } catch (err) {
        log(`⚠️ Error simulating ${tokenA.symbol} → ${tokenB.symbol}: ${err.message || err}`);
      }
    }
  }

  log("✅ Scan complete.");
})();
