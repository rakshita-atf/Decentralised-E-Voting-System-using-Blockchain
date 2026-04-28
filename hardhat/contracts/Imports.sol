// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Imports — Force Hardhat to compile OpenZeppelin governance contracts
 * @dev   This file exists solely so that Hardhat compiles TimelockController
 *        (which we deploy directly, not via inheritance) and generates its artifact + ABI.
 *        No deployment of this file is needed.
 */

import "@openzeppelin/contracts/governance/TimelockController.sol";
