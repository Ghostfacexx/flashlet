// scripts/deploy.js
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 Deploying contract with:", deployer.address);

  const Arbitrage = await hre.ethers.getContractFactory("MultiPairFlashArbitrage");
  console.log("✅ Got contract factory");

  const addressProvider = process.env.AAVE_ADDRESS_PROVIDER;
  const routers = process.env.ROUTERS.split(",");
  const minProfit = hre.ethers.utils.parseUnits("0.01", 18); // 0.01 token

  console.log("📦 Deployment parameters:");
  console.log("• AAVE_ADDRESS_PROVIDER:", addressProvider);
  console.log("• Routers:", routers);
  console.log("• MinProfit:", minProfit.toString());

  const gasPrice = await hre.ethers.provider.getGasPrice();
  const override = {
    gasLimit: 6000000,
    gasPrice: gasPrice.mul(2) // double current base gas price for speed
  };

  console.log("⛽ Gas override:", {
    gasPrice: override.gasPrice.toString(),
    gasLimit: override.gasLimit
  });

  const contract = await Arbitrage.deploy(addressProvider, routers, minProfit, { gasLimit: 6000000, gasPrice: gasPrice.mul(2) });
  console.log("⏳ Deployment tx sent. Waiting for confirmation...");
  
  const tx = contract.deployTransaction;
  console.log("📨 Tx Hash:", tx.hash);


  await contract.deployed();
  console.log("✅ Contract deployed at:", contract.address);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
