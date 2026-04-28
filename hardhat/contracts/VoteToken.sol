// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VoteToken — ERC-20 Governance Token with Voting Power
 * @notice Issued to registered voters for DAO-based dispute resolution.
 *         1 token = 1 governance vote in the ElectionGovernor contract.
 * @dev    Uses ERC20Votes (delegation + checkpoints) for Governor integration.
 */
contract VoteToken is ERC20, ERC20Permit, ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev Amount of tokens minted to each voter at registration.
    uint256 public constant VOTER_ALLOCATION = 1 * 10 ** 18; // 1 token

    event GovernanceTokensMinted(address indexed voter, uint256 amount);

    constructor()
        ERC20("VoteGovernance", "VGOV")
        ERC20Permit("VoteGovernance")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @notice Mint governance tokens to a newly registered voter.
     * @param to The voter's address.
     */
    function mintToVoter(address to) external onlyRole(MINTER_ROLE) {
        _mint(to, VOTER_ALLOCATION);
        emit GovernanceTokensMinted(to, VOTER_ALLOCATION);
    }

    // ──────────────────────────────────────────────
    // Required Overrides for ERC20 + ERC20Votes
    // ──────────────────────────────────────────────

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
