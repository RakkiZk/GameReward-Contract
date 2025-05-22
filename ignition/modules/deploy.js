// scripts/deploy.js

const { ethers } = require("hardhat");

async function main() {
  // Get the contract to deploy
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy the MockToken contract
  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy();
  await mockToken.waitForDeployment();
  console.log("MockToken deployed to:", mockToken.target);

  // Game Reward contract
  const contract = await ethers.getContractFactory("GameReward");
  const GameReward = await contract.deploy(mockToken.target, 1);
  await GameReward.waitForDeployment();
  console.log("GameReward deployed to:", GameReward.target);

}

// Run the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
