// RouterAdapter.js — enhanced with router name mapping for logging

const ROUTER_TYPES = {
  quickswap: "uniswapv2",
  sushiswap: "uniswapv2",
  jetswap: "uniswapv2",
  apeswap: "uniswapv2",
  dfyn: "uniswapv2",
  cometh: "uniswapv2"
};

const ROUTER_NAMES = {
  "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff": "quickswap",
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": "sushiswap",
  //"0x1e6a2bc76dbb5aa8ed1a79d59d5f9a69f1e2a580": "jetswap",
  "0xc0788a3ad43d79aa53b09c2eacc313a787d1d607": "apeswap",
  "0xa102072a4c07f06ec3b4900fdc4c7b80b6c57429": "dfyn",
  "0x93bfb1faffd3d82c92ce1bc2a3d56cf86e300f24": "cometh"
};



function getRouterName(address) {
  if (!address) return "unknown";
  const key = address.toLowerCase();
  return ROUTER_NAMES[key] || "unknown";
}

function getRouterType(addressOrName) {
  if (!addressOrName) return "unknown";
  const name = typeof addressOrName === "string" && addressOrName.startsWith("0x")
    ? getRouterName(addressOrName)
    : addressOrName.toLowerCase();
  return ROUTER_TYPES[name] || "unknown";
}

module.exports = {
  getRouterType,
  getRouterName
};
