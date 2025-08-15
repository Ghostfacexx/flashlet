const { ethers } = require("ethers");
const { Interface } = require("@ethersproject/abi");
const Multicall3ABI = require("../abi/Multicall3.json");
const { getRouterType, getRouterName } = require("./RouterAdapter");

const multicallAddress = "0xca11bde05977b3631167028862be2a173976ca11";

const UNISWAP_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

async function checkLiquidityMulti({ provider, tokenIn, tokenOut, routers }) {
  console.log(`\n=== ✅ checkLiquidityMulti START ===`);
  console.log(`[INFO] Checking liquidity from ${tokenIn} → ${tokenOut} across ${routers.length} routers`);

  const erc20 = new ethers.Contract(tokenIn, ["function decimals() view returns (uint8)"], provider);
  let decimals = 18;
  try {
    decimals = await erc20.decimals();
  } catch (e) {
    console.warn(`⚠️ Failed to get decimals for ${tokenIn}, using default 18`);
  }

  const amountTest = ethers.utils.parseUnits(decimals <= 6 ? "10" : "0.001", decimals);

  const iface = new Interface([
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
  ]);
  const multicall = new ethers.Contract(multicallAddress, Multicall3ABI, provider);

  const calls = [];

  for (const router of routers) {
    const type = getRouterType(router);
    if (!type || type.toLowerCase() !== "uniswapv2") {
      console.log(`[SKIP] Router ${router} is not uniswapv2 (type=${type})`);
      continue;
    }

    const callData = iface.encodeFunctionData("getAmountsOut", [amountTest, [tokenIn, tokenOut]]);
    calls.push({ target: router, callData });

    console.log(`[CALL] Added call for ${tokenIn} → ${tokenOut} on router ${router}`);
  }

  console.log(`[INFO] Total multicall calls queued: ${calls.length}`);

  try {
    const resultsRaw = await multicall.callStatic.tryAggregate(false, calls);
    const results = [];

    for (let i = 0; i < resultsRaw.length; i++) {
      const [success, returnData] = resultsRaw[i];
      const call = calls[i];
      if (!success || !returnData || returnData.length === 0) {
        console.warn(`[WARN] Failed call on router ${call.target}`);
        continue;
      }

      try {
        const decoded = ethers.utils.defaultAbiCoder.decode(["uint[]"], returnData);
        const outputRaw = decoded[0].at(-1);
        const output = ethers.BigNumber.from(outputRaw);

        console.log(`[RESULT] ${tokenIn} → ${tokenOut} on ${call.target} = ${output.toString()}`);

        if (output.gt(0)) {
          results.push(call.target);
        }
      } catch (err) {
        console.warn(`[DECODE ERROR] Router ${call.target}: ${err.message}`);
      }
    }

    console.log(`=== ✅ checkLiquidityMulti DONE — ${results.length} liquid router(s) ===\n`);
    return results;
  } catch (err) {
    console.error("❌ Multicall liquidity check failed:", err.message);
    return [];
  }
}

async function batchGetAmountsAcrossRouters({ routers, amountIn, paths, provider }) {
  const iface = new Interface(UNISWAP_ROUTER_ABI);
  const multicall = new ethers.Contract(multicallAddress, Multicall3ABI, provider);

  const calls = [];

  for (const router of routers) {
    const type = getRouterType(router);
    if (!type || type.toLowerCase() !== "uniswapv2") continue;

    for (const path of paths) {
      const callData = iface.encodeFunctionData("getAmountsOut", [amountIn, path]);
      calls.push({ target: router, callData });
    }
  }

  try {
    const resultsRaw = await multicall.callStatic.tryAggregate(false, calls);
    const results = [];

    for (let i = 0; i < resultsRaw.length; i++) {
      const [success, returnData] = resultsRaw[i];
      const call = calls[i];
      if (!success || !returnData || returnData.length === 0) continue;

      try {
        const decoded = ethers.utils.defaultAbiCoder.decode(["uint[]"], returnData);
        results.push({
          router: call.target,
          path: call.callData,
          amounts: decoded[0]
        });
      } catch (err) {
        console.warn(`[DEBUG] Failed to decode batch result on ${call.target} (${getRouterName(call.target)}): ${err.message}`);
      }
    }

    return results;
  } catch (err) {
    console.error("❌ Multicall batchGetAmountsAcrossRouters failed:", err.message);
    return [];
  }
}

module.exports = {
  batchGetAmountsAcrossRouters,
  checkLiquidityMulti
};
