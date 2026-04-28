// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VoterSBT — Soulbound Voter Eligibility Token (ERC-5114 pattern)
 * @notice Non-transferable ERC-721 token that serves as on-chain voter identity.
 *         Replaces the traditional MongoDB voter whitelist with a fully on-chain check.
 *         Each verified voter receives exactly one SBT, which cannot be transferred.
 * @dev    Transfer is blocked by overriding _update(). Only minting (from address(0)) is allowed.
 */
contract VoterSBT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId;

    /// @dev Mapping from voter address to their constituency/region identifier (for heatmap analytics).
    mapping(address => string) public voterConstituency;

    /// @dev Track whether an address already holds an SBT.
    mapping(address => bool) public hasSBT;

    /// @dev Total number of SBTs minted (= total registered voters).
    uint256 public totalVoters;

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event VoterSBTMinted(address indexed voter, uint256 indexed tokenId, string constituency);

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor() ERC721("VoterSBT", "VSBT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // ──────────────────────────────────────────────
    // Admin Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Mint a soulbound token to a verified voter.
     * @param to            The voter's wallet address.
     * @param constituency  Region/constituency identifier (e.g. "Delhi-North").
     */
    function mintVoterToken(address to, string memory constituency)
        external
        onlyRole(MINTER_ROLE)
    {
        require(!hasSBT[to], "VoterSBT: address already holds an SBT");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        voterConstituency[to] = constituency;
        hasSBT[to] = true;
        totalVoters++;

        emit VoterSBTMinted(to, tokenId, constituency);
    }

    // ──────────────────────────────────────────────
    // View Functions
    // ──────────────────────────────────────────────

    /**
     * @notice Check if an address is eligible to vote (owns an SBT).
     * @param voter The address to check.
     * @return True if the address holds a Voter SBT.
     */
    function isEligible(address voter) external view returns (bool) {
        return hasSBT[voter];
    }

    // ──────────────────────────────────────────────
    // Soulbound Enforcement
    // ──────────────────────────────────────────────

    /**
     * @dev Override _update to make tokens non-transferable (soulbound).
     *      Only minting (from == address(0)) is allowed; all transfers revert.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        // Allow minting (from == address(0)), block every other transfer
        if (from != address(0)) {
            revert("VoterSBT: token is soulbound and cannot be transferred");
        }
        return super._update(to, tokenId, auth);
    }

    // ──────────────────────────────────────────────
    // Required Overrides
    // ──────────────────────────────────────────────

    /// @dev ERC-165: declare support for both ERC-721 and AccessControl interfaces.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
