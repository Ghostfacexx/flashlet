
const { ethers } = require("ethers");
const axios = require("axios");
const BalancerVaultABI = require("../abi/BalancerVault.json");

const VAULT_ADDRESS = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"; // Balancer Vault on Polygon

async function queryBalancerPoolId(tokenIn, tokenOut) {
  try {
    tokenIn = ethers.utils.getAddress(tokenIn);
    tokenOut = ethers.utils.getAddress(tokenOut);
  } catch (err) {
    console.warn("[Balancer] Invalid token address format.");
    return null;
  }

  console.log("[Balancer] Looking up pool for:");
  console.log(" - Token In :", tokenIn);
  console.log(" - Token Out:", tokenOut);

  const url = "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2-polygon";

  const query = {
    query: `
      {
        pools(where: {
          tokensList_contains: ["${tokenIn}", "${tokenOut}"]
        }, first: 1) {
          id
          tokensList
        }
      }
    `
  };

  try {
    const res = await axios.post(url, query);
    const pool = res.data?.data?.pools?.[0];
    if (!pool) {
      console.warn("[Balancer] No pool found with those tokens.");
      return null;
    }
    console.log("[Balancer] ✅ Found pool ID:", pool.id);
    return pool.id;
  } catch (e) {
    console.warn("[Balancer] Subgraph query failed:", e.message);
    return null;
  }
}

async function simulateBalancerSwap(provider, tokenIn, tokenOut, amountIn) {
  try {
    const vault = new ethers.Contract(VAULT_ADDRESS, BalancerVaultABI, provider);
    const poolId = await queryBalancerPoolId(tokenIn, tokenOut);

    if (!poolId) {
      return null;
    }

    const swapKind = 0; // GIVEN_IN
    const swapSteps = [{
      poolId: poolId,
      assetInIndex: 0,
      assetOutIndex: 1,
      amount: amountIn,
      userData: "0x"
    }];

    const assets = [tokenIn, tokenOut];
    const funds = {
      sender: ethers.constants.AddressZero,
      recipient: ethers.constants.AddressZero,
      fromInternalBalance: false,
      toInternalBalance: false
    };

    const result = await vault.callStatic.queryBatchSwap(swapKind, swapSteps, assets, funds);
    const outputAmount = result[1].mul(-1); // Received tokens are negative in Balancer

    return { outputAmount };
  } catch (e) {
    console.warn("[Balancer] Simulation failed:", e.message);
    return null;
  }
}

module.exports = {
  simulateBalancerSwap
};
