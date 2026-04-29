const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ── Addresses to grant all admin roles to ─────────────────
const TARGETS = [
  "0x831b716B43cf192228Bd11E15d9726a64189AC0c", // Account 1
  "0x13245C70D592915C9d3d34F7e83a264Cf7e6A237", // Account 2
];
// ──────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer (role granter):", deployer.address);
  console.log("Granting roles to:", TARGETS);
  console.log("");

  // Load addresses from frontend env
  const envPath = path.resolve(__dirname, "../../frontend/.env.local");
  const envContent = fs.readFileSync(envPath, "utf8");

  const electionMatch = envContent.match(/NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS="([^"]+)"/);
  const sbtMatch      = envContent.match(/NEXT_PUBLIC_VOTER_SBT_ADDRESS="([^"]+)"/);

  if (!electionMatch || !sbtMatch) {
    throw new Error("Could not read contract addresses from frontend/.env.local");
  }

  const ELECTION_ADDRESS = electionMatch[1];
  const SBT_ADDRESS      = sbtMatch[1];
  console.log("Election contract:", ELECTION_ADDRESS);
  console.log("VoterSBT contract:", SBT_ADDRESS);
  console.log("");

  // Attach contracts with deployer signer
  const Election = await ethers.getContractAt("Election", ELECTION_ADDRESS, deployer);
  const VoterSBT = await ethers.getContractAt("VoterSBT", SBT_ADDRESS, deployer);

  // Fetch role IDs once
  const DEFAULT_ADMIN_ROLE    = await Election.DEFAULT_ADMIN_ROLE();
  const ELECTION_MANAGER_ROLE = await Election.ELECTION_MANAGER_ROLE();
  const TIMELOCK_ROLE         = await Election.TIMELOCK_ROLE();
  const MINTER_ROLE           = await VoterSBT.MINTER_ROLE();
  const SBT_ADMIN             = await VoterSBT.DEFAULT_ADMIN_ROLE();

  // Grant to every target
  for (const TARGET of TARGETS) {
    console.log(`\n── Granting roles to ${TARGET} ──`);

    const tx1 = await Election.grantRole(DEFAULT_ADMIN_ROLE, TARGET);    await tx1.wait();
    const tx2 = await Election.grantRole(ELECTION_MANAGER_ROLE, TARGET); await tx2.wait();
    const tx3 = await Election.grantRole(TIMELOCK_ROLE, TARGET);         await tx3.wait();
    const tx4 = await VoterSBT.grantRole(MINTER_ROLE, TARGET);           await tx4.wait();
    const tx5 = await VoterSBT.grantRole(SBT_ADMIN, TARGET);             await tx5.wait();

    console.log("  ✓ DEFAULT_ADMIN_ROLE    (Election)");
    console.log("  ✓ ELECTION_MANAGER_ROLE (Election)");
    console.log("  ✓ TIMELOCK_ROLE         (Election)");
    console.log("  ✓ MINTER_ROLE           (VoterSBT)");
    console.log("  ✓ DEFAULT_ADMIN_ROLE    (VoterSBT)");
  }

  console.log("\n✅ All roles granted. Refresh the admin dashboard.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
