// OneInchAdapter.js (final)
const axios = require("axios");
const { ethers } = require("ethers");

const ONEINCH_ROUTER_ADDRESS = "0x1111111254EEB25477B68fb85Ed929f73A960582"; // Polygon v5

async function getOneInchQuote(tokenIn, tokenOut, amount, slippage = 1) {
  try {
    const url = `https://api.1inch.dev/swap/v5.2/137/quote`;
    const headers = {
      Authorization: `Bearer ${process.env.ONEINCH_API_KEY}`,
      accept: "application/json"
    };

    const params = {
      src: tokenIn,
      dst: tokenOut,
      amount: amount.toString(),
      slippage: slippage.toString(),
      includeTokensInfo: false,
      includeGas: true,
      includeProtocols: false
    };

    const res = await axios.get(url, { headers, params });
    return res.data;
  } catch (err) {
    console.warn("[1inch] API quote failed:", err.message);
    return null;
  }
}

async function simulateOneInchSwap(provider, tokenIn, tokenOut, amountIn) {
  try {
    const quote = await getOneInchQuote(tokenIn, tokenOut, amountIn);
    if (!quote || !quote.toTokenAmount) return null;

    return {
      outputAmount: ethers.BigNumber.from(quote.toTokenAmount),
      estimatedGas: quote.estimatedGas,
      router: ONEINCH_ROUTER_ADDRESS
    };
  } catch (e) {
    console.warn("[1inch] Simulation failed:", e.message);
    return null;
  }
}

module.exports = {
  simulateOneInchSwap,
  ONEINCH_ROUTER_ADDRESS
};
