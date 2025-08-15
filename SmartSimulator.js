// SmartSimulator.js — updated to skip checkLiquidityMulti for better path handling
const { ethers } = require("ethers");
const { batchGetAmountsAcrossRouters } = require("./multicall");
const { getRouterType, getRouterName } = require("./RouterAdapter");

const MIDDLE_TOKENS = [
  "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
  "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
  "0xc2132D05D31c914a87c6611c10748Aacba4F855a", // USDT
  "0xD606199557c8Ab6F4Cc70bD03FaCc96ca576f142", // AAVE
  "0xa3Fa99A148fA48D14Ed51d610c367C61876997F1", // MAI
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6"  // WBTC
];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function simulateSwap(tokenIn, tokenOut, amountIn, router, provider) {
  const routerType = getRouterType(router);
  const routerName = getRouterName(router);
  if (routerType !== "uniswapv2") {
    log(`❌ Router ${routerName} (${router}) is not supported (type: ${routerType})`);
    return null;
  }

  const paths = [[tokenIn, tokenOut]];
  for (const bridge of MIDDLE_TOKENS) {
    if (bridge !== tokenIn && bridge !== tokenOut) {
      paths.push([tokenIn, bridge, tokenOut]);
    }
  }

  try {
    const results = await batchGetAmountsAcrossRouters({ routers: [router], amountIn, paths, provider });

    for (const result of results) {
      if (result.amounts && result.amounts.length > 1) {
        const output = result.amounts.at(-1);

        if (!output || output.isZero()) {
          log(`❌ simulateSwap got zero output for ${tokenIn} → ${tokenOut} via ${routerName}`);
          continue;
        }

        if (output.lt(0)) {
          log(`❌ simulateSwap got negative output (bug) for ${tokenIn} → ${tokenOut} via ${routerName}`);
          continue;
        }

        return { outputAmount: output };
      }
    }

    log(`❌ No valid swap result found for ${tokenIn} → ${tokenOut} on ${routerName} (${router})`);
  } catch (err) {
    log(`❌ simulateSwap error on ${routerName} (${router}): ${err?.reason || err?.message || err}`);
  }

  return null;
}

async function simulateWithFallback({
  tokenA, tokenB, routerIn, routerOut,
  provider, contract, tokenCache, saveTokenCache,
  minNetProfitUSD = parseFloat(process.env.MIN_PROFIT_USD || "1")
}) {
  if (!tokenA?.decimals || !tokenB?.decimals) {
    log(`❌ Missing decimals for token ${tokenA?.symbol} or ${tokenB?.symbol}`);
    return { executed: false };
  }

  const flashAmounts = ["100", "250", "500", "1000", "2000"];

  for (const amount of flashAmounts) {
    const flashAmount = ethers.utils.parseUnits(amount, tokenA.decimals);
    const routerInName = getRouterName(routerIn);
    const routerOutName = getRouterName(routerOut);
    const flashFloat = parseFloat(ethers.utils.formatUnits(flashAmount, tokenA.decimals));
    log(`🧪 Trying flashAmount: ${flashFloat} ${tokenA.symbol} via ${routerInName} → ${routerOutName}`);

    try {
      const out1 = await simulateSwap(tokenA.address, tokenB.address, flashAmount, routerIn, provider);
      const out1Val = out1?.outputAmount;
      log(`➡ Swap1 (${tokenA.symbol}→${tokenB.symbol}) output: ${out1Val ? ethers.utils.formatUnits(out1Val, tokenB.decimals) : "undefined"}`);
      log(`🧾 Raw out1 = ${out1Val?.toString() || "undefined"}`);

      if (!out1Val || out1Val.isZero()) {
        log(`❌ Swap1 output invalid — skipping`);
        continue;
      }

      const out1Float = parseFloat(ethers.utils.formatUnits(out1Val, tokenB.decimals));
      if (out1Float / flashFloat > 5) {
        log(`⚠️ Unrealistic swap ratio: got ${out1Float} ${tokenB.symbol} from ${flashFloat} ${tokenA.symbol}`);
        continue;
      }

      const out2 = await simulateSwap(tokenB.address, tokenA.address, out1Val, routerOut, provider);
      const out2Val = out2?.outputAmount;
      log(`⬅ Swap2 (${tokenB.symbol}→${tokenA.symbol}) output: ${out2Val ? ethers.utils.formatUnits(out2Val, tokenA.decimals) : "undefined"}`);
      log(`🧾 Raw out2 = ${out2Val?.toString() || "undefined"}`);

      if (!out2Val || out2Val.isZero()) {
        log(`❌ Swap2 output invalid — skipping`);
        continue;
      }

      if (out2Val.lte(flashAmount)) {
        log(`⚠️ Final amount ≤ flashAmount — not profitable`);
        continue;
      }

      const profit = out2Val.sub(flashAmount);
      const profitUSD = parseFloat(ethers.utils.formatUnits(profit, tokenA.decimals));

      const swap = {
        token: ethers.utils.getAddress(tokenA.address),
        amount: flashAmount,
        routerIn: ethers.utils.getAddress(routerIn),
        routerOut: ethers.utils.getAddress(routerOut)
      };

      try {
        await contract.callStatic.requestFlashLoan(swap);
      } catch (staticErr) {
        log(`❌ callStatic failed: ${staticErr.reason || staticErr.message}`);
        continue;
      }

      let gasEstimate;
      try {
        gasEstimate = await contract.estimateGas.requestFlashLoan(swap);
      } catch (err) {
        log(`⚠️ Gas estimate failed: ${err.message}`);
        continue;
      }

      const gasPrice = await provider.getGasPrice();
      const gasCostUSD = parseFloat(ethers.utils.formatEther(gasEstimate.mul(gasPrice)));
      const netProfit = profitUSD - gasCostUSD;

      log(`💸 Profit: ${profitUSD.toFixed(4)} | Gas: ${gasCostUSD.toFixed(4)} | Net: ${netProfit.toFixed(4)}`);

      if (netProfit < minNetProfitUSD) {
        log(`❌ Not profitable enough (Net ${netProfit.toFixed(4)} < ${minNetProfitUSD})`);
        continue;
      }

      const tx = await contract.requestFlashLoan(swap);
      await tx.wait();

      return {
        executed: true,
        profitUSD,
        gasUSD: gasCostUSD,
        netProfit,
        txHash: tx.hash
      };
    } catch (err) {
      log(`⚠️ Simulation error: ${err.message}`);
    }
  }

  tokenCache.badPairs.add(`${tokenA.address}_${tokenB.address}`);
  saveTokenCache();
  log(`🚫 Blacklisted dead pair: ${tokenA.symbol} → ${tokenB.symbol}`);
  return { executed: false };
}

async function tryTriangle({
  tokenA, tokenB, stable, routers,
  provider, contract, flashAmount,
  minNetProfitUSD,
  triangleCache, saveTriangleCache
}) {
  if (!tokenA?.decimals || !tokenB?.decimals || !stable?.decimals) {
    log(`❌ Missing decimals in triangle: ${tokenA.symbol}, ${tokenB.symbol}, or ${stable.symbol}`);
    return { executed: false };
  }

  const directions = [
    [tokenA, tokenB, stable],
    [tokenA, stable, tokenB]
  ];

  for (const [a, b, c] of directions) {
    log(`🔺 Trying triangle flashAmount: ${ethers.utils.formatUnits(flashAmount, a.decimals)} ${a.symbol} via [${routers.map(getRouterName).join("→")}]`);
    log(`➡ Step 1: ${a.symbol} → ${b.symbol} via ${getRouterName(routers[0])}`);

    try {
      const out1 = await simulateSwap(a.address, b.address, flashAmount, routers[0], provider);
      const val1 = out1?.outputAmount;
      if (!val1 || val1.isZero()) {
        log(`❌ Step 1 failed or zero`);
        continue;
      }

      log(`➡ Step 2: ${b.symbol} → ${c.symbol} via ${getRouterName(routers[1])}`);
      const out2 = await simulateSwap(b.address, c.address, val1, routers[1], provider);
      const val2 = out2?.outputAmount;
      if (!val2 || val2.isZero()) {
        log(`❌ Step 2 failed or zero`);
        continue;
      }

      log(`➡ Step 3: ${c.symbol} → ${a.symbol} via ${getRouterName(routers[2])}`);
      const out3 = await simulateSwap(c.address, a.address, val2, routers[2], provider);
      const val3 = out3?.outputAmount;
      if (!val3 || val3.isZero()) {
        log(`❌ Step 3 failed or zero`);
        continue;
      }

      log(`🔁 Roundtrip result: ${ethers.utils.formatUnits(val3, a.decimals)} ${a.symbol}`);
      log(`🧾 Raw return = ${val3.toString()} vs input = ${flashAmount.toString()}`);

      if (val3.lte(flashAmount)) {
        log(`⚠️ No profit (got back less or equal to input)`);
        continue;
      }

      if (val3.gt(flashAmount.mul(10))) {
        log(`⚠️ Unrealistic triangle result — output >10× input`);
        break;
      }

      const profit = val3.sub(flashAmount);
      const profitUSD = parseFloat(ethers.utils.formatUnits(profit, a.decimals));

      try {
        await contract.callStatic.executeTriangleArbitrage(a.address, b.address, c.address, flashAmount);
      } catch (staticErr) {
        log(`❌ callStatic failed: ${staticErr.reason || staticErr.message}`);
        break;
      }

      let gasEstimate;
      try {
        gasEstimate = await contract.estimateGas.executeTriangleArbitrage(a.address, b.address, c.address, flashAmount);
      } catch (err) {
        log(`⚠️ Gas estimate failed: ${err.message}`);
        continue;
      }

      const gasPrice = await provider.getGasPrice();
      const gasCostUSD = parseFloat(ethers.utils.formatEther(gasEstimate.mul(gasPrice)));
      const netProfit = profitUSD - gasCostUSD;

      log(`💸 Triangle Profit: ${profitUSD.toFixed(4)} | Gas: ${gasCostUSD.toFixed(4)} | Net: ${netProfit.toFixed(4)}`);

      if (netProfit < minNetProfitUSD) {
        log(`❌ Not profitable enough (Net ${netProfit.toFixed(4)} < ${minNetProfitUSD})`);
        continue;
      }

      const tx = await contract.executeTriangleArbitrage(a.address, b.address, c.address, flashAmount);
      await tx.wait();

      return {
        executed: true,
        profitUSD,
        gasUSD: gasCostUSD,
        netProfit,
        txHash: tx.hash
      };
    } catch (err) {
      log(`⚠️ Triangle simulation error: ${err.message}`);
    }
  }

  return { executed: false };
}

async function simulateTriangle({
  tokenA, tokenB, stable,
  routers, provider, contract,
  triangleCache, saveTriangleCache,
  minNetProfitUSD = parseFloat(process.env.MIN_PROFIT_USD || "1")
}) {
  const flashAmounts = ["100", "250", "500", "1000", "2000"];

  for (const amount of flashAmounts) {
    const flashAmount = ethers.utils.parseUnits(amount, tokenA.decimals);
    const result = await tryTriangle({
      tokenA, tokenB, stable,
      routers, provider, contract,
      flashAmount, minNetProfitUSD,
      triangleCache, saveTriangleCache
    });
    if (result.executed) return result;
  }

  const key = [tokenA.address, tokenB.address, stable.address].sort().join("_");
  if (!triangleCache.badTrianglePairs) triangleCache.badTrianglePairs = new Set();
  triangleCache.badTrianglePairs.add(key);
  saveTriangleCache();

  log(`🚫 Blacklisted triangle: ${tokenA.symbol} ↔ ${tokenB.symbol} ↔ ${stable.symbol}`);
  return { executed: false };
}

module.exports = {
  simulateSwap,
  simulateWithFallback,
  simulateTriangle
};
