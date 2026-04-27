const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Election Contract", function () {
  let Election;
  let election;
  let owner;
  let manager;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, manager, voter1, voter2] = await ethers.getSigners();
    Election = await ethers.getContractFactory("Election");
    election = await Election.deploy();
    
    const MANAGER_ROLE = await election.ELECTION_MANAGER_ROLE();
    await election.grantRole(MANAGER_ROLE, manager.address);
  });

  describe("Deployment & Roles", function () {
    it("Should set the right admin", async function () {
      const ADMIN_ROLE = await election.DEFAULT_ADMIN_ROLE();
      expect(await election.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should start in NotStarted state", async function () {
      expect(await election.state()).to.equal(0);
    });
  });

  describe("Election Management", function () {
    it("Should allow manager to add candidates", async function () {
      await expect(election.connect(manager).addCandidate("Alice", "CID123"))
        .to.emit(election, "CandidateAdded")
        .withArgs(1, "Alice", "CID123");
      expect(await election.candidatesCount()).to.equal(1);
    });

    it("Should not allow non-managers to add candidates", async function () {
      const MANAGER_ROLE = await election.ELECTION_MANAGER_ROLE();
      await expect(election.connect(voter1).addCandidate("Bob", "CID456"))
        .to.be.revertedWithCustomError(election, "AccessControlUnauthorizedAccount")
        .withArgs(voter1.address, MANAGER_ROLE);
    });

    it("Should allow manager to register voters", async function () {
      await expect(election.connect(manager).registerVoter(voter1.address))
        .to.emit(election, "VoterRegistered")
        .withArgs(voter1.address);
      
      const voter = await election.voters(voter1.address);
      expect(voter.isRegistered).to.be.true;
    });
  });

  describe("Voting Process", function () {
    beforeEach(async function () {
      await election.connect(manager).addCandidate("Alice", "CID123");
      await election.connect(manager).addCandidate("Bob", "CID456");
      await election.connect(manager).registerVoter(voter1.address);
      await election.connect(manager).startElection();
    });

    it("Should allow a registered voter to vote", async function () {
      await expect(election.connect(voter1).vote(1))
        .to.emit(election, "VoteCasted")
        .withArgs(voter1.address, 1);
      
      const candidate = await election.getCandidate(1);
      expect(candidate.voteCount).to.equal(1);
    });

    it("Should not allow voting twice", async function () {
      await election.connect(voter1).vote(1);
      await expect(election.connect(voter1).vote(2))
        .to.be.revertedWith("Voter has already voted");
    });

    it("Should not allow unregistered users to vote", async function () {
      await expect(election.connect(voter2).vote(1))
        .to.be.revertedWith("Voter not registered");
    });

    it("Should not allow voting for invalid candidates", async function () {
      await expect(election.connect(voter1).vote(99))
        .to.be.revertedWith("Invalid candidate ID");
    });
  });
});
