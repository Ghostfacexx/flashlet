// File: flash-arbitrage-bot/utils/multicall.js

const { ethers } = require("ethers");
const multicallAbi = require("./abi/Multicall3.json");

const MULTICALL_ADDRESS = "0xca11bde05977b3631167028862be2a173976ca11"; // Polygon mainnet

async function batchGetAmountsOut({ routerAddress, amountIn, paths, provider }) {
  const routerInterface = new ethers.utils.Interface([
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory)"
  ]);

  const pureProvider = provider.provider ?? provider;
  const multicall = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, pureProvider);

  const calls = paths.map(path => ({
    target: routerAddress,
    callData: routerInterface.encodeFunctionData("getAmountsOut", [amountIn, path])
  }));

  try {
    const results = await multicall.callStatic.tryAggregate(false, calls);
    return results.map(([success, data], i) => {
      if (!success) return null;
      try {
        const decoded = routerInterface.decodeFunctionResult("getAmountsOut", data);
        return { path: paths[i], amounts: decoded[0] };
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    console.warn("batchGetAmountsOut multicall failed:", e.message);
    return [];
  }
}

// ✅ New: Batch getAmountsOut across multiple routers and paths
async function batchGetAmountsAcrossRouters({ routers, amountIn, paths, provider }) {
  const routerInterface = new ethers.utils.Interface([
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory)"
  ]);

  const pureProvider = provider.provider ?? provider;
  const multicall = new ethers.Contract(MULTICALL_ADDRESS, multicallAbi, pureProvider);

  const calls = [];
  for (const router of routers) {
    for (const path of paths) {
      calls.push({
        target: router,
        callData: routerInterface.encodeFunctionData("getAmountsOut", [amountIn, path])
      });
    }
  }

  try {
    const results = await multicall.callStatic.tryAggregate(false, calls);

    let index = 0;
    const output = [];
    for (const router of routers) {
      for (const path of paths) {
        const [success, data] = results[index++];
        if (success) {
          try {
            const decoded = routerInterface.decodeFunctionResult("getAmountsOut", data);
            output.push({ router, path, amounts: decoded[0] });
          } catch {}
        }
      }
    }

    return output;
  } catch (e) {
    console.warn("batchGetAmountsAcrossRouters failed:", e.message);
    return [];
  }
}

module.exports = {
  batchGetAmountsOut,
  batchGetAmountsAcrossRouters // ✅ Export new function
};
