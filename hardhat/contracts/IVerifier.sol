// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface for the SnarkJS generated ZKP Verifier.
 * This contract verifies the zk-SNARK proof submitted by the voter.
 */
interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[1] memory input // input[0] is the nullifierHash
    ) external view returns (bool);
}
