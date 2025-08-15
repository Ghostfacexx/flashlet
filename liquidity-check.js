// liquidity-check.js
const { ethers } = require("ethers");
require("dotenv").config();

const { batchGetAmountsAcrossRouters } = require("./multicall");
const { getRouterType } = require("./RouterAdapter");

// ---- CONFIG ----
const provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC);

// 🪙 Input token addresses and amount here
const tokenIn = "0xF33005E1b56F289FDf2D4F82566B049f5dA1342E"; // BONK
const tokenOut = "0xe9F84D418b008888A992FF8cc72e8285192dCB6E"; // SPELL
const amountInHuman = "10000"; // 10,000 BONK
const decimals = 18; // BONK decimals

const router = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"; // QuickSwap
// ----------------

const MIDDLE_TOKENS = [
  "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
  "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"  // WMATIC
];

(async () => {
  const tokenA = ethers.utils.getAddress(tokenIn);
  const tokenB = ethers.utils.getAddress(tokenOut);
  const routerAddr = ethers.utils.getAddress(router);

  const routerType = getRouterType(routerAddr);
  if (routerType !== "uniswapv2") {
    console.error("❌ Only UniswapV2 routers are supported for this test.");
    return;
  }

  const amountIn = ethers.utils.parseUnits(amountInHuman, decimals);
  const paths = [[tokenA, tokenB]];

  for (const bridge of MIDDLE_TOKENS) {
    if (bridge !== tokenA && bridge !== tokenB) {
      paths.push([tokenA, bridge, tokenB]);
    }
  }

  console.log(`🔍 Testing ${tokenA} → ${tokenB} via ${routerAddr} with ${amountInHuman} units...`);
  console.log("🔁 Paths:");
  paths.forEach(p => console.log(" ", p.join(" → ")));

  try {
    const results = await batchGetAmountsAcrossRouters({
      routers: [routerAddr],
      amountIn,
      paths,
      provider
    });

    let anySuccess = false;
    results.forEach((res, i) => {
      const out = res.amounts?.at(-1);
      const human = out ? ethers.utils.formatUnits(out, decimals) : "0";
      const label = human === "0.0" || out?.isZero() ? "❌" : "✅";
      if (!out?.isZero()) anySuccess = true;
      console.log(`${label} ${paths[i].join(" → ")} → ${human}`);
    });

    if (!anySuccess) {
      console.log("🚫 No valid swap path found for this token pair on this router.");
    } else {
      console.log("✅ At least one path is liquid.");
    }
  } catch (err) {
    console.error("❌ Error while testing liquidity:", err.message || err);
  }
})();
