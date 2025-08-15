const { ethers } = require("ethers");

const IUniswapV2Router = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory)"
];

async function simulateArbitrage({
  tokenA,
  tokenB,
  routerIn,
  routerOut,
  provider,
  wallet,
  contract,
}) {
  const decimals = tokenA.decimals || 18;
  const amountIn = ethers.utils.parseUnits("100", decimals);

  const routerA = new ethers.Contract(routerIn, IUniswapV2Router, provider);
  const routerB = new ethers.Contract(routerOut, IUniswapV2Router, provider);

  const path1 = [tokenA.address, tokenB.address];
  const path2 = [tokenB.address, tokenA.address];

  try {
    const out1 = await routerA.getAmountsOut(amountIn, path1);
    const out2 = await routerB.getAmountsOut(out1[1], path2);

    const profit = out2[1].sub(amountIn);

    if (profit.gt(0)) {
      const profitFormatted = ethers.utils.formatUnits(profit, decimals);
      console.log(`💸 PROFITABLE: ${tokenA.symbol} → ${tokenB.symbol} → ${tokenA.symbol}`);
      console.log(`Routers: ${short(routerIn)} → ${short(routerOut)}, Profit: ${profitFormatted} ${tokenA.symbol}`);

      const tx = await contract.flashArbitrage(path1, path2, amountIn, {
        gasLimit: 600000,
      });

      console.log(`🚀 TX Submitted: ${tx.hash}`);
      await tx.wait();
    } else {
      console.log(`🧾 No profit (${tokenA.symbol} → ${tokenB.symbol} → ${tokenA.symbol})`);
    }
  } catch (e) {
    console.warn(`⛔ Reverted: ${tokenA.symbol} → ${tokenB.symbol} on router ${short(routerIn)} | amountIn: ${amountIn.toString()}`);
  }
}

function short(addr) {
  return addr.slice(0, 8);
}

module.exports = { simulateArbitrage };
