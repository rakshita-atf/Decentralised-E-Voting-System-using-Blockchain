const { ethers, network } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("══════════════════════════════════════════════");
    console.log("  Deploying E-Voting System Contracts");
    console.log("══════════════════════════════════════════════");
    console.log("Deployer address:", deployer.address);
    console.log("");

    // ─────────────────────────────────────────────
    // 1. Deploy VoterSBT
    // ─────────────────────────────────────────────
    console.log("[1/4] Deploying VoterSBT...");
    const VoterSBT = await ethers.getContractFactory("VoterSBT");
    const voterSBT = await VoterSBT.deploy();
    await voterSBT.waitForDeployment();
    const sbtAddress = await voterSBT.getAddress();
    console.log("  ✓ VoterSBT deployed to:", sbtAddress);

    // ─────────────────────────────────────────────
    // 2. Deploy TimelockController
    // ─────────────────────────────────────────────
    console.log("[2/4] Deploying TimelockController...");
    const MIN_DELAY = 60; // 60 seconds for local/testnet; use 86400 (24h) for mainnet
    const proposers = [deployer.address];
    const executors = [deployer.address];
    const admin = deployer.address;

    const TimelockController = await ethers.getContractFactory("TimelockController");
    const timelock = await TimelockController.deploy(MIN_DELAY, proposers, executors, admin);
    await timelock.waitForDeployment();
    const timelockAddress = await timelock.getAddress();
    console.log("  ✓ TimelockController deployed to:", timelockAddress);
    console.log("    Min delay:", MIN_DELAY, "seconds");

    // ─────────────────────────────────────────────
    // 3. Deploy Election
    // ─────────────────────────────────────────────
    console.log("[3/4] Deploying Election...");
    const Election = await ethers.getContractFactory("Election");
    const election = await Election.deploy(sbtAddress);
    await election.waitForDeployment();
    const electionAddress = await election.getAddress();
    console.log("  ✓ Election deployed to:", electionAddress);

    // ─────────────────────────────────────────────
    // 4. Configure Roles
    // ─────────────────────────────────────────────
    console.log("[4/4] Configuring roles...");

    // Grant TIMELOCK_ROLE on Election to the TimelockController
    const TIMELOCK_ROLE = await election.TIMELOCK_ROLE();
    await election.grantRole(TIMELOCK_ROLE, timelockAddress);
    console.log("  ✓ Granted TIMELOCK_ROLE to TimelockController");

    // Only grant TIMELOCK_ROLE to deployer on local dev networks
    const isLocal = network.name === "localhost" || network.name === "hardhat";
    if (isLocal) {
        await election.grantRole(TIMELOCK_ROLE, deployer.address);
        console.log("  ✓ Granted TIMELOCK_ROLE to deployer (LOCAL TESTING ONLY)");
    } else {
        console.log("  ⚠ Skipped direct TIMELOCK_ROLE grant (production mode)");
    }

    // ─────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────
    console.log("");
    console.log("══════════════════════════════════════════════");
    console.log("  Deployment Complete!");
    console.log("══════════════════════════════════════════════");
    console.log("");
    console.log("  VoterSBT:           ", sbtAddress);
    console.log("  TimelockController: ", timelockAddress);
    console.log("  Election:           ", electionAddress);
    console.log("");
    console.log("  Copy these addresses to frontend/.env.local:");
    console.log(`  NEXT_PUBLIC_VOTER_SBT_ADDRESS="${sbtAddress}"`);
    console.log(`  NEXT_PUBLIC_TIMELOCK_ADDRESS="${timelockAddress}"`);
    console.log(`  NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS="${electionAddress}"`);
    console.log("");

    return { sbtAddress, timelockAddress, electionAddress };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
