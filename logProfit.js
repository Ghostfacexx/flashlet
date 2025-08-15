const fs = require("fs");
const path = require("path");

const logPath = path.join(__dirname, "..", "profits.csv");

function logProfit({ timestamp, input, output, profit, txHash, route }) {
  const headers = "Timestamp,Input Token,Output Token,Profit,Route,TxHash\n";
  const entry = `${timestamp},${input},${output},${profit},${route},${txHash}\n`;

  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, headers);
  }

  fs.appendFileSync(logPath, entry);
}

module.exports = { logProfit };
