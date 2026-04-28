// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IElectionAttack {
    function commitVote(bytes32 _commitHash) external;
    function revealVote(uint256 _candidateId, bytes32 _salt, string memory _ballotProofCID) external;
}

/**
 * @title ReentrancyAttacker — Test contract for reentrancy simulation
 * @dev Attempts to call commitVote twice in a single transaction
 */
contract ReentrancyAttacker is IERC721Receiver {
    IElectionAttack public target;

    constructor(address _target) {
        target = IElectionAttack(_target);
    }

    function attackDoubleCommit(bytes32 hash1, bytes32 hash2) external {
        target.commitVote(hash1);
        target.commitVote(hash2); // Should revert: "Already committed a vote"
    }

    function attackDoubleReveal(
        uint256 cid1, bytes32 salt1,
        uint256 cid2, bytes32 salt2
    ) external {
        target.revealVote(cid1, salt1, "proof1");
        target.revealVote(cid2, salt2, "proof2"); // Should revert
    }

    function singleCommit(bytes32 hash) external {
        target.commitVote(hash);
    }

    function singleReveal(uint256 candidateId, bytes32 salt, string calldata cid) external {
        target.revealVote(candidateId, salt, cid);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC721Received.selector;
    }
}
