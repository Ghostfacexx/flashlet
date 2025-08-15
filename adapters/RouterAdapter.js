// RouterAdapter.js — Full Router Type Detection

// Recognized UniswapV2-based routers
const UNISWAP_V2 = [
  "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff", // QuickSwap
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506", // SushiSwap
  "0x3b2b44cd7f7c1f34ee1f19d3725f1994efcb72e5"  // PancakeSwap
];

// Known router types mapped by lowercase address
const ROUTER_TYPES = {
  "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff": "uniswapv2", // QuickSwap
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": "uniswapv2", // SushiSwap
  "0x3b2b44cd7f7c1f34ee1f19d3725f1994efcb72e5": "uniswapv2", // PancakeSwap
  "0xba12222222228d8ba445958a75a0704d566bf2c8": "balancer",  // Balancer Vault
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch"      // 1inch Aggregator
};

/**
 * Returns the router type string for a given router address.
 * Defaults to 'uniswapv2' if unknown.
 */
function getRouterType(address) {
  if (!address) return "uniswapv2";
  const normalized = address.toLowerCase();
  return ROUTER_TYPES[normalized] || "uniswapv2";
}

module.exports = {
  UNISWAP_V2,
  UNISWAP_V3: [],
  getRouterType
};
