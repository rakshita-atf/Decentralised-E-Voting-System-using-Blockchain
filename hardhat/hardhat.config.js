require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

// Only use PRIVATE_KEY if it looks like a real 32-byte hex key (64 hex chars, optionally 0x-prefixed)
const rawKey = process.env.PRIVATE_KEY || "";
const validKey = /^(0x)?[0-9a-fA-F]{64}$/.test(rawKey.trim());
const accounts = validKey ? [rawKey.trim()] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "cancun"
    }
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts, // empty array if key not set — won't crash the node
    }
  }
};

