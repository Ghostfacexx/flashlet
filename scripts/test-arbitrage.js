const hre = require("hardhat");
const { ethers } = hre;

require("dotenv").config();

async function main() {
  const contractAddress = "0xBc7f2e54FbB33F25E10b5a10d2FF6F030d3B9AeA"; // your deployed contract
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider);

  const contract = await ethers.getContractAt(
    "MultiPairFlashArbitrage",
    contractAddress,
    signer
  );

  // Example tokens and routers (USDC-WBTC using Sushi and QuickSwap on Polygon)
  const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
  const WBTC = "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6";
  const sushiRouter = "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506";
  const quickRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

  console.log("🧪 Simulating flash arbitrage...");

  try {
    await contract.callStatic.executeFlashArbitrage(
      USDC,
      WBTC,
      sushiRouter,
      quickRouter
    );
    console.log("✅ Simulation passed! Trade may be profitable.");

    // OPTIONAL: send actual tx
    // console.log("🚀 Sending real tx...");
    // const tx = await contract.executeFlashArbitrage(
    //   USDC,
    //   WBTC,
    //   sushiRouter,
    //   quickRouter,
    //   { gasLimit: 3000000 }
    // );
    // console.log("📨 TX Hash:", tx.hash);
    // await tx.wait();
    // console.log("✅ Transaction confirmed.");

  } catch (err) {
    const reason = err?.error?.message || err.reason || err.message;
    console.error("❌ Simulation failed:");
    console.error(reason);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
