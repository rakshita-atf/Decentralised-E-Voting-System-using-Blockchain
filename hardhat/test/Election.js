const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("E-Voting System", function () {
  let voterSBT, election, timelock;
  let owner, manager, voter1, voter2, outsider;

  // Durations for commit/reveal phases (in seconds)
  const COMMIT_DURATION = 3600; // 1 hour
  const REVEAL_DURATION = 3600; // 1 hour
  const TIMELOCK_DELAY = 60;    // 60 seconds

  beforeEach(async function () {
    [owner, manager, voter1, voter2, outsider] = await ethers.getSigners();

    // Deploy VoterSBT
    const VoterSBT = await ethers.getContractFactory("VoterSBT");
    voterSBT = await VoterSBT.deploy();
    await voterSBT.waitForDeployment();

    // Deploy TimelockController
    const TimelockController = await ethers.getContractFactory("TimelockController");
    timelock = await TimelockController.deploy(
      TIMELOCK_DELAY,
      [owner.address],   // proposers
      [owner.address],   // executors
      owner.address      // admin
    );
    await timelock.waitForDeployment();

    // Deploy Election
    const Election = await ethers.getContractFactory("Election");
    election = await Election.deploy(await voterSBT.getAddress());
    await election.waitForDeployment();

    // Grant roles
    const MANAGER_ROLE = await election.ELECTION_MANAGER_ROLE();
    await election.grantRole(MANAGER_ROLE, manager.address);

    const TIMELOCK_ROLE = await election.TIMELOCK_ROLE();
    await election.grantRole(TIMELOCK_ROLE, await timelock.getAddress());
    // Also grant to owner for direct testing of endElection
    await election.grantRole(TIMELOCK_ROLE, owner.address);

    // Mint SBTs to voters
    await voterSBT.mintVoterToken(voter1.address, "Delhi-North");
    await voterSBT.mintVoterToken(voter2.address, "Mumbai-South");
  });

  // ═══════════════════════════════════════════════
  //  VoterSBT Tests
  // ═══════════════════════════════════════════════

  describe("VoterSBT", function () {
    it("Should mint an SBT to a voter", async function () {
      expect(await voterSBT.isEligible(voter1.address)).to.be.true;
      expect(await voterSBT.hasSBT(voter1.address)).to.be.true;
      expect(await voterSBT.voterConstituency(voter1.address)).to.equal("Delhi-North");
      expect(await voterSBT.totalVoters()).to.equal(2);
    });

    it("Should NOT allow minting twice to the same address", async function () {
      await expect(
        voterSBT.mintVoterToken(voter1.address, "Delhi-South")
      ).to.be.revertedWith("VoterSBT: address already holds an SBT");
    });

    it("Should NOT allow transferring the SBT", async function () {
      await expect(
        voterSBT.connect(voter1).transferFrom(voter1.address, outsider.address, 0)
      ).to.be.revertedWith("VoterSBT: token is soulbound and cannot be transferred");
    });

    it("Should NOT allow non-minters to mint", async function () {
      const MINTER_ROLE = await voterSBT.MINTER_ROLE();
      await expect(
        voterSBT.connect(outsider).mintVoterToken(outsider.address, "Kolkata")
      ).to.be.revertedWithCustomError(voterSBT, "AccessControlUnauthorizedAccount")
       .withArgs(outsider.address, MINTER_ROLE);
    });

    it("Should report non-holders as ineligible", async function () {
      expect(await voterSBT.isEligible(outsider.address)).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════
  //  Election — Setup & Candidate Management
  // ═══════════════════════════════════════════════

  describe("Election Setup", function () {
    it("Should start in NotStarted state", async function () {
      expect(await election.state()).to.equal(0); // NotStarted
    });

    it("Should allow manager to add candidates", async function () {
      await expect(election.connect(manager).addCandidate("Alice", "QmAliceCID"))
        .to.emit(election, "CandidateAdded")
        .withArgs(1, "Alice", "QmAliceCID");
      expect(await election.candidatesCount()).to.equal(1);
    });

    it("Should NOT allow non-managers to add candidates", async function () {
      const MANAGER_ROLE = await election.ELECTION_MANAGER_ROLE();
      await expect(
        election.connect(voter1).addCandidate("Bob", "QmBobCID")
      ).to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount")
       .withArgs(voter1.address, MANAGER_ROLE);
    });

    it("Should NOT start without candidates", async function () {
      await expect(
        election.connect(manager).startCommitPhase(COMMIT_DURATION, REVEAL_DURATION)
      ).to.be.revertedWith("Must have at least one candidate");
    });

    it("Should fetch candidate details", async function () {
      await election.connect(manager).addCandidate("Alice", "QmAliceCID");
      const candidate = await election.getCandidate(1);
      expect(candidate.name).to.equal("Alice");
      expect(candidate.imageCID).to.equal("QmAliceCID");
      expect(candidate.voteCount).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════
  //  Election — Full Commit-Reveal Flow
  // ═══════════════════════════════════════════════

  describe("Commit-Reveal Voting", function () {
    let salt1, salt2, commitHash1, commitHash2;

    beforeEach(async function () {
      // Setup candidates
      await election.connect(manager).addCandidate("Alice", "QmAliceCID");
      await election.connect(manager).addCandidate("Bob", "QmBobCID");

      // Generate salts
      salt1 = ethers.randomBytes(32);
      salt2 = ethers.randomBytes(32);

      // voter1 votes for candidate 1 (Alice)
      commitHash1 = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32"],
        [1, salt1]
      );

      // voter2 votes for candidate 2 (Bob)
      commitHash2 = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32"],
        [2, salt2]
      );

      // Start commit phase
      await election.connect(manager).startCommitPhase(COMMIT_DURATION, REVEAL_DURATION);
    });

    it("Should allow SBT holders to commit votes", async function () {
      await expect(election.connect(voter1).commitVote(commitHash1))
        .to.emit(election, "VoteCommitted")
        .withArgs(voter1.address);
      expect(await election.hasCommitted(voter1.address)).to.be.true;
      expect(await election.totalCommits()).to.equal(1);
    });

    it("Should NOT allow non-SBT holders to commit", async function () {
      const fakeHash = ethers.randomBytes(32);
      await expect(
        election.connect(outsider).commitVote(fakeHash)
      ).to.be.revertedWith("Voter does not hold a Soulbound Token");
    });

    it("Should NOT allow double commit", async function () {
      await election.connect(voter1).commitVote(commitHash1);
      await expect(
        election.connect(voter1).commitVote(commitHash1)
      ).to.be.revertedWith("Already committed a vote");
    });

    it("Should NOT allow committing after deadline", async function () {
      await time.increase(COMMIT_DURATION + 1);
      await expect(
        election.connect(voter1).commitVote(commitHash1)
      ).to.be.revertedWith("Commit phase has ended");
    });

    it("Should allow transition to reveal phase after commit deadline", async function () {
      await time.increase(COMMIT_DURATION);
      await expect(election.startRevealPhase())
        .to.emit(election, "ElectionStateChanged")
        .withArgs(2); // RevealPhase
    });

    it("Should NOT allow early transition to reveal phase", async function () {
      await expect(election.startRevealPhase())
        .to.be.revertedWith("Commit phase not yet ended");
    });

    it("Should allow correct reveal and tally votes", async function () {
      // Commit
      await election.connect(voter1).commitVote(commitHash1);
      await election.connect(voter2).commitVote(commitHash2);

      // Move to reveal phase
      await time.increase(COMMIT_DURATION);
      await election.startRevealPhase();

      // Reveal
      await expect(
        election.connect(voter1).revealVote(1, salt1, "QmBallotProof1")
      ).to.emit(election, "VoteRevealed")
       .withArgs(voter1.address, 1, "QmBallotProof1");

      await election.connect(voter2).revealVote(2, salt2, "QmBallotProof2");

      // Verify tallies
      const alice = await election.getCandidate(1);
      const bob = await election.getCandidate(2);
      expect(alice.voteCount).to.equal(1);
      expect(bob.voteCount).to.equal(1);
      expect(await election.totalVotes()).to.equal(2);
    });

    it("Should REJECT incorrect reveal (wrong salt)", async function () {
      await election.connect(voter1).commitVote(commitHash1);
      await time.increase(COMMIT_DURATION);
      await election.startRevealPhase();

      const wrongSalt = ethers.randomBytes(32);
      await expect(
        election.connect(voter1).revealVote(1, wrongSalt, "QmFake")
      ).to.be.revertedWith("Reveal does not match commitment");
    });

    it("Should REJECT incorrect reveal (wrong candidate)", async function () {
      await election.connect(voter1).commitVote(commitHash1);
      await time.increase(COMMIT_DURATION);
      await election.startRevealPhase();

      // voter1 committed for candidate 1 but tries to reveal candidate 2
      await expect(
        election.connect(voter1).revealVote(2, salt1, "QmFake")
      ).to.be.revertedWith("Reveal does not match commitment");
    });

    it("Should NOT allow double reveal", async function () {
      await election.connect(voter1).commitVote(commitHash1);
      await time.increase(COMMIT_DURATION);
      await election.startRevealPhase();

      await election.connect(voter1).revealVote(1, salt1, "QmProof");
      await expect(
        election.connect(voter1).revealVote(1, salt1, "QmProof")
      ).to.be.revertedWith("Already revealed vote");
    });
  });

  // ═══════════════════════════════════════════════
  //  Election — Timelock Integration
  // ═══════════════════════════════════════════════

  describe("Timelock Integration", function () {
    beforeEach(async function () {
      await election.connect(manager).addCandidate("Alice", "QmAliceCID");
      await election.connect(manager).startCommitPhase(COMMIT_DURATION, REVEAL_DURATION);

      // Fast-forward through commit + reveal
      await time.increase(COMMIT_DURATION);
      await election.startRevealPhase();
      await time.increase(REVEAL_DURATION);
    });

    it("Should allow TIMELOCK_ROLE to end election", async function () {
      // owner has TIMELOCK_ROLE from beforeEach setup
      await expect(election.connect(owner).endElection())
        .to.emit(election, "ElectionStateChanged")
        .withArgs(3); // Ended
    });

    it("Should NOT allow manager to end election directly", async function () {
      const TIMELOCK_ROLE = await election.TIMELOCK_ROLE();
      await expect(
        election.connect(manager).endElection()
      ).to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount")
       .withArgs(manager.address, TIMELOCK_ROLE);
    });

    it("Should end election through TimelockController", async function () {
      const timelockAddress = await timelock.getAddress();
      const electionAddress = await election.getAddress();

      // Encode the endElection() call
      const calldata = election.interface.encodeFunctionData("endElection");
      const predecessor = ethers.ZeroHash;
      const descriptionSalt = ethers.id("End Election #1");

      // Schedule
      await timelock.schedule(
        electionAddress,  // target
        0,                // value
        calldata,         // data
        predecessor,      // predecessor
        descriptionSalt,  // salt
        TIMELOCK_DELAY    // delay
      );

      // Wait for timelock delay
      await time.increase(TIMELOCK_DELAY);

      // Execute
      await timelock.execute(
        electionAddress,
        0,
        calldata,
        predecessor,
        descriptionSalt
      );

      expect(await election.state()).to.equal(3); // Ended
    });
  });

  // ═══════════════════════════════════════════════
  //  Election — Timeline Helper
  // ═══════════════════════════════════════════════

  describe("Election Timeline", function () {
    it("Should return correct timeline data", async function () {
      await election.connect(manager).addCandidate("Alice", "QmAliceCID");
      await election.connect(manager).startCommitPhase(COMMIT_DURATION, REVEAL_DURATION);

      const timeline = await election.getElectionTimeline();
      expect(timeline.currentState).to.equal(1); // CommitPhase
      expect(timeline._totalCommits).to.equal(0);
      expect(timeline._totalVotes).to.equal(0);
      expect(timeline._commitDeadline).to.be.gt(0);
      expect(timeline._revealDeadline).to.be.gt(timeline._commitDeadline);
    });
  });

  // ═══════════════════════════════════════════════
  //  Election — Commit Hash Helper
  // ═══════════════════════════════════════════════

  describe("Commit Hash Helper", function () {
    it("Should produce consistent hashes", async function () {
      const candidateId = 1;
      const salt = ethers.randomBytes(32);

      const contractHash = await election.computeCommitHash(candidateId, salt);
      const localHash = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32"],
        [candidateId, salt]
      );

      expect(contractHash).to.equal(localHash);
    });
  });
});
