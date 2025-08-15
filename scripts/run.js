async function main() {
  console.log("Ready to deploy or run arbitrage logic.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
