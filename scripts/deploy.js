const hre = require("hardhat");

async function main() {
  const MyNFT = await hre.ethers.getContractFactory("MyNFT");
  const nft = await MyNFT.deploy();
  await nft.waitForDeployment();
  console.log("MyNFT deployed to:", await nft.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
