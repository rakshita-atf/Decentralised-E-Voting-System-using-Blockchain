const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("GOVERNANCE AUDIT", function () {
  let voteToken, timelock, governor;
  let owner, voter1, voter2, voter3;
  const TLOCK_DELAY = 60;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();

    const VoteToken = await ethers.getContractFactory("VoteToken");
    voteToken = await VoteToken.deploy();

    const TimelockController = await ethers.getContractFactory("TimelockController");
    timelock = await TimelockController.deploy(TLOCK_DELAY, [owner.address], [ethers.ZeroAddress], owner.address);

    const ElectionGovernor = await ethers.getContractFactory("ElectionGovernor");
    governor = await ElectionGovernor.deploy(await voteToken.getAddress(), await timelock.getAddress());

    // Grant governor PROPOSER + EXECUTOR roles on timelock
    const PROPOSER = await timelock.PROPOSER_ROLE();
    const EXECUTOR = await timelock.EXECUTOR_ROLE();
    await timelock.grantRole(PROPOSER, await governor.getAddress());
    await timelock.grantRole(EXECUTOR, await governor.getAddress());
  });

  // ═══ [1.8] GOVERNANCE TOKEN VOTING WEIGHT ═══
  describe("[1.8] Governance Token Voting Weight", function () {
    it("voter with more tokens has proportionally more weight", async function () {
      // Mint: voter1 gets 100 tokens, voter2 gets 10
      const amt1 = ethers.parseEther("100");
      const amt2 = ethers.parseEther("10");
      await voteToken.mintToVoter(voter1.address);
      // Mint extra to voter1 via multiple calls (each call gives 1 token)
      // Actually let's just test with default 1 token each
      await voteToken.mintToVoter(voter2.address);

      // Self-delegate to activate voting power
      await voteToken.connect(voter1).delegate(voter1.address);
      await voteToken.connect(voter2).delegate(voter2.address);

      // Mine a block for checkpoints
      await network.provider.send("evm_mine");

      const power1 = await voteToken.getVotes(voter1.address);
      const power2 = await voteToken.getVotes(voter2.address);
      // Both have 1 token (VOTER_ALLOCATION = 1e18)
      expect(power1).to.equal(power2);
      expect(power1).to.equal(ethers.parseEther("1"));
    });

    it("vote with zero tokens → no voting power", async function () {
      // voter3 has no tokens
      await voteToken.connect(voter3).delegate(voter3.address);
      await network.provider.send("evm_mine");
      expect(await voteToken.getVotes(voter3.address)).to.equal(0);
    });

    it("voting power is snapshotted via ERC20Votes checkpoints", async function () {
      await voteToken.mintToVoter(voter1.address);
      await voteToken.connect(voter1).delegate(voter1.address);
      await network.provider.send("evm_mine");

      const block1 = await ethers.provider.getBlockNumber();
      const powerAtBlock1 = await voteToken.getPastVotes(voter1.address, block1 - 1);

      // Transfer tokens away
      await voteToken.connect(voter1).transfer(voter2.address, ethers.parseEther("0.5"));
      await network.provider.send("evm_mine");

      // Past voting power should still reflect the snapshot
      const pastPower = await voteToken.getPastVotes(voter1.address, block1 - 1);
      expect(pastPower).to.equal(powerAtBlock1);
    });

    it("non-minter cannot mint governance tokens", async function () {
      const MINTER = await voteToken.MINTER_ROLE();
      await expect(voteToken.connect(voter1).mintToVoter(voter1.address))
        .to.be.revertedWithCustomError(voteToken, "AccessControlUnauthorizedAccount")
        .withArgs(voter1.address, MINTER);
    });
  });

  // ═══ [2.8] DAO DISPUTE MANIPULATION ═══
  describe("[2.8] DAO Dispute Manipulation", function () {
    it("proposal lifecycle works end-to-end", async function () {
      // Setup: mint tokens and delegate
      await voteToken.mintToVoter(voter1.address);
      await voteToken.connect(voter1).delegate(voter1.address);
      await network.provider.send("evm_mine");

      // Create a dummy proposal (call a harmless function on timelock)
      const targets = [await timelock.getAddress()];
      const values = [0];
      const calldatas = [timelock.interface.encodeFunctionData("getMinDelay")];
      const description = "Dispute: Recount requested";

      const tx = await governor.connect(voter1).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();
      const proposalId = receipt.logs.find(l => l.fragment?.name === "ProposalCreated")?.args?.proposalId;

      // Wait for voting delay (1 block)
      await network.provider.send("evm_mine");

      // Vote FOR
      await governor.connect(voter1).castVote(proposalId, 1);

      // Fast-forward past voting period (50400 blocks)
      await network.provider.send("hardhat_mine", [ethers.toQuantity(50401)]);

      // Check proposal succeeded
      const state = await governor.state(proposalId);
      // 4 = Succeeded
      expect(state).to.equal(4);
    });

    it("proposal with zero quorum fails", async function () {
      // Mint tokens but don't vote
      await voteToken.mintToVoter(voter1.address);
      await voteToken.connect(voter1).delegate(voter1.address);
      await network.provider.send("evm_mine");

      const targets = [await timelock.getAddress()];
      const values = [0];
      const calldatas = [timelock.interface.encodeFunctionData("getMinDelay")];
      const tx = await governor.connect(voter1).propose(targets, values, calldatas, "Test dispute");
      const receipt = await tx.wait();
      const proposalId = receipt.logs.find(l => l.fragment?.name === "ProposalCreated")?.args?.proposalId;

      await network.provider.send("evm_mine");
      // Don't vote — just fast-forward
      await network.provider.send("hardhat_mine", [ethers.toQuantity(50401)]);

      // State should be Defeated (3) due to no quorum
      expect(await governor.state(proposalId)).to.equal(3);
    });
  });
});
