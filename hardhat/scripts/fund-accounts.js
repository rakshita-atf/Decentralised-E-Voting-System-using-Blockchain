const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Sending ETH from deployer:", deployer.address);

  const targets = [
    "0x831b716B43cf192228Bd11E15d9726a64189AC0c",
    "0x13245C70D592915C9d3d34F7e83a264Cf7e6A237",
  ];

  for (const addr of targets) {
    const balance = await ethers.provider.getBalance(addr);
    const balEth = ethers.formatEther(balance);
    console.log(`\n${addr}  →  current balance: ${balEth} ETH`);

    if (parseFloat(balEth) < 10) {
      const tx = await deployer.sendTransaction({
        to: addr,
        value: ethers.parseEther("100"),
      });
      await tx.wait();
      console.log("  ✓ Sent 100 ETH");
    } else {
      console.log("  ✓ Already funded, skipping");
    }
  }

  console.log("\n✅ Funding complete. Refresh MetaMask to see updated balances.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
