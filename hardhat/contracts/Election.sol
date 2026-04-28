// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Election — Commit-Reveal Voting with Soulbound Identity & Timelock
 *
 * @notice A fully on-chain election system featuring:
 *   • Soulbound NFT-based voter eligibility (replaces MongoDB whitelist)
 *   • Two-phase commit-reveal voting (prevents vote manipulation from live totals)
 *   • Role-based access control (Admin / Manager / Timelock)
 *   • TimelockController integration for sensitive governance actions
 *   • On-chain IPFS ballot proof CID storage
 *
 * @dev State machine: NotStarted → CommitPhase → RevealPhase → Ended
 *
 *      Roles:
 *        DEFAULT_ADMIN_ROLE   — can grant / revoke all roles
 *        ELECTION_MANAGER_ROLE — can add candidates, start commit phase
 *        TIMELOCK_ROLE         — required to end the election (must go through TimelockController)
 */

// Import interface so we can call isEligible() without a circular dependency
interface IVoterSBT {
    function isEligible(address voter) external view returns (bool);
    function voterConstituency(address voter) external view returns (string memory);
}

contract Election is AccessControl {
    // ──────────────────────────────────────────────
    // Roles
    // ──────────────────────────────────────────────

    bytes32 public constant ELECTION_MANAGER_ROLE = keccak256("ELECTION_MANAGER_ROLE");
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");

    // ──────────────────────────────────────────────
    // External Contracts
    // ──────────────────────────────────────────────

    IVoterSBT public voterSBT;

    // ──────────────────────────────────────────────
    // State Machine
    // ──────────────────────────────────────────────

    enum ElectionState { NotStarted, CommitPhase, RevealPhase, Ended }
    ElectionState public state;

    // ──────────────────────────────────────────────
    // Candidate Storage
    // ──────────────────────────────────────────────

    struct Candidate {
        uint256 id;
        string name;
        string imageCID;
        uint256 voteCount;
    }

    mapping(uint256 => Candidate) public candidates;
    uint256 public candidatesCount;

    // ──────────────────────────────────────────────
    // Commit-Reveal Storage
    // ──────────────────────────────────────────────

    /// @dev commitHash = keccak256(abi.encodePacked(candidateId, salt))
    mapping(address => bytes32) public commitments;
    mapping(address => bool) public hasCommitted;
    mapping(address => bool) public hasRevealed;

    uint256 public commitDeadline;
    uint256 public revealDeadline;
    uint256 public totalVotes;
    uint256 public totalCommits;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event CandidateAdded(uint256 indexed candidateId, string name, string imageCID);
    event ElectionStateChanged(ElectionState newState);
    event VoteCommitted(address indexed voter);
    event VoteRevealed(address indexed voter, uint256 indexed candidateId, string ballotProofCID);

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    /**
     * @param _voterSBTAddress Address of the deployed VoterSBT contract.
     */
    constructor(address _voterSBTAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ELECTION_MANAGER_ROLE, msg.sender);
        voterSBT = IVoterSBT(_voterSBTAddress);
        state = ElectionState.NotStarted;
    }

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier inState(ElectionState _state) {
        require(state == _state, "Invalid election state for this action");
        _;
    }

    // ══════════════════════════════════════════════
    //  ADMIN FUNCTIONS
    // ══════════════════════════════════════════════

    /**
     * @notice Add a candidate to the ballot. Only allowed before the election starts.
     * @param _name     Candidate display name.
     * @param _imageCID IPFS CID for the candidate's photo.
     */
    function addCandidate(string memory _name, string memory _imageCID)
        external
        onlyRole(ELECTION_MANAGER_ROLE)
        inState(ElectionState.NotStarted)
    {
        candidatesCount++;
        candidates[candidatesCount] = Candidate({
            id: candidatesCount,
            name: _name,
            imageCID: _imageCID,
            voteCount: 0
        });
        emit CandidateAdded(candidatesCount, _name, _imageCID);
    }

    /**
     * @notice Start the commit phase. Voters can submit hashed votes.
     * @param _commitDuration  Duration in seconds for the commit phase.
     * @param _revealDuration  Duration in seconds for the reveal phase (starts after commit ends).
     */
    function startCommitPhase(uint256 _commitDuration, uint256 _revealDuration)
        external
        onlyRole(ELECTION_MANAGER_ROLE)
        inState(ElectionState.NotStarted)
    {
        require(candidatesCount > 0, "Must have at least one candidate");
        require(_commitDuration > 0 && _revealDuration > 0, "Durations must be positive");

        commitDeadline = block.timestamp + _commitDuration;
        revealDeadline = commitDeadline + _revealDuration;
        state = ElectionState.CommitPhase;

        emit ElectionStateChanged(state);
    }

    /**
     * @notice Transition from commit phase to reveal phase.
     *         Anyone can call this once the commit deadline has passed.
     */
    function startRevealPhase() external inState(ElectionState.CommitPhase) {
        require(block.timestamp >= commitDeadline, "Commit phase not yet ended");
        state = ElectionState.RevealPhase;
        emit ElectionStateChanged(state);
    }

    /**
     * @notice End the election after the reveal phase.
     * @dev    Requires TIMELOCK_ROLE — must be called via TimelockController for governance.
     */
    function endElection()
        external
        onlyRole(TIMELOCK_ROLE)
        inState(ElectionState.RevealPhase)
    {
        require(block.timestamp >= revealDeadline, "Reveal phase not yet ended");
        state = ElectionState.Ended;
        emit ElectionStateChanged(state);
    }

    // ══════════════════════════════════════════════
    //  VOTER FUNCTIONS  (Commit-Reveal)
    // ══════════════════════════════════════════════

    /**
     * @notice Phase 1 — Commit a hashed vote. The actual vote is hidden until reveal.
     * @param _commitHash  keccak256(abi.encodePacked(uint256(candidateId), bytes32(salt)))
     */
    function commitVote(bytes32 _commitHash)
        external
        inState(ElectionState.CommitPhase)
    {
        require(block.timestamp < commitDeadline, "Commit phase has ended");
        require(voterSBT.isEligible(msg.sender), "Voter does not hold a Soulbound Token");
        require(!hasCommitted[msg.sender], "Already committed a vote");
        require(_commitHash != bytes32(0), "Invalid commit hash");

        commitments[msg.sender] = _commitHash;
        hasCommitted[msg.sender] = true;
        totalCommits++;

        emit VoteCommitted(msg.sender);
    }

    /**
     * @notice Phase 2 — Reveal the actual vote and verify against the commitment.
     * @param _candidateId    The candidate ID that was voted for.
     * @param _salt           The secret salt used during commit.
     * @param _ballotProofCID IPFS CID of the ballot proof receipt (pinned via Pinata).
     */
    function revealVote(
        uint256 _candidateId,
        bytes32 _salt,
        string memory _ballotProofCID
    )
        external
        inState(ElectionState.RevealPhase)
    {
        require(block.timestamp < revealDeadline, "Reveal phase has ended");
        require(hasCommitted[msg.sender], "No commitment found for this address");
        require(!hasRevealed[msg.sender], "Already revealed vote");
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");

        // Verify the commitment matches
        bytes32 expectedHash = keccak256(abi.encodePacked(_candidateId, _salt));
        require(expectedHash == commitments[msg.sender], "Reveal does not match commitment");

        // Record the revealed vote
        hasRevealed[msg.sender] = true;
        candidates[_candidateId].voteCount++;
        totalVotes++;

        emit VoteRevealed(msg.sender, _candidateId, _ballotProofCID);
    }

    // ══════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════

    /**
     * @notice Fetch full candidate details.
     */
    function getCandidate(uint256 _candidateId) external view returns (Candidate memory) {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Invalid candidate ID");
        return candidates[_candidateId];
    }

    /**
     * @notice Get the election timeline and current state in one call.
     */
    function getElectionTimeline()
        external
        view
        returns (
            ElectionState currentState,
            uint256 _commitDeadline,
            uint256 _revealDeadline,
            uint256 _totalCommits,
            uint256 _totalVotes
        )
    {
        return (state, commitDeadline, revealDeadline, totalCommits, totalVotes);
    }

    /**
     * @notice Helper to compute the commit hash off-chain or verify on-chain.
     * @dev    Frontend should use this to ensure consistent hashing.
     */
    function computeCommitHash(uint256 _candidateId, bytes32 _salt)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_candidateId, _salt));
    }
}
