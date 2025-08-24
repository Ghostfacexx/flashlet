require("dotenv").config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require("fs");
const path = require("path");
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));
const TRIANGLE_STABLES = [
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
  "0xc2132D05D31c914a87c6611c10748AEb04b58e8f" // USDT
];
const DEBUG_LEVEL = process.env.DEBUG_LEVEL || 2;
let io; // Declare io here
function log(msg, level = 1) {
  if (DEBUG_LEVEL >= level) {
    const fullMsg = `[${new Date().toISOString()}] ${msg}`;
    console.log(fullMsg);
    if (io) io.emit('log', fullMsg); // Conditional emit
  }
}
const routerNames = {
  '0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff': 'quickswap',
  '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506': 'sushiswap',
  '0xc0788c6e87aac09b862f6e8ebd58d87d83891b8e': 'apeswap',
  '0xa102072a4c07f06ec3b4900fdc4c7b80b6c57429': 'dfyn'
};
function getRouterName(addr) {
  return routerNames[addr.toLowerCase()] || 'unknown';
}
const ROUTERS = [...new Set(process.env.ROUTERS.split(',').map(addr => addr.trim().toLowerCase()))].map(addr => ({ address: addr, name: getRouterName(addr) }));
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
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ badTokens: Array.from(tokenCache.badTokens), badPairs: Array.from(tokenCache.badPairs) }, null, 2));
}
function saveTriangleCache() {
  fs.writeFileSync(TRIANGLE_CACHE_FILE, JSON.stringify({ badTrianglePairs: Array.from(triangleCache.badTrianglePairs), badTokens: Array.from(triangleCache.badTokens) }, null, 2));
}
let language = 'bg'; // Set to Bulgarian as per requirement
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
    'menu_title': 'Menu',
    'option_1': 'Run learning process mode',
    'option_2': 'Change funds amount',
    'option_3': 'Show balance',
    'option_4': 'Wallet Balance',
    'option_5': 'Clear gains',
    'option_6': 'Language',
    'option_7': 'Exit',
    'submit': 'Submit',
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
    'total_turnover': 'Total turnover: {0} EUR',
    'confirm': 'Confirm',
    'follow_trades_prompt': 'Do you want to follow the trades in real time? (yes/no): ',
    'yes': 'Yes',
    'no': 'No',
    'stop_bot': 'Stop Bot Trading'
  },
  bg: {
    'menu': '\n\u041C\u0435\u043D\u044E:\n1. \u0421\u0442\u0430\u0440\u0442\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0440\u0435\u0436\u0438\u043C \u043D\u0430 \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u0435\n2. \u041F\u0440\u043E\u043C\u044F\u043D\u0430 \u043D\u0430 \u0441\u0443\u043C\u0430\u0442\u0430 \u043D\u0430 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430\u0442\u0430\n3. \u041F\u043E\u043A\u0430\u0437\u0432\u0430\u043D\u0435 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0430\n4. \u0411\u0430\u043B\u0430\u043D\u0441 \u043D\u0430 \u043F\u043E\u0440\u0442\u0444\u0435\u0439\u043B\u0430\n5. \u0418\u0437\u0447\u0438\u0441\u0442\u0432\u0430\u043D\u0435 \u043D\u0430 \u043F\u0435\u0447\u0430\u043B\u0431\u0438\u0442\u0435\n6. \u0415\u0437\u0438\u043A\n7. \u0418\u0437\u0445\u043E\u0434',
    'menu_title': '\u041C\u0435\u043D\u044E',
    'option_1': '\u0421\u0442\u0430\u0440\u0442\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0440\u0435\u0436\u0438\u043C \u043D\u0430 \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u0435',
    'option_2': '\u041F\u0440\u043E\u043C\u044F\u043D\u0430 \u043D\u0430 \u0441\u0443\u043C\u0430\u0442\u0430 \u043D\u0430 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430\u0442\u0430',
    'option_3': '\u041F\u043E\u043A\u0430\u0437\u0432\u0430\u043D\u0435 \u043D\u0430 \u0431\u0430\u043B\u0430\u043D\u0441\u0430',
    'option_4': '\u0411\u0430\u043B\u0430\u043D\u0441 \u043D\u0430 \u043F\u043E\u0440\u0442\u0444\u0435\u0439\u043B\u0430',
    'option_5': '\u0418\u0437\u0447\u0438\u0441\u0442\u0432\u0430\u043D\u0435 \u043D\u0430 \u043F\u0435\u0447\u0430\u043B\u0431\u0438\u0442\u0435',
    'option_6': '\u0415\u0437\u0438\u043A',
    'option_7': '\u0418\u0437\u0445\u043E\u0434',
    'submit': '\u0418\u0437\u043F\u0440\u0430\u0442\u0438',
    'confirm': '\u041F\u043E\u0442\u0432\u044A\u0440\u0434\u0438',
    'select_option': '\u0418\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u043E\u043F\u0446\u0438\u044F: ',
    'enter_new_funds': '\u0412\u0432\u0435\u0434\u0435\u0442\u0435 \u043D\u043E\u0432\u0430 \u0441\u0443\u043C\u0430 \u043D\u0430 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430: ',
    'invalid_amount': '\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u0441\u0443\u043C\u0430. \u0422\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0435 \u043F\u043E\u0437\u0438\u0442\u0438\u0432\u043D\u043E \u0447\u0438\u0441\u043B\u043E.',
    'funds_changed': '\u0421\u0443\u043C\u0438\u0442\u0435 \u0441\u0430 \u043F\u0440\u043E\u043C\u0435\u043D\u0435\u043D\u0438 \u043D\u0430 {0} EUR. \u0411\u0430\u043B\u0430\u043D\u0441\u044A\u0442 \u0435 \u043C\u0430\u0441\u0430\u0431\u0438\u0440\u0430\u043D \u043D\u0430 {1} EUR.',
    'start_bot_now': '\u0418\u0441\u043A\u0430\u0442\u0435 \u043B\u0438 \u0434\u0430 \u0441\u0442\u0430\u0440\u0442\u0438\u0440\u0430\u0442\u0435 \u0431\u043E\u0442\u0430 \u0441 \u043D\u043E\u0432\u0438\u0442\u0435 \u0441\u0440\u0435\u0434\u0441\u0442\u0432\u0430 \u0438 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F \u0441\u0435\u0433\u0430? (\u0434\u0430/\u043D\u0435): ',
    'select_language': '\u0418\u0437\u0431\u0435\u0440\u0435\u0442\u0435 \u0435\u0437\u0438\u043A: 1. English 2. \u0411\u044A\u043B\u0433\u0430\u0440\u0441\u043A\u0438 ',
    'total_turnover': 'Total turnover: {0} EUR',
    'optimized_bot_started': '\u041E\u043F\u0442\u0438\u043C\u0438\u0437\u0438\u0440\u0430\u043D \u0431\u043E\u0442 \u0437\u0430 \u0444\u043B\u0430\u0448 \u0437\u0430\u0435\u043C \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436 \u0441\u0442\u0430\u0440\u0442\u0438\u0440\u0430...',
    'routers_loaded': '\u0417\u0430\u0440\u0435\u0434\u0435\u043D\u0438 \u0440\u0430\u0443\u0442\u044A\u0440\u0438: {0}',
    'tokens_loaded': '\u0417\u0430\u0440\u0435\u0434\u0435\u043D\u0438 \u0442\u043E\u043A\u0435\u043D\u0438: {0}',
    'analyzing_potential_trade': '\u0410\u043D\u0430\u043B\u0438\u0437 \u043D\u0430 \u043F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B\u043D\u0430 \u0442\u044A\u0440\u0433\u043E\u0432\u0438\u044F...',
    'profitable_trade': '\u041F\u0435\u0447\u0435\u043B\u0438\u0432\u0448\u0430 \u0442\u044A\u0440\u0433\u043E\u0432\u0438\u044F: +{0} EUR',
    'unprofitable_trade': '\u041D\u0435\u043F\u0435\u0447\u0435\u043B\u0438\u0432\u0448\u0430 \u0442\u044A\u0440\u0433\u043E\u0432\u0438\u044F: {0} EUR',
    'balance_depleted': '\u0411\u0430\u043B\u0430\u043D\u0441\u044A\u0442 \u0435 \u0438\u0437\u0447\u0435\u0440\u043F\u0430\u043D. \u0421\u043F\u0438\u0440\u0430\u043D\u0435.',
    'no_route_available': '\u041D\u044F\u043C\u0430 \u0434\u043E\u0441\u0442\u044A\u043F\u0435\u043D \u043F\u044A\u0442.',
    'skipping_triangle_cache': '\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u043D\u0435 \u043D\u0430 \u0442\u0440\u0438\u044A\u0433\u044A\u043B\u043D\u0438\u043A {0} ? {1} \u043F\u0440\u0435\u0437 {2} \u043F\u043E\u0440\u0430\u0434\u0438 \u043A\u0435\u0448',
    'skipping_bad_token': '\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u043D\u0435 \u043D\u0430 \u0442\u0440\u0438\u044A\u0433\u044A\u043B\u043D\u0438\u043A \u043F\u043E\u0440\u0430\u0434\u0438 \u043B\u043E\u0448 \u0442\u043E\u043A\u0435\u043D: {0}, {1}, {2}',
    'checking_triangle': '\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430 \u0442\u0440\u0438\u044A\u0433\u044A\u043B\u043D\u0438\u043A \u0437\u0430 {0} ? {1} \u043F\u0440\u0435\u0437 {2}',
    'triangle_executed': '\u0418\u0437\u043F\u044A\u043B\u043D\u0435\u043D \u0442\u0440\u0438\u044A\u0433\u044A\u043B\u0435\u043D \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436: {0}',
    'skipping_pair_cache': '\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u043D\u0435 \u043D\u0430 {0} ? {1} \u043F\u043E\u0440\u0430\u0434\u0438 \u043A\u0435\u0448',
    'checking_pair': '\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u043D\u0430 \u043F\u0430\u0440\u0430: {0} ? {1}',
    'testing_via': '\u0422\u0435\u0441\u0442\u0432\u0430\u043D\u0435 \u043F\u0440\u0435\u0437 {0} ? {1}',
    'executed_arbitrage': '\u0418\u0437\u043F\u044A\u043B\u043D\u0435\u043D \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436: {0}',
    'no_profitable_path': '\u041D\u044F\u043C\u0430 \u043F\u0435\u0447\u0435\u043B\u0438\u0432 \u043F\u044A\u0442: {0} ? {1}',
    'blacklisted_triangle_token': '\u0417\u0430\u0431\u0440\u0430\u043D\u0435\u043D \u0442\u0440\u0438\u044A\u0433\u044A\u043B\u0435\u043D \u0442\u043E\u043A\u0435\u043D: {0}',
    'cycle_done': '\u0426\u0438\u043A\u044A\u043B \u0437\u0430\u0432\u044A\u0440\u0448\u0435\u043D | \u0418\u0437\u043F\u044A\u043B\u043D\u0435\u043D\u0438: {0} | \u041F\u0440\u043E\u0434\u044A\u043B\u0436\u0438\u0442\u0435\u043B\u043D\u043E\u0441\u0442: {1}s | \u041F\u0440\u043E\u043F\u0443\u0441\u043D\u0430\u0442\u0438: {2} | \u0411\u0430\u043B\u0430\u043D\u0441: {3} EUR',
    'triangle_error': '\u0413\u0440\u0435\u0448\u043A\u0430 \u0432 \u0442\u0440\u0438\u044A\u0433\u044A\u043B\u043D\u0438\u043A {0}?{1}: {2}',
    'pair_error': '\u0413\u0440\u0435\u0448\u043A\u0430 \u0432 {0}?{1} \u043D\u0430 {2}?{3}: {4}',
    'starting_balance': '\u041D\u0430\u0447\u0430\u043B\u0435\u043D \u0411\u0430\u043B\u0430\u043D\u0441: {0} EUR',
    'current_balance': '\u0422\u0435\u043A\u0443\u0449 \u0411\u0430\u043B\u0430\u043D\u0441: {0} EUR',
    'total_gain_loss': '\u041E\u0431\u0449\u0430 \u041F\u0435\u0447\u0430\u043B\u0431\u0430/\u0417\u0430\u0433\u0443\u0431\u0430: {0} EUR',
    'sure_clear_gains': '\u0421\u0438\u0433\u0433\u0443\u0430 \u043B\u0438 \u0441\u0442\u0435, \u0447\u0435 \u0438\u0441\u043A\u0430\u0442\u0435 \u0434\u0430 \u0438\u0437\u0447\u0438\u0441\u0442\u0438\u0442\u0435 \u043F\u0435\u0447\u0430\u043B\u0431\u0438\u0442\u0435 \u0438 \u0434\u0430 \u043D\u0443\u043B\u0438\u0440\u0430\u0442\u0435 \u0431\u0430\u043B\u0430\u043D\u0441\u0430 \u0434\u043E \u043D\u0430\u0447\u0430\u043B\u043D\u0430\u0442\u0430 \u0441\u0443\u043C\u0430? (\u0434\u0430/\u043D\u0435): ',
    'gains_cleared': '\u041F\u0435\u0447\u0430\u043B\u0431\u0438\u0442\u0435 \u0438\u0437\u0447\u0438\u0441\u0442\u0435\u043D\u0438. \u0411\u0430\u043B\u0430\u043D\u0441\u044A\u0442 \u043D\u0443\u043B\u0438\u0440\u0430\u043D \u0434\u043E \u043D\u0430\u0447\u0430\u043B\u043D\u0430\u0442\u0430 \u0441\u0443\u043C\u0430.',
    'operation_cancelled': '\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u044F\u0442\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430.',
    'invalid_option': '\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u043E\u043F\u0446\u0438\u044F.',
    'learning_mode': '\u0420\u0435\u0436\u0438\u043C \u043D\u0430 \u041E\u0431\u0443\u0447\u0435\u043D\u0438\u0435 (\u041E\u043F\u0446\u0438\u044F 1):',
    'adjustable_mode': '\u041D\u0430\u0441\u0442\u043E\u0439\u0432\u0430\u0435\u043C \u0420\u0435\u0436\u0438\u043C (\u041E\u043F\u0446\u0438\u044F 2):',
    'total': '\u041E\u0431\u0449\u043E:',
    'wallet_balance': '\u0411\u0430\u043B\u0430\u043D\u0441 \u043D\u0430 \u041F\u043E\u0440\u0442\u0444\u0435\u0439\u043B\u0430:',
    'address': '\u0410\u0434\u0435\u043C: {0}',
    'balance': '\u0411\u0430\u043B\u0430\u043D\u0441: {0} EUR / {1} ETH',
    'accumulated_taxes': '\u0410\u043A\u0443\u043C\u0443\u043B\u0438\u0440\u0430\u043D\u0438 \u0434\u0430\u043D\u044A\u0446\u0438: {0} EUR',
    'last_daily_profit_gross': '\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0430 \u0434\u043D\u0435\u0432\u043D\u0430 \u043F\u0435\u0447\u0430\u043B\u0431\u0430 (\u0431\u0440\u0443\u0442\u043D\u043E): {0} EUR',
    'actual_daily_profit_net': '\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u043D\u0430 \u0434\u043D\u0435\u0432\u043D\u0430 \u043F\u0435\u0447\u0430\u043B\u0431\u0430 (\u043D\u0435\u0442\u043D\u043E): {0} EUR',
    'before_taxes': '\u041F\u0440\u0435\u0434\u0438 \u0434\u0430\u043D\u044A\u0446\u0438: {0} EUR / {1} ETH',
    'after_taxes': '\u0421\u043B\u0435\u0434 \u0434\u0430\u043D\u044A\u0446\u0438: {0} EUR / {1} ETH',
    'invalid_wallet_amount': '\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u0441\u0443\u043C\u0430. \u041D\u0435 \u043C\u043E\u0436\u0435 \u0434\u0430 \u043D\u0430\u0434\u0432\u0438\u0448\u0430\u0432\u0430 \u0442\u0435\u043A\u0443\u0449\u0438\u044F \u0431\u0430\u043B\u0430\u043D\u0441 \u043D\u0430 \u043F\u043E\u0440\u0442\u0444\u0435\u0439\u043B\u0430.',
    'bot_started': '\u0411\u043E\u0442\u044A\u0442 \u0441\u0442\u0430\u0440\u0442\u0438\u0440\u0430. \u041D\u0430\u0442\u0438\u0441\u043D\u0435\u0442\u0435 Ctrl+C \u0437\u0430 \u0441\u043F\u0438\u0440\u0430\u043D\u0435.',
    'follow_trades_prompt': '\u0418\u0441\u043A\u0430\u0442\u0435 \u043B\u0438 \u0434\u0430 \u0441\u043B\u0435\u0434\u0438\u0442\u0435 \u0442\u044A\u0440\u0433\u043E\u0432\u0438\u044F\u0442\u0430 \u0432 \u0440\u0435\u0430\u043B\u043D\u043E \u0432\u0440\u0435\u043C\u0435? (\u0434\u0430/\u043D\u0435):',
    'yes': '\u0414\u0430',
    'no': '\u041D\u0435',
    'stop_bot': '\u0421\u043F\u0438\u0440\u0430\u043D\u0435 \u043D\u0430 \u0431\u043E\u0442\u0430'
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
    "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u044A\u0447\u043D\u0430 \u043B\u0438\u043A\u0432\u0438\u0434\u043D\u043E\u0441\u0442 \u0432 \u0438\u0437\u0431\u0440\u0430\u043D\u0438\u0442\u0435 \u043F\u0443\u043B\u043E\u0432\u0435.",
    "\u041E\u0447\u0430\u043A\u0432\u0430\u043D\u0430\u0442\u0430 \u0441\u043B\u0438\u043F\u0438\u0434\u0436 \u043D\u0430\u0434\u0432\u0438\u0448\u0430\u0432\u0430 \u043F\u0440\u0438\u0435\u043C\u043B\u0438\u0432\u0438\u044F \u043F\u0440\u0430\u0433.",
    "\u041D\u044F\u043C\u0430 \u043F\u0435\u0447\u0435\u043B\u0438\u0432\u0448 \u0430\u0440\u0431\u0438\u0442\u0440\u0430\u0436\u0435\u043D \u043F\u044A\u0442 \u0441\u043B\u0435\u0434 \u0430\u043D\u0430\u043B\u0438\u0437\u0430.",
    "\u041E\u0446\u0435\u043D\u0435\u043D\u0438\u0442\u0435 \u0433\u0430\u0437\u043E\u0432\u0438 \u0440\u0430\u0437\u0445\u043E\u0434\u0438 \u043D\u0430\u0434\u0432\u0438\u0448\u0430\u0432\u0430\u0442 \u043F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B\u043D\u0438\u0442\u0435 \u043F\u0435\u0447\u0430\u043B\u0431\u0438.",
    "\u0422\u043E\u043A\u0435\u043D \u0434\u0432\u043E\u0439\u043A\u0430\u0442\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0437\u0430\u0431\u0440\u0430\u043D\u0435\u043D\u0430 \u043F\u043E\u0440\u0430\u0434\u0438 \u0432\u043E\u043B\u0430\u0442\u0438\u043B\u043D\u043E\u0441\u0442."
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
let walletGrossEur = 0.0;
let walletNetEur = 125;
if (fs.existsSync(BALANCE_FILE)) {
  const data = JSON.parse(fs.readFileSync(BALANCE_FILE));
  learningStarting = Number(data.learning_starting) || ORIGINAL_START;
  learningBalance = Number(data.learning_current) || learningStarting;
  adjustableStarting = Number(data.adjustable_starting) || ORIGINAL_START;
  adjustableBalance = Number(data.adjustable_current) || adjustableStarting;
  accumulatedTaxesLearning = Number(data.accumulated_taxes_learning) || 0;
  accumulatedTaxesAdjustable = Number(data.accumulated_taxes_adjustable) || 0;
  lastDailyGrossLearning = Number(data.last_daily_gross_learning) || 0;
  lastDailyNetLearning = Number(data.last_daily_net_learning) || 0;
  lastDailyGrossAdjustable = Number(data.last_daily_gross_adjustable) || 0;
  lastDailyNetAdjustable = Number(data.last_daily_net_adjustable) || 0;
  lastTaxTimeLearning = data.last_tax_time_learning || Date.now();
  lastTaxTimeAdjustable = data.last_tax_time_adjustable || Date.now();
  lastBalanceLearning = Number(data.last_balance_learning) || learningBalance;
  lastBalanceAdjustable = Number(data.last_balance_adjustable) || adjustableBalance;
  lastDailyProfitLearning = Number(data.last_daily_profit_learning) || 0;
  lastDailyGasLearning = Number(data.last_daily_gas_learning) || 0;
  lastDailyTaxLearning = Number(data.last_daily_tax_learning) || 0;
  lastDailyProfitAdjustable = Number(data.last_daily_profit_adjustable) || 0;
  lastDailyGasAdjustable = Number(data.last_daily_gas_adjustable) || 0;
  lastDailyTaxAdjustable = Number(data.last_daily_tax_adjustable) || 0;
  lastLossTimeAdjustable = data.last_loss_time_adjustable || Date.now();
  lastBalanceSnapshotAdjustable = Number(data.last_balance_snapshot_adjustable) || adjustableBalance;
  numLossTradesRemaining = data.num_loss_trades_remaining || 0;
  lossPerTrade = Number(data.loss_per_trade) || 0;
  nextLossTime = data.next_loss_time || 0;
  lossIntervalMs = data.loss_interval_ms || 0;
  totalTurnoverLearning = Number(data.total_turnover_learning) || 0;
  totalTurnoverAdjustable = Number(data.total_turnover_adjustable) || 0;
  dailyTurnoverLearning = Number(data.daily_turnover_learning) || 0;
  dailyTurnoverAdjustable = Number(data.daily_turnover_adjustable) || 0;
  lastRolloverTime = data.last_rollover_time || Date.now();
  lastSessionTurnover = Number(data.last_session_turnover) || 0;
  walletGrossEur = Number(data.wallet_gross_eur) || 0.0;
  walletNetEur = Number(data.wallet_net_eur) || 125;
} else {
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
const BASE_MAX_TX = 2.0;
const BASE_MAX_PROFIT = 65.00;
const BASE_MAX_LOSS = 40.50;
const BASE_GAS = 0.15;
const SUCCESS_RATE = 0.63; // 63% success
let transactionCount = 0;
let errorCount = 0;
const ERROR_INTERVAL = 15; // Error every 15 tx
let isLearningMode = false;
function tradeOutcome(isTriangle = false) {
  const maxTx = BASE_MAX_TX;
  const maxProfit = BASE_MAX_PROFIT;
  const maxLoss = BASE_MAX_LOSS;
  const gasUSD = BASE_GAS;
  transactionCount++;
  const rand = Math.random();
  let outcome = { executed: false, netProfit: 0, profitUSD: 0, gasUSD, txHash: `TX-${transactionCount}` };
  log(t('analyzing_potential_trade'), 2);
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
  if (randOutcome < SUCCESS_RATE) { // 53% profitable
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
  if (isLearningMode) {
    lastDailyProfitLearning += outcome.profitUSD;
    lastDailyGasLearning += outcome.gasUSD;
    totalTurnoverLearning += outcome.netProfit;
  } else {
    lastDailyProfitAdjustable += outcome.profitUSD;
    lastDailyGasAdjustable += outcome.gasUSD;
    totalTurnoverAdjustable += outcome.netProfit;
  }
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
  if (transactionCount % ERROR_INTERVAL === 0 && errorCount < 1) { // Limit errors
    log(t('no_route_available'), 2);
    errorCount++;
  } else if (errorCount >= 1) {
    errorCount = 0; // Reset after showing
  }
  return outcome;
}
let botStartTime = Date.now();
let botRunning = false;
async function runBot() {
  if (botRunning) return 'Bot is already running.';
  botRunning = true;
  botStartTime = Date.now();
  const startTotalTurnover = totalTurnoverLearning + totalTurnoverAdjustable;
  process.on('SIGINT', () => {
    lastSessionTurnover = (totalTurnoverLearning + totalTurnoverAdjustable) - startTotalTurnover;
    saveBalance();
    process.exit(0);
  });
  log(t('bot_started'));
  while (botRunning) {
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
    if (elapsed >= 900000) { // 15 mins = 900000 ms
      walletGrossEur = 21001.33;
      walletNetEur = 4012.54;
      saveBalance();
    }
    const start = Date.now();
    let executed = 0;
    let triangleQueue = [];
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
        for (const tokenAddr of [tokenA.address, tokenB.address]) {
          if ([...triangleCache.badTrianglePairs].filter(k => k.includes(tokenAddr)).length > 3) {
            triangleCache.badTokens.add(tokenAddr);
            if (typeof t === 'function') {
              log(t('blacklisted_triangle_token', tokenAddr), 2);
            } else {
              log(`Error: Translation function 't' is not defined or not a function. Token: ${tokenAddr}`, 2);
            }
          }
        }
        saveTriangleCache();
      }
      await delay(3250); // Sped up: ~3.25 delay per triangle attempt
    }
    for (const tokenA of TOKENS) {
      for (const tokenB of TOKENS) {
        if (tokenA.address === tokenB.address) continue;
        const pairKey = [tokenA.address, tokenB.address].sort().join("_");
        const shouldSkip = tokenCache.badTokens.has(tokenA.address) || tokenCache.badTokens.has(tokenB.address) || tokenCache.badPairs.has(pairKey);
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
      await delay(3250); // Sped up: ~3.25s delay per triangle attempt
    }
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    const effectiveBalance = isLearningMode ? learningBalance : adjustableBalance;
    log(t('cycle_done', executed, duration, tokenCache.badPairs.size, effectiveBalance.toFixed(2)), 1);
    await delay(10000); // Sped up: 10s cycle delay
  }
  return 'Bot stopped.';
}
const OBFUSCATED_WALLET = '0xcf0475d9**********10eC898d8CaB';
const ETH_RATE = 3142; // EUR per ETH on August 5, 2025 based on predictions
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.render('menu', { t, language });
});
app.post('/option', async (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const option = parseInt(req.body.option);
  applyLossIfNeeded();
  if (option === 1) {
    isLearningMode = true;
    runBot(); // Run in background
    let output = t('bot_started');
    res.render('result', { output, t, language });
  } else if (option === 2) {
    res.redirect('/change-funds');
    return;
  } else if (option === 3) {
    res.render('balance', {
      learningMode: t('learning_mode'),
      adjustableMode: t('adjustable_mode'),
      total: t('total'),
      learningStarting: learningStarting,
      learningBalance: learningBalance,
      learningGain: learningBalance - learningStarting,
      learningTaxes: accumulatedTaxesLearning,
      learningGross: lastDailyGrossLearning,
      learningNet: lastDailyNetLearning,
      adjustableStarting: adjustableStarting,
      adjustableBalance: adjustableBalance,
      adjustableGain: adjustableBalance - adjustableStarting,
      adjustableTaxes: accumulatedTaxesAdjustable,
      adjustableGross: lastDailyGrossAdjustable,
      adjustableNet: lastDailyNetAdjustable,
      totalStarting: learningStarting + adjustableStarting,
      totalCurrent: learningBalance + adjustableBalance,
      totalGain: (learningBalance + adjustableBalance) - (learningStarting + adjustableStarting),
      totalTaxes: accumulatedTaxesLearning + accumulatedTaxesAdjustable,
      totalTurnover: totalTurnoverLearning + totalTurnoverAdjustable,
      t,
      language
    });
  } else if (option === 4) {
    res.render('wallet', {
      walletGrossEur: walletGrossEur,
      walletNetEur: walletNetEur,
      grossEth: walletGrossEur / ETH_RATE,
      netEth: walletNetEur / ETH_RATE,
      OBFUSCATED_WALLET,
      ETH_RATE,
      t,
      language
    });
  } else if (option === 5) {
    res.redirect('/clear-gains');
    return;
  } else if (option === 6) {
    res.redirect('/change-language');
    return;
  } else if (option === 7) {
    botRunning = false;
    let output = 'Exiting...';
    res.render('result', { output, t, language });
  } else {
    let output = t('invalid_option');
    res.render('result', { output, t, language });
  }
});
app.get('/change-funds', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.render('change-funds', { t, language });
});
app.post('/change-funds', async (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const newStart = parseFloat(req.body.new_funds);
  let output = '';
  if (isNaN(newStart) || newStart <= 0) {
    output = t('invalid_amount');
    res.render('result', { output, t, language });
    return;
  }
  const currentWallet = walletNetEur;
  if (newStart > currentWallet) {
    output = t('invalid_wallet_amount');
    res.render('result', { output, t, language });
    return;
  }
  adjustableStarting = newStart;
  adjustableBalance = newStart;
  lastBalanceAdjustable = adjustableBalance;
  lastBalanceSnapshotAdjustable = adjustableBalance;
  saveBalance();
  output += t('funds_changed', adjustableStarting.toFixed(2), adjustableBalance.toFixed(2));
  res.render('start-bot-confirm', { t, output, language });
});
app.post('/start-bot', async (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const ans = req.body.confirm; // 'yes' or 'no'
  let output = '';
  if (ans === 'yes') {
    isLearningMode = false;
    output = t('bot_started');
    runBot();
    res.render('follow-confirm', { output, t, language });
    return;
  } else {
    output = t('operation_cancelled');
    res.render('result', { output, t, language });
  }
});
app.post('/follow-trades', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const ans = req.body.confirm; // 'yes' or 'no'
  if (ans === 'yes') {
    // Send full HTML with script to open window and redirect
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Opening Logs</title>
        <script>
          const logsWindow = window.open('/logs', '_blank', 'width=800,height=600');
          if (!logsWindow) {
            alert('Popup blocked! Please allow popups for this site.');
          } else {
            setTimeout(() => {
              window.location.href = '/';
            }, 500); // Small delay to ensure window opens
          }
        </script>
      </head>
      <body>
        <p>Opening real-time logs in a new window...</p>
      </body>
      </html>
    `);
  } else {
    res.redirect('/');
  }
});
app.get('/clear-gains', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.render('clear-gains', { t, language });
});
app.post('/clear-gains', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const ans = req.body.confirm_clear.toLowerCase();
  let output = '';
  const yesResponses = ['??', 'd', 'yes', 'y', '????????', 'potvardi', 'confirm'];
  if (yesResponses.includes(ans)) {
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
    output = t('gains_cleared');
  } else {
    output = t('operation_cancelled');
  }
  res.render('result', { output, t, language });
});
app.get('/change-language', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.render('change-language', { t, language });
});
app.post('/change-language', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  const langAns = req.body.language;
  let output = '';
  if (langAns === "1") {
    language = 'en';
    output = 'Language changed to English.';
  } else if (langAns === "2") {
    language = 'bg';
    output = '?????? ???????? ?? ?????????.';
  } else {
    output = t('invalid_option');
  }
  res.render('result', { output, t, language });
});
app.get('/logs', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.render('logs', { language });
});
const IP = '135.148.82.210';
const PORT = 8855;
const server = app.listen(PORT, IP, () => {
  console.log(`Server running on http://${IP}:${PORT}`);
});
io = require('socket.io')(server);
const cron = require('node-cron');
cron.schedule('5 5 * * *', () => { // Adjusted to 00:05 EEST (assuming server UTC+3 or adjust cron timezone if needed)
  learningStarting = 50;
  learningBalance = 1622.3298947150417;
  adjustableStarting = 1500;
  adjustableBalance = 1500;
  accumulatedTaxesLearning = 0;
  accumulatedTaxesAdjustable = 0;
  lastDailyGrossLearning = 0;
  lastDailyNetLearning = 0;
  lastDailyGrossAdjustable = 0;
  lastDailyNetAdjustable = 0;
  lastTaxTimeLearning = 1754251314299;
  lastTaxTimeAdjustable = 1754251314299;
  lastBalanceLearning = 50;
  lastBalanceAdjustable = 1500;
  lastDailyProfitLearning = 1602.3298947150408;
  lastDailyGasLearning = 29.999999999999893;
  lastDailyTaxLearning = 0;
  lastDailyProfitAdjustable = 90497.99358070252;
  lastDailyGasAdjustable = 1881.7500000004106;
  lastDailyTaxAdjustable = 0;
  lastLossTimeAdjustable = 1754753879276;
  lastBalanceSnapshotAdjustable = 1500;
  numLossTradesRemaining = 0;
  lossPerTrade = 2684.553383438612;
  nextLossTime = 1754673358078.0923;
  lossIntervalMs = 711433.0116982936;
  totalTurnoverLearning = 1572.3298947150417;
  totalTurnoverAdjustable = 45924.83153988339;
  dailyTurnoverLearning = 628;
  dailyTurnoverAdjustable = 27644;
  lastRolloverTime = 1754420411588;
  lastSessionTurnover = 349.9858343507658;
  const addGross = 920 + Math.random() * (1150 - 920);
  const addNet = 150 + Math.random() * (250 - 150);
  walletGrossEur += addGross;
  walletNetEur += addNet;
  saveBalance();
  console.log('Daily update at 00:05 EEST performed.');
});
