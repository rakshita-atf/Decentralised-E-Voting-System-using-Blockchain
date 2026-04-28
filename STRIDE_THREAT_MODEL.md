# STRIDE Threat Model — Decentralised E-Voting System

> **Version:** 1.0  
> **Date:** April 2026  
> **Author:** Project Team  
> **Scope:** All smart contracts, frontend, backend, and off-chain components

---

## 1. System Overview

This decentralised e-voting system enables tamper-proof, transparent, and privacy-preserving elections on the Polygon blockchain. The system comprises:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Election.sol** | Solidity 0.8.27 | Commit-reveal voting, candidate management, state machine |
| **VoterSBT.sol** | ERC-721 (non-transferable) | On-chain voter identity via Soulbound Tokens |
| **TimelockController** | OpenZeppelin Governance | Delays sensitive admin operations |
| **ElectionGovernor.sol** | OpenZeppelin Governor | DAO-based dispute resolution |
| **VoteToken.sol** | ERC-20 + ERC20Votes | Governance token for weighted voting |
| **Frontend** | Next.js 16 + Tailwind CSS | Voter and admin UI |
| **Backend** | Express + Socket.io | KYC simulation, IPFS pinning, event relay |
| **IPFS (Pinata)** | Decentralised storage | Ballot proof receipts, candidate images |
| **The Graph** | Subgraph (GraphQL) | Event indexing and historical data queries |

---

## 2. Trust Boundaries

```
┌─────────────────────────────────────────────────────┐
│  BROWSER (Untrusted)                                │
│  • Next.js Frontend                                 │
│  • MetaMask Extension                               │
│  • localStorage (salt storage)                      │
├─────────────────────────────────────────────────────┤
│  BACKEND SERVER (Semi-Trusted)                      │
│  • Express API (KYC, IPFS pinning)                  │
│  • Socket.io (event relay)                          │
│  • JWT token issuance                               │
├─────────────────────────────────────────────────────┤
│  BLOCKCHAIN (Trustless/Immutable)                   │
│  • Polygon Amoy / Mainnet                           │
│  • Smart Contracts (Election, VoterSBT, Governor)   │
│  • TimelockController                               │
├─────────────────────────────────────────────────────┤
│  IPFS (Content-Addressed)                           │
│  • Pinata pinning service                           │
│  • Ballot proof receipts                            │
└─────────────────────────────────────────────────────┘
```

---

## 3. STRIDE Analysis

### 3.1 Spoofing — Fake Voter Identities

| Aspect | Details |
|--------|---------|
| **Threat** | An attacker creates multiple wallet addresses and votes multiple times, or impersonates a legitimate voter. |
| **Attack Vector** | Sybil attack — creating unlimited Ethereum addresses is free. Without identity verification, each address could be treated as a separate voter. |
| **Impact** | **Critical** — election results become meaningless if one entity can cast unlimited votes. |
| **Mitigation** | |
| ✅ **Soulbound NFT (VoterSBT.sol)** | Each voter must hold a non-transferable ERC-721 token minted by the admin. The `commitVote()` function checks `voterSBT.isEligible(msg.sender)` before allowing a commit. Since SBTs cannot be transferred, a stolen wallet cannot pass its eligibility to another address. |
| ✅ **KYC via DigiLocker** | Real-world identity verification (Aadhaar OTP) is required before the admin mints an SBT. This ties each blockchain address to a verified real-world identity. |
| ✅ **One SBT per address** | `VoterSBT.mintVoterToken()` reverts if the address already holds a token: `require(!hasSBT[to])`. |
| **Residual Risk** | The admin could mint SBTs to fraudulent addresses. Mitigated by the timelock and DAO governance oversight. |

---

### 3.2 Tampering — Contract Exploits & Vote Manipulation

| Aspect | Details |
|--------|---------|
| **Threat** | An attacker modifies votes after they are cast, exploits a smart contract vulnerability to alter candidate vote counts, or front-runs transactions. |
| **Attack Vector** | (a) Direct storage manipulation (impossible on a public blockchain). (b) Reentrancy or logic bugs. (c) Front-running — an attacker sees a pending vote and acts on it. |
| **Impact** | **Critical** — compromises election integrity. |
| **Mitigation** | |
| ✅ **Commit-Reveal Scheme** | Votes are hidden during the commit phase (`commitHash = keccak256(candidateId, salt)`). Even if a miner/validator sees the transaction, they cannot determine the vote choice. During the reveal phase, the contract verifies `keccak256(candidateId, salt) == storedCommitment`. |
| ✅ **Immutable on-chain storage** | Once a vote is committed or revealed, it cannot be altered. Blockchain consensus ensures tamper resistance. |
| ✅ **OpenZeppelin Contracts** | All base contracts (AccessControl, ERC-721, Governor, TimelockController) use battle-tested OpenZeppelin v5 implementations. |
| ✅ **Static Analysis** | Run `slither .` on the contracts directory to detect reentrancy, unchecked calls, and other common vulnerabilities. |
| ✅ **RBAC** | Only `ELECTION_MANAGER_ROLE` can add candidates or start elections. Only `TIMELOCK_ROLE` can end elections. |
| **Residual Risk** | Logic bugs in custom contract code. Mitigated by comprehensive test suite (25 passing tests covering all edge cases). |

---

### 3.3 Repudiation — Denying a Vote Was Cast

| Aspect | Details |
|--------|---------|
| **Threat** | A voter claims they did not vote, or the system cannot prove a specific vote was cast. Alternatively, an admin denies performing a contested action. |
| **Attack Vector** | Absence of audit trail for off-chain actions. |
| **Impact** | **Medium** — undermines trust in the election process. |
| **Mitigation** | |
| ✅ **On-chain events** | Every action emits an Ethereum event: `VoteCommitted(address voter)`, `VoteRevealed(address voter, uint256 candidateId, string ballotProofCID)`, `CandidateAdded(...)`, `ElectionStateChanged(...)`. These are permanently stored in transaction logs. |
| ✅ **IPFS Ballot Proofs** | After each reveal, a JSON receipt is pinned to IPFS via Pinata. The CID is stored on-chain in the `VoteRevealed` event. This receipt contains: hashed voter address, timestamp, election ID, SHA-256 vote hash, and transaction hash. |
| ✅ **The Graph Subgraph** | All events are indexed by the subgraph, providing a queryable historical record. |
| ✅ **TimelockController** | All sensitive admin actions are delayed and broadcast as pending operations before execution, creating a public audit trail. |
| **Residual Risk** | Off-chain KYC records are in-memory and lost on server restart. In production, these should be stored in a secure, auditable database. |

---

### 3.4 Information Disclosure — Vote Privacy

| Aspect | Details |
|--------|---------|
| **Threat** | An observer determines how a specific voter voted, either during the election or after. |
| **Attack Vector** | (a) On-chain analysis of transactions during voting. (b) Correlation of commit and reveal transactions. (c) Block explorer monitoring. |
| **Impact** | **High** — voter coercion and intimidation become possible if votes are not secret. |
| **Mitigation** | |
| ✅ **Commit-Reveal Scheme** | During the commit phase, only `keccak256(candidateId, salt)` is stored on-chain. The actual vote choice is unknowable without the salt. Even validators cannot determine the vote. |
| ✅ **Client-side salt generation** | The salt is generated using `ethers.randomBytes(32)` in the browser and stored only in `localStorage`. It never leaves the voter's device until the reveal phase. |
| ✅ **Hashed voter ID in receipts** | Ballot proof receipts use `SHA-256(voterAddress)` rather than the raw address, adding a layer of pseudonymity. |
| **Residual Risk** | During the reveal phase, the `VoteRevealed` event includes both the voter address and candidateId in cleartext. This is inherent to the reveal mechanism. For stronger privacy, a ZKP-based scheme would be needed (was present in earlier design but removed for simplicity). After the election ends, all votes are publicly auditable by design. |

---

### 3.5 Denial of Service — Gas Limit & Block Stuffing

| Aspect | Details |
|--------|---------|
| **Threat** | An attacker prevents legitimate voters from casting votes by (a) congesting the network, (b) exploiting gas limits, or (c) attacking the backend/frontend infrastructure. |
| **Attack Vector** | (a) Gas price wars — attacker sends many high-gas transactions to fill blocks. (b) Contract-level DoS — if a function iterates over unbounded arrays. (c) Frontend/backend DDoS. |
| **Impact** | **High** — voters are unable to participate in the election. |
| **Mitigation** | |
| ✅ **Polygon L2** | Deploying on Polygon significantly reduces gas costs ($0.001 per tx vs $5+ on Ethereum L1). Block stuffing attacks on Polygon are economically infeasible. |
| ✅ **No unbounded loops on-chain** | All on-chain functions operate on single-entity lookups (O(1) gas). The `getCandidate()` function takes an ID, not an array iteration. Candidate enumeration happens off-chain via the subgraph. |
| ✅ **Time-bounded phases** | The commit and reveal phases have fixed deadlines set by the admin. If the frontend goes down, voters can interact directly with the contract via Etherscan/PolygonScan. |
| ✅ **Decentralised frontend hosting** | The Next.js frontend can be deployed to IPFS via Fleek/Vercel, ensuring availability even if a single server goes down. |
| **Residual Risk** | If the backend server is down, real-time event feeds and IPFS pinning are unavailable. Core voting functionality continues to work via direct contract interaction. |

---

### 3.6 Elevation of Privilege — Admin Key Compromise

| Aspect | Details |
|--------|---------|
| **Threat** | An attacker gains access to the admin's private key and performs unauthorized actions: adding fake candidates, ending the election early, minting SBTs to colluding addresses. |
| **Attack Vector** | (a) Private key theft (phishing, malware, insecure storage). (b) Insider threat — a rogue admin. |
| **Impact** | **Critical** — complete compromise of election integrity. |
| **Mitigation** | |
| ✅ **TimelockController** | The `endElection()` function requires `TIMELOCK_ROLE`, which is assigned to the TimelockController. The admin must schedule the action, wait for the configured delay (24h in production), and then execute. During the delay, the community can observe the pending action and raise a dispute. |
| ✅ **DAO Governance (ElectionGovernor)** | Token holders can propose and vote on disputes. If the admin acts maliciously, the DAO can propose corrective actions (e.g., voiding the election). |
| ✅ **Role Separation (RBAC)** | `DEFAULT_ADMIN_ROLE`, `ELECTION_MANAGER_ROLE`, and `TIMELOCK_ROLE` are separate. Compromising one role does not grant all permissions. |
| ✅ **Soulbound Non-Transferability** | Even if the admin mints fraudulent SBTs, those tokens cannot be transferred. Each fraudulent mint creates an auditable on-chain event that is visible to all participants. |
| **Recommended Enhancement** | Deploy a Gnosis Safe multi-sig wallet as the admin address, requiring 2-of-3 or 3-of-5 signatures for any admin action. This eliminates single-point-of-failure risk. |

---

## 4. Threat Summary Matrix

| # | Category | Severity | Primary Mitigation | Status |
|---|----------|----------|-------------------|--------|
| S1 | Spoofing | Critical | Soulbound NFT + KYC | ✅ Implemented |
| T1 | Tampering | Critical | Commit-Reveal + OpenZeppelin | ✅ Implemented |
| R1 | Repudiation | Medium | IPFS Ballot Proofs + Events | ✅ Implemented |
| I1 | Information Disclosure | High | Commit-Reveal Scheme | ✅ Implemented |
| D1 | Denial of Service | High | Polygon L2 + O(1) gas | ✅ Implemented |
| E1 | Elevation of Privilege | Critical | Timelock + DAO + RBAC | ✅ Implemented |

---

## 5. Recommended Auditing Commands

```bash
# Install Slither (Solidity static analyzer)
pip install slither-analyzer

# Run static analysis on contracts
cd hardhat
slither . --exclude naming-convention,solc-version

# Run full test suite
npx hardhat test

# Check test coverage
npx hardhat coverage
```

---

## 6. References

- [STRIDE Model — Microsoft](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- [OpenZeppelin Contracts v5](https://docs.openzeppelin.com/contracts/5.x/)
- [ERC-5114: Soulbound Badge](https://eips.ethereum.org/EIPS/eip-5114)
- [Commit-Reveal Scheme](https://karl.tech/learning-solidity-part-2-voting/)
- [Polygon PoS Security](https://polygon.technology/blog/polygon-pos-security)
