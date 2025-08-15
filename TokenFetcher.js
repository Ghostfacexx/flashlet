// File: flash-arbitrage-bot/utils/tokenfetcher.js

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const IERC20 = require("../abi/IERC20.json");

const FALLBACK_PATH = path.join(__dirname, "..", "tokens-fallback.json");
const CACHE_PATH = path.join(__dirname, "..", "tokens-cache.json");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function isCacheFresh() {
  if (!fs.existsSync(CACHE_PATH)) return false;
  const { mtimeMs } = fs.statSync(CACHE_PATH);
  return Date.now() - mtimeMs < CACHE_TTL_MS;
}

function loadFallbackTokens() {
  try {
    const raw = fs.readFileSync(FALLBACK_PATH, "utf-8");
    const tokens = JSON.parse(raw);
    console.log(`✅ Loaded ${tokens.length} fallback tokens.`);
    return tokens;
  } catch (e) {
    console.error("❌ Failed to load fallback tokens:", e.message);
    return [];
  }
}

async function fetchTopPolygonTokens(limit = 50, provider = null) {
  const fallbackTokens = loadFallbackTokens();

  // Return fallback tokens immediately for fast startup
  console.log(`🚀 Returning fallback tokens immediately to begin simulation.`);
  startCoinGeckoFetch(limit, provider, fallbackTokens); // background update
  return fallbackTokens;
}

async function startCoinGeckoFetch(limit, provider, fallbackTokens) {
  let tokens = [];

  try {
    const { data } = await axios.get("https://api.coingecko.com/api/v3/coins/markets", {
      params: {
        vs_currency: "usd",
        order: "volume_desc",
        per_page: limit,
        page: 1
      }
    });

    for (const coin of data) {
      await delay(1200); // rate limit compliance (1/sec)

      try {
        const detail = await axios.get(`https://api.coingecko.com/api/v3/coins/${coin.id}`);
        const platforms = detail.data.platforms || {};
        const polygonAddress =
          platforms["polygon"] ||
          platforms["polygon-pos"] ||
          platforms["Polygon"] ||
          platforms["Polygon POS"];

        if (!polygonAddress || !ethers.utils.isAddress(polygonAddress)) {
          console.log(`⛔ Skipping ${coin.symbol} — no valid Polygon address`);
          continue;
        }

        let decimals = 18;
        if (provider) {
          try {
            const token = new ethers.Contract(polygonAddress, IERC20, provider);
            decimals = await token.decimals();
          } catch {
            console.warn(`⚠️ Could not fetch decimals for ${coin.symbol}, defaulting to 18`);
          }
        }

        tokens.push({
          symbol: coin.symbol.toUpperCase(),
          address: ethers.utils.getAddress(polygonAddress),
          decimals
        });
      } catch (e) {
        console.warn(`⚠️ Skipped ${coin.id}: ${e.message}`);
      }
    }
  } catch (e) {
    console.warn(`❌ CoinGecko fetch failed: ${e.message}`);
    return;
  }

  // Merge and deduplicate
  const combined = [...tokens, ...fallbackTokens];
  const unique = Array.from(new Map(combined.map(t => [t.address.toLowerCase(), t])).values());

  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(unique, null, 2));
    console.log(`✅ Cache updated: ${unique.length} tokens saved.`);
  } catch (e) {
    console.error("❌ Failed to save token cache:", e.message);
  }
}

module.exports = { fetchTopPolygonTokens };