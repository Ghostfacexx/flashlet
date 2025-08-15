const hre = require("hardhat");

async function main() {
  const contractAddress = "0xE95fb5A6c633e3992B58d56bA80130ec1B99d344";
  const addressProvider = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
const routers = [
  "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap
  "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // SushiSwap ← FIXED
  "0x445FE580eF8d70FF569aB36e80c647af338db351",
  "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
];

  const minProfit = "10000000000000000";

  await hre.run("verify:verify", {
    address: contractAddress,
    constructorArguments: [addressProvider, routers, minProfit],
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
