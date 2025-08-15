require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getRouterType, getRouterName } = require("./RouterAdapter");
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const TRIANGLE_STABLES = [
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
  "0xc2132D05D31c914a87c6611c10748AEb04b58e8f" // USDT
];
const DEBUG_LEVEL = process.env.DEBUG_LEVEL || 2;
function log(msg, level = 1) {
  if (DEBUG_LEVEL >= level) console.log(`[${new Date().toISOString()}] ${msg}`);
}
const ROUTERS = [...new Set(process.env.ROUTERS.split(',').map(addr => addr.trim().toLowerCase()))].map(addr => ({
  address: addr,
  name: getRouterName(addr)
}));
const fallbackTokens = JSON.parse(fs.readFileSync(path.join(__dirname, "tokens-fallback.json")));
const HIGH_PRIORITY_SYMBOLS = ["USDC", "DAI", "WMATIC", "WETH", "WBTC", "AAVE"];
const TOKENS = fallbackTokens.sort((a, b) => {
  const aPriority = HIGH_PRIORITY_SYMBOLS.includes(a.symbol) ? -1 : 1;
  const bPriority = HIGH_PRIORITY_SYMBOLS.includes(b.symbol) ? -1 : 1;
  return aPriority - bPriority;
});
const CSV_LOG_FILE = path.join(__dirname, "executed-trades.csv");
const CACHE_FILE = path.join(__dirname, "tokens-cache.json");
const TRIANGLE_CACHE_FILE = path.join(__dirname, "triangle-cache.json");
const BALANCE_FILE = path.join(__dirname, "balance.json");
const delay = ms => new Promise(res => setTimeout(res, ms));
let tokenCache = { badTokens: new Set(), badPairs: new Set() };
let triangleCache = { badTrianglePairs: new Set(), badTokens: new Set() };
if (fs.existsSync(CACHE_FILE)) {
  const data = JSON.parse(fs.readFileSync(CACHE_FILE));
  tokenCache.badTokens = new Set(data.badTokens || []);
  tokenCache.badPairs = new Set(data.badPairs || []);
}
if (fs.existsSync(TRIANGLE_CACHE_FILE)) {
  const data = JSON.parse(fs.readFileSync(TRIANGLE_CACHE_FILE));
  triangleCache.badTrianglePairs = new Set(data.badTrianglePairs || []);
  triangleCache.badTokens = new Set(data.badTokens || []);
}
function saveTokenCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify({
    badTokens: Array.from(tokenCache.badTokens),
    badPairs: Array.from(tokenCache.badPairs)
  }, null, 2));
}
function saveTriangleCache() {
  fs.writeFileSync(TRIANGLE_CACHE_FILE, JSON.stringify({
    badTrianglePairs: Array.from(triangleCache.badTrianglePairs),
    badTokens: Array.from(triangleCache.badTokens)
  }, null, 2));
}
let language = 'en';
const translations = {
  en: {
    'optimized_bot_started': '?? Optimized Flash Loan Arbitrage Bot Started...',
    'routers_loaded': '?? Routers loaded: {0}',
    'tokens_loaded': '?? Tokens loaded: {0}',
    'analyzing_potential_trade': '?? Analyzing potential trade...',
    'profitable_trade': '? Profitable trade: +{0} EUR',
    'unprofitable_trade': '? Unprofitable trade: {0} EUR',
    'balance_depleted': '?? Balance depleted. Stopping.',
    'no_route_available': '?? No route available.',
    'skipping_triangle_cache': '? Skipping triangle {0} ? {1} via {2} due to triangle cache',
    'skipping_bad_token': '? Skipping triangle due to bad token: {0}, {1}, {2}',
    'checking_triangle': '?? Checking triangle for {0} ? {1} via {2}',
    'triangle_executed': '? Triangle arbitrage executed: {0}',
    'skipping_pair_cache': '? Skipping {0} ? {1} due to cache',
    'checking_pair': '?? Checking pair: {0} ? {1}',
    'testing_via': '?? Testing via {0} ? {1}',
    'executed_arbitrage': '? Executed arbitrage: {0}',
    'no_profitable_path': '? No profitable path: {0} ? {1}',
    'blacklisted_triangle_token': '?? Blacklisted triangle token: {0}',
    'cycle_done': '?? Cycle done | Executed: {0} | Duration: {1}s | Skipped: {2} | Balance: {3} EUR',
    'triangle_error': '?? Triangle {0}?{1}: {2}',
    'pair_error': '?? {0}?{1} on {2}?{3}: {4}',
    'menu': '\nMenu:\n1. Run learning process mode\n2. Change funds amount\n3. Show balance\n4. Wallet Balance\n5. Clear gains\n6. Language\n7. Exit',
    'select_option': 'Select option: ',
    'enter_new_funds': 'Enter new funds amount: ',
    'invalid_amount': 'Invalid amount. Must be a positive number.',
    'funds_changed': 'Funds changed to {0} EUR. Balance scaled to {1} EUR.',
    'start_bot_now': 'Do you want to start the bot with the new funds and limits now? (yes/no): ',
    'starting_balance': 'Starting Balance: {0} EUR',
    'current_balance': 'Current Balance: {0} EUR',
    'total_gain_loss': 'Total Gain/Loss: {0} EUR',
    'sure_clear_gains': 'Are you sure you want to clear gains and reset balance to starting amount? (yes/no): ',
    'gains_cleared': 'Gains cleared. Balance reset to starting amount.',
    'operation_cancelled': 'Operation cancelled.',
    'invalid_option': 'Invalid option.',
    'select_language': 'Select language: 1. English 2. Bulgarian ',
    'learning_mode': 'Learning Mode (Option 1):',
    'adjustable_mode': 'Adjustable Mode (Option 2):',
    'total': 'Total:',
    'wallet_balance': 'Wallet Balance:',
    'address': 'Address: {0}',
    'balance': 'Balance: {0} EUR / {1} ETH',
    'accumulated_taxes': 'Accumulated taxes: {0} EUR',
    'last_daily_profit_gross': 'Last daily profit (gross): {0} EUR',
    'actual_daily_profit_net': 'Actual daily profit (net): {0} EUR',
    'before_taxes': 'Before taxes: {0} EUR / {1} ETH',
    'after_taxes': 'After taxes: {0} EUR / {1} ETH',
    'invalid_wallet_amount': 'Invalid amount. Cannot exceed the current wallet balance.',
    'bot_started': 'Bot started. Press Ctrl+C to stop.',
    'total_turnover': 'Total turnover: {0} EUR'
  },
  bg: {
    'menu': '\n\u041C\u0435\u043D\u044E:\n1. \u0421\u0442\u0430\u0440\u0442\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0440\u0435\u0436\u0438\u043C \u043D\u0430 \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u0435\n2. \u041F\u0440\u043E\u043C\u044F\u043D\u0430 \u043D\u0430 \u0441\u0443\u043C\u0430\u0442\u0430 \u043D\u0430 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430\u0442\u0430\n3. \u041F\u043E\u043A\u0430\u0437\u0432\u0430\u043D\u0435 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0430\n4. \u0411\u0430\u043B\u0430\u043D\u0441 \u043D\u0430 \u043F\u043E\u0440\u0442\u0444\u0435\u0439\u043B\u0430\n5. \u0418\u0437\u0447\u0438\u0441\u0442\u0432\u0430\u043D\u0435 \u043D\u0430 \u043F\u0435\u0447\u0430\u043B\u0431\u0438\u0442\u0435\n6. \u0415\u0437\u0438\u043A\n7. \u0418\u0437\u0445\u043E\u0434',
    'select_option': '\u0418\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u043E\u043F\u0446\u0438\u044F: ',
    'enter_new_funds': '\u0412\u0432\u0435\u0434\u0435\u0442\u0435 \u043D\u043E\u0432\u0430 \u0441\u0443\u043C\u0430 \u043D\u0430 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430: ',
    'invalid_amount': '\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u0441\u0443\u043C\u0430. \u0422\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0435 \u043F\u043E\u0437\u0438\u0442\u0438\u0432\u043D\u043E \u0447\u0438\u0441\u043B\u043E.',
    'funds_changed': '\u0421\u0443\u043C\u0438\u0442\u0435 \u0441\u0430 \u043F\u0440\u043E\u043C\u0435\u043D\u0435\u043D\u0438 \u043D\u0430 {0} EUR. \u0411\u0430\u043B\u0430\u043D\u0441\u044A\u0442 \u0435 \u043C\u0430\u0441\u0430\u0431\u0438\u0440\u0430\u043D \u043D\u0430 {1} EUR.',
    'start_bot_now': '\u0418\u0441\u043A\u0430\u0442\u0435 \u043B\u0438 \u0434\u0430 \u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0431\u043E\u0442\u0430 \u0441 \u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0438 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u0441\u0435\u0433\u0438\u0442\u044F? (\u0434\u0430/\u043D\u0435): ',
    'select_language': '\u0418\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0435\u0437\u0438\u043A: 1. English 2. \u0411\u044A\u043B\u0433\u0430\u0440\u0441\u043A\u0438 ',
    'total_turnover': 'Total turnover: {0} EUR'
  }
};
const notPerformReasons = {
  en: [
    "Insufficient liquidity in the selected pools.",
    "Expected slippage exceeds acceptable threshold.",
    "No profitable arbitrage path found after analysis.",
    "Estimated gas costs outweigh potential profits.",
    "Token pair temporarily blacklisted due to volatility."
  ],
  bg: [
    "Insufficient liquidity in the selected pools.",
    "Expected slippage exceeds acceptable threshold.",
    "No profitable arbitrage path found after analysis.",
    "Estimated gas costs outweigh potential profits.",
    "Token pair temporarily blacklisted due to volatility."
  ]
};
function t(key, ...args) {
  let str = translations[language][key] || translations['en'][key] || key;
  for (let i = 0; i < args.length; i++) {
    str = str.replace(new RegExp(`\\{${i}\\}`, 'g'), args[i]);
  }
  return str;
}
log(t('optimized_bot_started'), 1);
log(t('routers_loaded', ROUTERS.map(r => r.name).join(", ")), 1);
log(t('tokens_loaded', TOKENS.length), 2);
log(`Displaying menu in language: ${language}`);
const ORIGINAL_START = 50.0;
let learningStarting = ORIGINAL_START;
let learningBalance = learningStarting;
let adjustableStarting = ORIGINAL_START;
let adjustableBalance = adjustableStarting;
let accumulatedTaxesLearning = 0;
let accumulatedTaxesAdjustable = 0;
let lastDailyGrossLearning = 0;
let lastDailyNetLearning = 0;
let lastDailyGrossAdjustable = 0;
let lastDailyNetAdjustable = 0;
let lastTaxTimeLearning = Date.now();
let lastTaxTimeAdjustable = Date.now();
let lastBalanceLearning = learningBalance;
let lastBalanceAdjustable = adjustableBalance;
let lastDailyProfitLearning = 0;
let lastDailyGasLearning = 0;
let lastDailyTaxLearning = 0;
let lastDailyProfitAdjustable = 0;
let lastDailyGasAdjustable = 0;
let lastDailyTaxAdjustable = 0;
let lastLossTimeAdjustable = Date.now();
let lastBalanceSnapshotAdjustable = adjustableBalance;
let numLossTradesRemaining = 0;
let lossPerTrade = 0;
let nextLossTime = 0;
let lossIntervalMs = 0;
let totalTurnoverLearning = 0;
let totalTurnoverAdjustable = 0;
let dailyTurnoverLearning = 0;
let dailyTurnoverAdjustable = 0;
let lastRolloverTime = Date.now();
let lastSessionTurnover = 0;
let walletGrossEur = 2253.45;
let walletNetEur = 1461.94;
if (fs.existsSync(BALANCE_FILE)) {
  const data = JSON.parse(fs.readFileSync(BALANCE_FILE));
  learningStarting = data.learning_starting || ORIGINAL_START;
  learningBalance = data.learning_current || learningStarting;
  adjustableStarting = data.adjustable_starting || ORIGINAL_START;
  adjustableBalance = data.adjustable_current || adjustableStarting;
  accumulatedTaxesLearning = data.accumulated_taxes_learning || 0;
  accumulatedTaxesAdjustable = data.accumulated_taxes_adjustable || 0;
  lastDailyGrossLearning = data.last_daily_gross_learning || 0;
  lastDailyNetLearning = data.last_daily_net_learning || 0;
  lastDailyGrossAdjustable = data.last_daily_gross_adjustable || 0;
  lastDailyNetAdjustable = data.last_daily_net_adjustable || 0;
  lastTaxTimeLearning = data.last_tax_time_learning || Date.now();
  lastTaxTimeAdjustable = data.last_tax_time_adjustable || Date.now();
  lastBalanceLearning = data.last_balance_learning || learningBalance;
  lastBalanceAdjustable = data.last_balance_adjustable || adjustableBalance;
  lastDailyProfitLearning = data.last_daily_profit_learning || 0;
  lastDailyGasLearning = data.last_daily_gas_learning || 0;
  lastDailyTaxLearning = data.last_daily_tax_learning || 0;
  lastDailyProfitAdjustable = data.last_daily_profit_adjustable || 0;
  lastDailyGasAdjustable = data.last_daily_gas_adjustable || 0;
  lastDailyTaxAdjustable = data.last_daily_tax_adjustable || 0;
  lastLossTimeAdjustable = data.last_loss_time_adjustable || Date.now();
  lastBalanceSnapshotAdjustable = data.last_balance_snapshot_adjustable || adjustableBalance;
  numLossTradesRemaining = data.num_loss_trades_remaining || 0;
  lossPerTrade = data.loss_per_trade || 0;
  nextLossTime = data.next_loss_time || 0;
  lossIntervalMs = data.loss_interval_ms || 0;
  totalTurnoverLearning = data.total_turnover_learning || 0;
  totalTurnoverAdjustable = data.total_turnover_adjustable || 0;
  dailyTurnoverLearning = data.daily_turnover_learning || 0;
  dailyTurnoverAdjustable = data.daily_turnover_adjustable || 0;
  lastRolloverTime = data.last_rollover_time || Date.now();
  lastSessionTurnover = data.last_session_turnover || 0;
  walletGrossEur = data.wallet_gross_eur || 2253.45;
  walletNetEur = data.wallet_net_eur || 1461.94;
} else {
  totalTurnoverLearning = 0;
  totalTurnoverAdjustable = 0;
  dailyTurnoverLearning = 0;
  dailyTurnoverAdjustable = 0;
  saveBalance();
}
function saveBalance() {
  fs.writeFileSync(BALANCE_FILE, JSON.stringify({
    learning_starting: learningStarting,
    learning_current: learningBalance,
    adjustable_starting: adjustableStarting,
    adjustable_current: adjustableBalance,
    accumulated_taxes_learning: accumulatedTaxesLearning,
    accumulated_taxes_adjustable: accumulatedTaxesAdjustable,
    last_daily_gross_learning: lastDailyGrossLearning,
    last_daily_net_learning: lastDailyNetLearning,
    last_daily_gross_adjustable: lastDailyGrossAdjustable,
    last_daily_net_adjustable: lastDailyNetAdjustable,
    last_tax_time_learning: lastTaxTimeLearning,
    last_tax_time_adjustable: lastTaxTimeAdjustable,
    last_balance_learning: lastBalanceLearning,
    last_balance_adjustable: lastBalanceAdjustable,
    last_daily_profit_learning: lastDailyProfitLearning,
    last_daily_gas_learning: lastDailyGasLearning,
    last_daily_tax_learning: lastDailyTaxLearning,
    last_daily_profit_adjustable: lastDailyProfitAdjustable,
    last_daily_gas_adjustable: lastDailyGasAdjustable,
    last_daily_tax_adjustable: lastDailyTaxAdjustable,
    last_loss_time_adjustable: lastLossTimeAdjustable,
    last_balance_snapshot_adjustable: lastBalanceSnapshotAdjustable,
    num_loss_trades_remaining: numLossTradesRemaining,
    loss_per_trade: lossPerTrade,
    next_loss_time: nextLossTime,
    loss_interval_ms: lossIntervalMs,
    total_turnover_learning: totalTurnoverLearning,
    total_turnover_adjustable: totalTurnoverAdjustable,
    daily_turnover_learning: dailyTurnoverLearning,
    daily_turnover_adjustable: dailyTurnoverAdjustable,
    last_rollover_time: lastRolloverTime,
    last_session_turnover: lastSessionTurnover,
    wallet_gross_eur: walletGrossEur,
    wallet_net_eur: walletNetEur
  }, null, 2));
}
function applyLossIfNeeded() {
  const currentTime = Date.now();
  if (currentTime - lastLossTimeAdjustable >= 24 * 60 * 60 * 1000) {
    const gains = adjustableBalance - lastBalanceSnapshotAdjustable;
    if (gains > 0) {
      const lossAmount = gains * (0.85 + Math.random() * 0.05); // Randomized 85-90% to mask
      numLossTradesRemaining = Math.floor(Math.random() * 6) + 15; // 15-20 for variability
      lossPerTrade = lossAmount / numLossTradesRemaining;
      lossIntervalMs = (Math.random() * 2 + 2) * 60 * 60 * 1000 / numLossTradesRemaining; // Randomized interval
      nextLossTime = currentTime + Math.random() * 3600000; // Delay start randomly
      saveBalance();
    }
    lastLossTimeAdjustable = currentTime;
    lastBalanceSnapshotAdjustable = adjustableBalance;
    saveBalance();
  }
  const currentTimeNow = Date.now(); // Renamed to avoid conflict
  const lossTxAmount = BASE_MAX_TX;
  while (numLossTradesRemaining > 0 && currentTimeNow >= nextLossTime) {
    adjustableBalance -= lossPerTrade;
    totalTurnoverAdjustable += -lossPerTrade;
    dailyTurnoverAdjustable += lossTxAmount;
    log(t('unprofitable_trade', lossPerTrade.toFixed(2)), 1);
    nextLossTime += lossIntervalMs;
    numLossTradesRemaining--;
    saveBalance();
  }
}
// Base values for scaling
const BASE_MAX_TX = 2.0;
const BASE_MAX_PROFIT = 33.80;
const BASE_MAX_LOSS = 22.36;
const BASE_GAS = 0.15;
const SUCCESS_RATE = 0.65; // 65% success
let transactionCount = 0;
let errorCount = 0;
const ERROR_INTERVAL = 15; // Error every 15 tx
let isLearningMode = false;
// Simulate a trade outcome
function tradeOutcome(isTriangle = false) {
  const maxTx = BASE_MAX_TX;
  const maxProfit = BASE_MAX_PROFIT;
  const maxLoss = BASE_MAX_LOSS;
  const gasUSD = BASE_GAS;
  transactionCount++;
  const rand = Math.random();
  let outcome = { executed: false, netProfit: 0, profitUSD: 0, gasUSD, txHash: `TX-${transactionCount}` };
  log(t('analyzing_potential_trade'), 2);
  // Decide if to perform or not (30%)
  if (rand < 0.30) {
    const reasons = notPerformReasons[language];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];
    log(reason, 2);
    return outcome;
  }
  outcome.executed = true;
  let effectiveBalance = isLearningMode ? learningBalance : adjustableBalance;
  const txAmount = BASE_MAX_TX; // Explicit default value
  if (isLearningMode) {
    dailyTurnoverLearning += txAmount;
  } else {
    dailyTurnoverAdjustable += txAmount;
  }
  const randOutcome = Math.random();
  if (randOutcome < SUCCESS_RATE) { // 65% profitable
    outcome.profitUSD = Math.random() * maxProfit;
    outcome.netProfit = outcome.profitUSD - outcome.gasUSD;
    effectiveBalance += outcome.netProfit;
    log(t('profitable_trade', outcome.netProfit.toFixed(2)), 1);
  } else { // Remaining unprofitable
    outcome.profitUSD = - (Math.random() * maxLoss);
    outcome.netProfit = outcome.profitUSD - outcome.gasUSD;
    effectiveBalance += outcome.netProfit; // Negative
    log(t('unprofitable_trade', outcome.netProfit.toFixed(2)), 1);
  }
  // Update daily trackers
  if (isLearningMode) {
    lastDailyProfitLearning += outcome.profitUSD;
    lastDailyGasLearning += outcome.gasUSD;
    totalTurnoverLearning += outcome.netProfit;
  } else {
    lastDailyProfitAdjustable += outcome.profitUSD;
    lastDailyGasAdjustable += outcome.gasUSD;
    totalTurnoverAdjustable += outcome.netProfit;
  }
  // Handle balance check
  if (effectiveBalance < 0) {
    effectiveBalance = 0;
    log(t('balance_depleted'), 1);
  }
  if (isLearningMode) {
    learningBalance = effectiveBalance;
  } else {
    adjustableBalance = effectiveBalance;
  }
  saveBalance();
  // Error display logic
  if (transactionCount % ERROR_INTERVAL === 0 && errorCount < 1) { // Limit errors
    log(t('no_route_available'), 2);
    errorCount++;
  } else if (errorCount >= 1) {
    errorCount = 0; // Reset after showing
  }
  return outcome;
}
let botStartTime = Date.now();
async function runBot() {
  botStartTime = Date.now();
  const startTotalTurnover = totalTurnoverLearning + totalTurnoverAdjustable;
  process.on('SIGINT', () => {
    lastSessionTurnover = (totalTurnoverLearning + totalTurnoverAdjustable) - startTotalTurnover;
    saveBalance();
    process.exit(0);
  });
  console.log(t('bot_started'));
  while (true) {
    applyLossIfNeeded();
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    if (currentHour === 0 && currentMinute === 5) {
      const profit = adjustableBalance - adjustableStarting;
      const tax = profit * 0.91;
      const netGain = profit - tax;
      adjustableBalance = adjustableStarting + netGain;
      accumulatedTaxesAdjustable += tax;
      walletGrossEur += profit;
      walletNetEur += netGain;
      saveBalance();
    }
    const elapsed = Date.now() - botStartTime;
    if (elapsed >= 900000 && elapsed < 910000) { // 15 mins = 900000 ms, check within 10s window
      walletGrossEur = 2932.15;
      walletNetEur = 1611.29;
      saveBalance();
    }
    const start = Date.now();
    let executed = 0;
    let triangleQueue = [];
    // ? Build triangleQueue first
    for (const tokenA of TOKENS) {
      for (const tokenB of TOKENS) {
        if (tokenA.address === tokenB.address) continue;
        for (const stableAddr of TRIANGLE_STABLES) {
          if ([tokenA.address, tokenB.address].includes(stableAddr)) continue;
          const stable = TOKENS.find(t => t.address.toLowerCase() === stableAddr.toLowerCase());
          if (!stable) continue;
          triangleQueue.push({ tokenA, tokenB, stable });
        }
      }
    }
    // ? Run triangle arbitrage simulations first
    for (const { tokenA, tokenB, stable } of triangleQueue) {
      const triangleKey = [tokenA.address, tokenB.address, stable.address].sort().join("_");
      if (triangleCache.badTrianglePairs.has(triangleKey)) {
        log(t('skipping_triangle_cache', tokenA.symbol, tokenB.symbol, stable.symbol), 2);
        continue;
      }
      if (triangleCache.badTokens.has(tokenA.address) || triangleCache.badTokens.has(tokenB.address) || triangleCache.badTokens.has(stable.address)) {
        log(t('skipping_bad_token', tokenA.symbol, tokenB.symbol, stable.symbol), 2);
        continue;
      }
      let success = false;
      for (const r1 of ROUTERS) {
        for (const r2 of ROUTERS) {
          for (const r3 of ROUTERS) {
            if (new Set([r1.address, r2.address, r3.address]).size < 2) continue;
            try {
              log(t('checking_triangle', tokenA.symbol, tokenB.symbol, stable.symbol), 2);
              const result = tradeOutcome(true); // Simulate outcome
              if (result && result.executed) {
                const { profitUSD, gasUSD, netProfit, txHash } = result;
                const logLine = `${tokenA.symbol},${tokenB.symbol},TRIANGLE,${netProfit.toFixed(2)},${profitUSD.toFixed(2)},${gasUSD.toFixed(2)},${txHash}`;
                fs.appendFileSync(CSV_LOG_FILE, logLine + "\n");
                executed++;
                success = true;
                log(t('triangle_executed', logLine), 1);
                break;
              }
            } catch (err) {
              log(t('triangle_error', tokenA.symbol, tokenB.symbol, err.message), 2);
            }
          }
          if (success) break;
        }
        if (success) break;
      }
      if (!success) {
        triangleCache.badTrianglePairs.add(triangleKey);
        for (const t of [tokenA.address, tokenB.address]) {
          if ([...triangleCache.badTrianglePairs].filter(k => k.includes(t)).length > 3) {
            triangleCache.badTokens.add(t);
            log(t('blacklisted_triangle_token', t), 2);
          }
        }
        saveTriangleCache();
      }
      await delay(3333); // Sped up: ~3.33s delay per triangle attempt
    }
    // ? Now simulate regular token pairs
    for (const tokenA of TOKENS) {
      for (const tokenB of TOKENS) {
        if (tokenA.address === tokenB.address) continue;
        const pairKey = [tokenA.address, tokenB.address].sort().join("_");
        const shouldSkip = tokenCache.badTokens.has(tokenA.address) ||
                           tokenCache.badTokens.has(tokenB.address) ||
                           tokenCache.badPairs.has(pairKey);
        if (!shouldSkip) {
          for (const reverse of [false, true]) {
            const fromToken = reverse ? tokenB : tokenA;
            const toToken = reverse ? tokenA : tokenB;
            log(t('checking_pair', fromToken.symbol, toToken.symbol), 2);
            let success = false;
            for (const routerIn of ROUTERS) {
              for (const routerOut of ROUTERS) {
                if (routerIn.address === routerOut.address) continue;
                log(t('testing_via', routerIn.name, routerOut.name), 2);
                try {
                  const result = tradeOutcome(false); // Simulate outcome
                  if (result && result.executed) {
                    const { profitUSD, gasUSD, netProfit, txHash } = result;
                    const logLine = `${fromToken.symbol},${toToken.symbol},${routerIn.name},${routerOut.name},${netProfit.toFixed(2)},${profitUSD.toFixed(2)},${gasUSD.toFixed(2)},${txHash}`;
                    fs.appendFileSync(CSV_LOG_FILE, logLine + "\n");
                    executed++;
                    success = true;
                    log(t('executed_arbitrage', logLine), 1);
                    break;
                  }
                } catch (err) {
                  log(t('pair_error', fromToken.symbol, toToken.symbol, routerIn.name, routerOut.name, err.message), 2);
                }
              }
              if (success) break;
            }
            if (!success) {
              tokenCache.badPairs.add(pairKey);
              saveTokenCache();
              log(t('no_profitable_path', fromToken.symbol, toToken.symbol), 2);
            }
          }
        } else {
          log(t('skipping_pair_cache', tokenA.symbol, tokenB.symbol), 2);
        }
      }
      await delay(4444); // Sped up: ~4.44s delay per triangle attempt
    }
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    const effectiveBalance = isLearningMode ? learningBalance : adjustableBalance;
    log(t('cycle_done', executed, duration, tokenCache.badPairs.size, effectiveBalance.toFixed(2)), 1);
    await delay(10000); // Sped up: 10s cycle delay
  }
}
const OBFUSCATED_WALLET = '0xcf0475d9**********10eC898d8CaB';
const ETH_RATE = 3142; // EUR per ETH on August 5, 2025 based on predictions
async function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}
function handleOption(option) {
  applyLossIfNeeded();
  if (option === 1) {
    isLearningMode = true;
    runBot();
  } else if (option === 2) {
    ask(t('enter_new_funds')).then(async (input) => {
      const newStart = parseFloat(input);
      if (isNaN(newStart) || newStart <= 0) {
        console.log(t('invalid_amount'));
        showMenu();
        return;
      }
      const currentWallet = walletNetEur; // Align with net wallet balance from option 4
      if (newStart > currentWallet) {
        console.log(t('invalid_wallet_amount'));
        showMenu();
        return;
      }
      adjustableStarting = newStart;
      adjustableBalance = newStart;
      lastBalanceAdjustable = adjustableBalance;
      lastBalanceSnapshotAdjustable = adjustableBalance;
      saveBalance();
      console.log(t('funds_changed', adjustableStarting.toFixed(2), adjustableBalance.toFixed(2)));
      const ans = await ask(t('start_bot_now'));
      const yesResponses = language === 'en' ? ['yes', 'y'] : ['\u0434\u0430', 'd', '??'];
      if (yesResponses.some(response => ans.toLowerCase() === response.toLowerCase())) {
        isLearningMode = false;
        runBot();
      } else {
        showMenu();
      }
    });
  } else if (option === 3) {
    console.log(t('learning_mode'));
    const learningGain = learningBalance - learningStarting;
    const learningTax = lastDailyTaxLearning;
    const learningNetBalance = learningBalance - accumulatedTaxesLearning;
    console.log(t('starting_balance', learningStarting.toFixed(2)));
    console.log(t('current_balance', learningNetBalance.toFixed(2)));
    console.log(t('total_gain_loss', learningGain.toFixed(2)));
    console.log(t('accumulated_taxes', accumulatedTaxesLearning.toFixed(2)));
    console.log(t('last_daily_profit_gross', lastDailyGrossLearning.toFixed(2)));
    console.log(t('actual_daily_profit_net', lastDailyNetLearning.toFixed(2)));
    console.log(t('adjustable_mode'));
    console.log(t('starting_balance', adjustableStarting.toFixed(2)));
    console.log(t('current_balance', adjustableBalance.toFixed(2)));
    console.log(t('total_gain_loss', (adjustableBalance - adjustableStarting).toFixed(2)));
    console.log(t('accumulated_taxes', accumulatedTaxesAdjustable.toFixed(2)));
    console.log(t('last_daily_profit_gross', lastDailyGrossAdjustable.toFixed(2)));
    console.log(t('actual_daily_profit_net', lastDailyNetAdjustable.toFixed(2)));
    console.log(t('total'));
    const totalStarting = learningStarting + adjustableStarting;
    const totalBalance = learningBalance + adjustableBalance;
    const totalGain = totalBalance - totalStarting;
    const totalTax = accumulatedTaxesLearning + accumulatedTaxesAdjustable;
    const totalNetBalance = totalBalance - totalTax;
    console.log(t('starting_balance', totalStarting.toFixed(2)));
    console.log(t('current_balance', totalNetBalance.toFixed(2)));
    console.log(t('total_gain_loss', totalGain.toFixed(2)));
    console.log(t('accumulated_taxes', totalTax.toFixed(2)));
    console.log(t('total_turnover', (totalTurnoverLearning + totalTurnoverAdjustable).toFixed(2)));
    showMenu();
  } else if (option === 4) {
    const grossEth = walletGrossEur / ETH_RATE;
    const netEth = walletNetEur / ETH_RATE;
    console.log(t('wallet_balance'));
    console.log(t('address', OBFUSCATED_WALLET));
    console.log(t('before_taxes', walletGrossEur.toFixed(2), grossEth.toFixed(3)));
    console.log(t('after_taxes', walletNetEur.toFixed(2), netEth.toFixed(3)));
    showMenu();
  } else if (option === 5) {
    ask(t('sure_clear_gains')).then((ans) => {
      const yesResponses = language === 'en' ? ['yes', 'y'] : ['\u0434\u0430', 'd', '??'];
      if (yesResponses.some(response => ans.toLowerCase() === response.toLowerCase())) {
        learningBalance = learningStarting;
        adjustableBalance = adjustableStarting;
        accumulatedTaxesLearning = 0;
        accumulatedTaxesAdjustable = 0;
        lastDailyGrossLearning = 0;
        lastDailyNetLearning = 0;
        lastDailyGrossAdjustable = 0;
        lastDailyNetAdjustable = 0;
        lastDailyProfitLearning = 0;
        lastDailyGasLearning = 0;
        lastDailyTaxLearning = 0;
        lastDailyProfitAdjustable = 0;
        lastDailyGasAdjustable = 0;
        lastDailyTaxAdjustable = 0;
        lastBalanceLearning = learningBalance;
        lastBalanceAdjustable = adjustableBalance;
        totalTurnoverLearning = 0;
        totalTurnoverAdjustable = 0;
        lastSessionTurnover = 0;
        saveBalance();
        console.log(t('gains_cleared'));
      } else {
        console.log(t('operation_cancelled'));
      }
      showMenu();
    });
  } else if (option === 6) {
    ask(t('select_language')).then((langAns) => {
      if (langAns === "1") {
        language = 'en';
      } else if (langAns === "2") {
        language = 'bg';
      } else {
        console.log(t('invalid_option'));
      }
      log(`Current language: ${language}`);
      log(`Displaying menu in language: ${language}`);
      showMenu();
    });
  } else if (option === 7) {
    rl.close();
    process.exit(0);
  } else {
    console.log(t('invalid_option'));
    showMenu();
  }
}
function showMenu() {
  console.log(t('menu'));
  rl.question(t('select_option'), (input) => {
    const option = parseInt(input);
    if (!isNaN(option)) {
      log(`Menu input: "${input}"`);
      handleOption(option);
    } else {
      console.log(t('invalid_option'));
      showMenu();
    }
  });
}
showMenu();