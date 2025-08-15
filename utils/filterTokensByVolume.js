const axios = require("axios");

const COINGECKO_IDS = {
  "USDC": "usd-coin",
  "USDT": "tether",
  "DAI": "dai",
  "WMATIC": "wmatic",
  "WETH": "weth",
  "WBTC": "wrapped-bitcoin",
  "AAVE": "aave",
  "LINK": "chainlink",
  "UNI": "uniswap",
  "CRV": "curve-dao-token",
  "SUSHI": "sushi",
  "FRAX": "frax",
  "BAL": "balancer",
  "TUSD": "true-usd",
  "MKR": "maker",
  "GRT": "the-graph",
  "SAND": "the-sandbox",
  "MANA": "decentraland",
  "LDO": "lido-dao",
  "SNX": "synthetix-network-token",
  "LUSD": "liquity-usd",
  "AGEUR": "ageur",
  "QI": "qi-dao",
  "SPELL": "spell-token",
  "1INCH": "1inch",
  "RAI": "rai"
};

async function filterByVolume(tokens, minVolumeUSD = 100000) {
  try {
    const ids = tokens
      .map(t => COINGECKO_IDS[t.symbol])
      .filter(Boolean);

    if (ids.length === 0) return tokens;

    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: {
          ids: ids.join(","),
          vs_currencies: "usd",
          include_24hr_vol: true
        }
      }
    );

    return tokens.filter(t => {
      const id = COINGECKO_IDS[t.symbol];
      return data[id]?.usd_24h_vol > minVolumeUSD;
    });
  } catch (err) {
    console.warn("⚠️ CoinGecko volume fetch failed, using full token list");
    return tokens;
  }
}

module.exports = { filterByVolume };
