// scripts/cancelTx.js
require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🧾 Using deployer:", deployer.address);

  const nonce = await deployer.getTransactionCount("pending");
  console.log("📌 Current pending nonce:", nonce);

  const gasPrice = await ethers.provider.getGasPrice();
  const bumpedGasPrice = gasPrice.mul(2); // double the gas to ensure overwrite
  console.log("⚡ Using bumped gas price:", bumpedGasPrice.toString());

  const tx = await deployer.sendTransaction({
    to: deployer.address,
    value: 0,
    nonce: nonce,
    gasLimit: 21000,
    gasPrice: bumpedGasPrice
  });

  console.log("⏳ Cancel transaction sent:", tx.hash);
  await tx.wait();
  console.log("✅ Cancelled pending transaction.");
}

main().catch((error) => {
  console.error("❌ Error cancelling transaction:", error);
  process.exit(1);
});
