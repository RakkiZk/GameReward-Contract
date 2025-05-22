require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const { PRIVATE_KEY,INFURA_API } = process.env;

module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: {},
    arbitrum: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    ethereum: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    bnb: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    polygon: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    avalanche: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    base: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    optimism: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },

    //Testnet
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },

    bnb_testnet: {
      url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
      accounts: [`0x${PRIVATE_KEY}`]
    },

    base_testnet: {
      url: `https://base-sepolia.infura.io/v3/${INFURA_API}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
  }
};


