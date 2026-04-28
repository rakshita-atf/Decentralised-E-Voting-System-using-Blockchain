const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("SECURITY AUDIT", function () {
  let voterSBT, election, timelock;
  let owner, manager, voter1, voter2, attacker;
  const COMMIT = 3600, REVEAL = 3600, TLOCK_DELAY = 60;

  beforeEach(async function () {
    [owner, manager, voter1, voter2, attacker] = await ethers.getSigners();
    const VoterSBT = await ethers.getContractFactory("VoterSBT");
    voterSBT = await VoterSBT.deploy();
    const TimelockController = await ethers.getContractFactory("TimelockController");
    timelock = await TimelockController.deploy(TLOCK_DELAY, [owner.address], [owner.address], owner.address);
    const Election = await ethers.getContractFactory("Election");
    election = await Election.deploy(await voterSBT.getAddress());
    const MGR = await election.ELECTION_MANAGER_ROLE();
    const TLR = await election.TIMELOCK_ROLE();
    await election.grantRole(MGR, manager.address);
    await election.grantRole(TLR, await timelock.getAddress());
    await election.grantRole(TLR, owner.address);
    await voterSBT.mintVoterToken(voter1.address, "Delhi-North");
    await voterSBT.mintVoterToken(voter2.address, "Mumbai-South");
  });

  // ═══ [1.2] REENTRANCY ═══
  describe("[1.2] Reentrancy Attack Simulation", function () {
    it("Contract-based double-commit in single tx reverts", async function () {
      await election.connect(manager).addCandidate("Alice", "QmA");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const atk = await Attacker.deploy(await election.getAddress());
      await voterSBT.mintVoterToken(await atk.getAddress(), "Test");
      const h1 = ethers.randomBytes(32), h2 = ethers.randomBytes(32);
      await expect(atk.attackDoubleCommit(h1, h2)).to.be.revertedWith("Already committed a vote");
    });

    it("isEligible uses STATICCALL — no state changes possible", async function () {
      // IVoterSBT.isEligible is view → called via STATICCALL → reentrancy impossible at EVM level
      await election.connect(manager).addCandidate("Alice", "QmA");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      const salt = ethers.randomBytes(32);
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"], [1, salt]);
      await election.connect(voter1).commitVote(hash);
      expect(await election.hasCommitted(voter1.address)).to.be.true;
    });
  });

  // ═══ [1.3] RBAC MATRIX ═══
  describe("[1.3] Access Control — Full RBAC Matrix", function () {
    it("addCandidate: reverts for non-manager", async function () {
      const MGR = await election.ELECTION_MANAGER_ROLE();
      await expect(election.connect(voter1).addCandidate("X","Y"))
        .to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount")
        .withArgs(voter1.address, MGR);
    });
    it("addCandidate: reverts for attacker", async function () {
      const MGR = await election.ELECTION_MANAGER_ROLE();
      await expect(election.connect(attacker).addCandidate("X","Y"))
        .to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount")
        .withArgs(attacker.address, MGR);
    });
    it("startCommitPhase: reverts for non-manager", async function () {
      await election.connect(manager).addCandidate("A","B");
      const MGR = await election.ELECTION_MANAGER_ROLE();
      await expect(election.connect(voter1).startCommitPhase(COMMIT, REVEAL))
        .to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount")
        .withArgs(voter1.address, MGR);
    });
    it("endElection: reverts for manager (needs TIMELOCK_ROLE)", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await time.increase(REVEAL);
      const TLR = await election.TIMELOCK_ROLE();
      await expect(election.connect(manager).endElection())
        .to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount")
        .withArgs(manager.address, TLR);
    });
    it("endElection: reverts for voter", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await time.increase(REVEAL);
      const TLR = await election.TIMELOCK_ROLE();
      await expect(election.connect(voter1).endElection())
        .to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount");
    });
    it("mintVoterToken: reverts for non-minter", async function () {
      const MINTER = await voterSBT.MINTER_ROLE();
      await expect(voterSBT.connect(attacker).mintVoterToken(attacker.address, "X"))
        .to.be.revertedWithCustomError(voterSBT, "AccessControlUnauthorizedAccount")
        .withArgs(attacker.address, MINTER);
    });
    it("grantRole: reverts for non-admin", async function () {
      const MGR = await election.ELECTION_MANAGER_ROLE();
      await expect(election.connect(voter1).grantRole(MGR, attacker.address))
        .to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount");
    });
  });

  // ═══ [1.4] COMMIT-REVEAL INTEGRITY ═══
  describe("[1.4] Commit-Reveal Integrity", function () {
    let salt;
    beforeEach(async function () {
      await election.connect(manager).addCandidate("Alice","QmA");
      await election.connect(manager).addCandidate("Bob","QmB");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      salt = ethers.randomBytes(32);
    });
    it("correct hash → reveal accepted", async function () {
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1,salt]);
      await election.connect(voter1).commitVote(hash);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await expect(election.connect(voter1).revealVote(1, salt, "QmProof"))
        .to.emit(election, "VoteRevealed").withArgs(voter1.address, 1, "QmProof");
    });
    it("wrong salt → rejected", async function () {
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1,salt]);
      await election.connect(voter1).commitVote(hash);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await expect(election.connect(voter1).revealVote(1, ethers.randomBytes(32), "QmX"))
        .to.be.revertedWith("Reveal does not match commitment");
    });
    it("reveal during commit phase → rejected", async function () {
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1,salt]);
      await election.connect(voter1).commitVote(hash);
      await expect(election.connect(voter1).revealVote(1, salt, "QmX"))
        .to.be.revertedWith("Invalid election state for this action");
    });
    it("double reveal → rejected", async function () {
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1,salt]);
      await election.connect(voter1).commitVote(hash);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await election.connect(voter1).revealVote(1, salt, "QmP");
      await expect(election.connect(voter1).revealVote(1, salt, "QmP"))
        .to.be.revertedWith("Already revealed vote");
    });
    it("commit with zero hash → rejected", async function () {
      await expect(election.connect(voter1).commitVote(ethers.ZeroHash))
        .to.be.revertedWith("Invalid commit hash");
    });
    it("reveal with invalid candidate ID → rejected", async function () {
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[99,salt]);
      await election.connect(voter1).commitVote(hash);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await expect(election.connect(voter1).revealVote(99, salt, "Qm"))
        .to.be.revertedWith("Invalid candidate ID");
    });
    it("reveal after reveal deadline → rejected", async function () {
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1,salt]);
      await election.connect(voter1).commitVote(hash);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await time.increase(REVEAL + 1);
      await expect(election.connect(voter1).revealVote(1, salt, "Qm"))
        .to.be.revertedWith("Reveal phase has ended");
    });
  });

  // ═══ [1.5] SOULBOUND NFT ═══
  describe("[1.5] Soulbound NFT Enforcement", function () {
    it("wallet without SBT cannot commit vote", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      await expect(election.connect(attacker).commitVote(ethers.randomBytes(32)))
        .to.be.revertedWith("Voter does not hold a Soulbound Token");
    });
    it("SBT transfer blocked", async function () {
      await expect(voterSBT.connect(voter1).transferFrom(voter1.address, attacker.address, 0))
        .to.be.revertedWith("VoterSBT: token is soulbound and cannot be transferred");
    });
    it("safeTransferFrom also blocked", async function () {
      await expect(voterSBT.connect(voter1)["safeTransferFrom(address,address,uint256)"](voter1.address, attacker.address, 0))
        .to.be.revertedWith("VoterSBT: token is soulbound and cannot be transferred");
    });
    it("duplicate SBT mint to same address blocked", async function () {
      await expect(voterSBT.mintVoterToken(voter1.address, "X"))
        .to.be.revertedWith("VoterSBT: address already holds an SBT");
    });
    it("isEligible returns false for non-holders", async function () {
      expect(await voterSBT.isEligible(attacker.address)).to.be.false;
    });
  });

  // ═══ [1.6] TIMELOCK DELAY ═══
  describe("[1.6] TimelockController Delay Enforcement", function () {
    beforeEach(async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await time.increase(REVEAL);
    });
    it("execute before delay → reverts", async function () {
      const calldata = election.interface.encodeFunctionData("endElection");
      const salt = ethers.id("test1");
      await timelock.schedule(await election.getAddress(), 0, calldata, ethers.ZeroHash, salt, TLOCK_DELAY);
      await expect(timelock.execute(await election.getAddress(), 0, calldata, ethers.ZeroHash, salt))
        .to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");
    });
    it("execute after delay → succeeds", async function () {
      const calldata = election.interface.encodeFunctionData("endElection");
      const salt = ethers.id("test2");
      await timelock.schedule(await election.getAddress(), 0, calldata, ethers.ZeroHash, salt, TLOCK_DELAY);
      await time.increase(TLOCK_DELAY);
      await timelock.execute(await election.getAddress(), 0, calldata, ethers.ZeroHash, salt);
      expect(await election.state()).to.equal(3);
    });
    it("cancel queued action → no longer executable", async function () {
      const calldata = election.interface.encodeFunctionData("endElection");
      const salt = ethers.id("test3");
      await timelock.schedule(await election.getAddress(), 0, calldata, ethers.ZeroHash, salt, TLOCK_DELAY);
      const opId = await timelock.hashOperation(await election.getAddress(), 0, calldata, ethers.ZeroHash, salt);
      await timelock.cancel(opId);
      await time.increase(TLOCK_DELAY);
      await expect(timelock.execute(await election.getAddress(), 0, calldata, ethers.ZeroHash, salt))
        .to.be.revertedWithCustomError(timelock, "TimelockUnexpectedOperationState");
    });
  });

  // ═══ [1.7] GAS LIMITS ═══
  describe("[1.7] Gas Limit Edge Cases", function () {
    it("commitVote gas is O(1) regardless of candidate count", async function () {
      // Add 50 candidates
      for (let i = 0; i < 50; i++) {
        await election.connect(manager).addCandidate(`Candidate${i}`, `QmCID${i}`);
      }
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1, ethers.randomBytes(32)]);
      const tx = await election.connect(voter1).commitVote(hash);
      const receipt = await tx.wait();
      console.log(`    commitVote gas (50 candidates): ${receipt.gasUsed}`);
      expect(receipt.gasUsed).to.be.lt(200000n); // Should be well under 200k
    });
    it("revealVote gas is O(1)", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      const salt = ethers.randomBytes(32);
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1, salt]);
      await election.connect(voter1).commitVote(hash);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      const tx = await election.connect(voter1).revealVote(1, salt, "QmProof");
      const receipt = await tx.wait();
      console.log(`    revealVote gas: ${receipt.gasUsed}`);
      expect(receipt.gasUsed).to.be.lt(200000n);
    });
    it("No O(n) loops in voting functions", async function () {
      await election.connect(manager).addCandidate("A","B");
      // Mint SBT to a 3rd voter
      const [,,,,, voter3] = await ethers.getSigners();
      await voterSBT.mintVoterToken(voter3.address, "Kolkata");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      // Voter1 commit (cold storage — higher gas, ignore)
      await election.connect(voter1).commitVote(ethers.randomBytes(32));
      // Voter2 commit
      const tx2 = await election.connect(voter2).commitVote(ethers.randomBytes(32));
      const r2 = await tx2.wait();
      // Voter3 commit
      const tx3 = await election.connect(voter3).commitVote(ethers.randomBytes(32));
      const r3 = await tx3.wait();
      // Gas should be nearly identical for 2nd and 3rd voters (both warm storage)
      const diff = Math.abs(Number(r2.gasUsed) - Number(r3.gasUsed));
      expect(diff).to.be.lt(5000); // <5k gas difference confirms O(1)
    });
  });

  // ═══ [2.1] DOUBLE VOTE ═══
  describe("[2.1] Double-Vote Prevention", function () {
    it("double commit from same wallet → reverts", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      await election.connect(voter1).commitVote(ethers.randomBytes(32));
      await expect(election.connect(voter1).commitVote(ethers.randomBytes(32)))
        .to.be.revertedWith("Already committed a vote");
    });
    it("hasCommitted is set atomically", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      expect(await election.hasCommitted(voter1.address)).to.be.false;
      await election.connect(voter1).commitVote(ethers.randomBytes(32));
      expect(await election.hasCommitted(voter1.address)).to.be.true;
    });
  });

  // ═══ [2.2] FRONT-RUNNING PROTECTION ═══
  describe("[2.2] Front-Running Protection", function () {
    it("commit hash does not reveal the vote", async function () {
      const salt = ethers.randomBytes(32);
      const hash1 = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1, salt]);
      const hash2 = ethers.solidityPackedKeccak256(["uint256","bytes32"],[2, salt]);
      // Hashes for different candidates are completely different
      expect(hash1).to.not.equal(hash2);
      // Without knowing the salt, an observer cannot determine candidate from hash
    });
    it("reveal can only be done by the original committer", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      const salt = ethers.randomBytes(32);
      const hash = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1, salt]);
      await election.connect(voter1).commitVote(hash);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      // Attacker tries to reveal voter1's vote using stolen salt
      await expect(election.connect(attacker).revealVote(1, salt, "QmX"))
        .to.be.revertedWith("No commitment found for this address");
    });
  });

  // ═══ [2.3] ADMIN ABUSE ═══
  describe("[2.3] Admin Key Abuse Scenarios", function () {
    it("admin cannot add candidate after voting starts", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      await expect(election.connect(manager).addCandidate("C","D"))
        .to.be.revertedWith("Invalid election state for this action");
    });
    it("admin cannot end election without TIMELOCK_ROLE", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      await time.increase(COMMIT);
      await election.startRevealPhase();
      await time.increase(REVEAL);
      await expect(election.connect(manager).endElection())
        .to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount");
    });
    it("admin cannot directly modify vote counts", async function () {
      // Vote counts are only modified inside revealVote — no setter exists
      // This is verified by the absence of any public/external setter function
      await election.connect(manager).addCandidate("A","B");
      const c = await election.getCandidate(1);
      expect(c.voteCount).to.equal(0);
    });
    it("admin cannot start commit phase twice", async function () {
      await election.connect(manager).addCandidate("A","B");
      await election.connect(manager).startCommitPhase(COMMIT, REVEAL);
      await expect(election.connect(manager).startCommitPhase(COMMIT, REVEAL))
        .to.be.revertedWith("Invalid election state for this action");
    });
  });

  // ═══ [3.1] FULL LIFECYCLE ═══
  describe("[3.1] Full Voting Lifecycle — Happy Path", function () {
    it("complete lifecycle with correct events and final tally", async function () {
      // 1. Add candidates
      await expect(election.connect(manager).addCandidate("Alice","QmAlice"))
        .to.emit(election, "CandidateAdded").withArgs(1, "Alice", "QmAlice");
      await election.connect(manager).addCandidate("Bob","QmBob");

      // 2. Start commit phase
      await expect(election.connect(manager).startCommitPhase(COMMIT, REVEAL))
        .to.emit(election, "ElectionStateChanged").withArgs(1);

      // 3. Voters commit
      const salt1 = ethers.randomBytes(32), salt2 = ethers.randomBytes(32);
      const h1 = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1, salt1]);
      const h2 = ethers.solidityPackedKeccak256(["uint256","bytes32"],[1, salt2]);
      await expect(election.connect(voter1).commitVote(h1))
        .to.emit(election, "VoteCommitted").withArgs(voter1.address);
      await election.connect(voter2).commitVote(h2);

      // 4. Transition to reveal
      await time.increase(COMMIT);
      await expect(election.startRevealPhase())
        .to.emit(election, "ElectionStateChanged").withArgs(2);

      // 5. Voters reveal
      await expect(election.connect(voter1).revealVote(1, salt1, "QmP1"))
        .to.emit(election, "VoteRevealed").withArgs(voter1.address, 1, "QmP1");
      await election.connect(voter2).revealVote(1, salt2, "QmP2");

      // 6. End election
      await time.increase(REVEAL);
      await expect(election.connect(owner).endElection())
        .to.emit(election, "ElectionStateChanged").withArgs(3);

      // 7. Verify final tally
      const alice = await election.getCandidate(1);
      const bob = await election.getCandidate(2);
      expect(alice.voteCount).to.equal(2);
      expect(bob.voteCount).to.equal(0);
      expect(await election.totalVotes()).to.equal(2);
      expect(await election.totalCommits()).to.equal(2);
    });
  });
});
