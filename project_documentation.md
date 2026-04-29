# Decentralised E-Voting System Using Blockchain
### Major Project Documentation
**Department of Computer Science & Engineering**

---

## Table of Contents
1. Abstract
2. Introduction
3. Problem Statement
4. Objectives
5. System Architecture
6. Technology Stack
7. Smart Contracts — Design & Working
8. Frontend Application
9. Code Structure
10. Working on Localhost (Step-by-Step)
11. How Everything Works Together
12. Security Features
13. Benefits
14. Use Cases
15. Deployment (Vercel + Polygon Amoy)
16. Testing
17. Future Scope
18. Conclusion
19. References

---

## 1. Abstract

This project presents a **Decentralised Electronic Voting System** built on the Ethereum-compatible Polygon blockchain. Traditional voting systems suffer from issues of transparency, fraud, tampering, and single points of failure. This system leverages smart contracts, Soulbound NFTs for voter identity, and a commit-reveal voting scheme to deliver a fully on-chain, auditable, and tamper-proof election platform. The frontend is a modern Next.js web application interacting with MetaMask for wallet-based authentication. Contracts are deployed on either a local Hardhat node (development) or the Polygon Amoy testnet (production).

---

## 2. Introduction

Elections are the cornerstone of democracy. However, centralised e-voting systems are prone to:
- Server hacks and data manipulation
- Lack of public auditability
- Voter identity fraud
- Single points of failure

Blockchain technology — specifically smart contracts — offers an immutable, transparent, and decentralised alternative. Once a vote is recorded on-chain, it cannot be altered by any party, including the system administrators.

This project implements:
- **On-chain voter registration** via Soulbound Tokens (non-transferable NFTs)
- **Commit-Reveal voting** to prevent vote manipulation from live totals
- **Role-Based Access Control** (RBAC) for secure election management
- **TimelockController** for governance of sensitive actions
- **Next.js frontend** with MetaMask wallet integration

---

## 3. Problem Statement

Existing e-voting systems are centralised and rely on trusted third parties. Key problems include:
- **Transparency**: Citizens cannot independently verify results
- **Security**: Centralised databases are single points of attack
- **Identity fraud**: No reliable way to prevent double voting
- **Vote buying**: Voters can prove how they voted, enabling coercion
- **Auditability**: No immutable audit trail

---

## 4. Objectives

1. Design a fully on-chain voting system with no central server holding vote data
2. Implement Soulbound Tokens for tamper-proof voter identity
3. Use commit-reveal scheme to prevent real-time vote tallying
4. Enforce role-based access so only authorised admins manage elections
5. Provide a modern, user-friendly web interface
6. Enable public verification of results after the election ends
7. Support deployment on public testnets for real-world demonstration

---

## 5. System Architecture

### 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER (Browser)                          │
│                                                             │
│   ┌──────────────┐    ┌────────────────────────────────┐   │
│   │   MetaMask   │◄──►│   Next.js Frontend (Vercel)    │   │
│   │  (Wallet)    │    │  /admin /voter /results        │   │
│   └──────┬───────┘    └───────────────┬────────────────┘   │
│          │                            │ ethers.js v6        │
└──────────┼────────────────────────────┼─────────────────────┘
           │                            │
           ▼                            ▼
┌──────────────────────────────────────────────────────────────┐
│               BLOCKCHAIN (Polygon Amoy / Hardhat)            │
│                                                              │
│  ┌─────────────────┐    ┌───────────────────────────────┐   │
│  │    VoterSBT     │◄───│         Election              │   │
│  │  (ERC-721 SBT)  │    │   (Commit-Reveal + RBAC)      │   │
│  └─────────────────┘    └────────────────┬──────────────┘   │
│                                          │                   │
│                          ┌───────────────▼──────────────┐   │
│                          │     TimelockController        │   │
│                          │   (OpenZeppelin Governance)   │   │
│                          └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Component Breakdown

| Component | Role |
|---|---|
| **VoterSBT** | Soulbound ERC-721 token proving voter identity |
| **Election** | Core voting logic — candidates, commit, reveal, results |
| **TimelockController** | Governance delay on sensitive actions (endElection) |
| **useWallet hook** | React hook managing MetaMask connection, network detection |
| **Admin Dashboard** | Election management UI — add candidates, start phases |
| **Voter Portal** | Commit and reveal vote UI for eligible voters |
| **Results Page** | Live on-chain vote tallies |
| **Analytics Page** | Voter turnout, constituency breakdown |
| **Verify Page** | Independent vote verification using wallet address |

---

## 6. Technology Stack

### Backend (Blockchain)
| Technology | Version | Purpose |
|---|---|---|
| Solidity | 0.8.27 | Smart contract language |
| Hardhat | ^2.19.0 | Development framework, local node, testing |
| OpenZeppelin | ^5.0.0 | AccessControl, ERC-721, TimelockController |
| Polygon Amoy | Chain 80002 | Public testnet for production deployment |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.4 | React framework with App Router |
| React | 19.2.4 | UI library |
| ethers.js | ^6.16.0 | Blockchain interaction library |
| Tailwind CSS | ^4 | Utility-first CSS framework |
| Lucide React | ^1.11.0 | Icon library |

### Development Tools
| Tool | Purpose |
|---|---|
| MetaMask | Browser wallet for signing transactions |
| Hardhat Node | Local Ethereum-compatible blockchain |
| dotenv | Environment variable management |
| Git / GitHub | Version control |
| Vercel | Frontend deployment platform |

---

## 7. Smart Contracts — Design & Working

### 7.1 VoterSBT.sol

**Purpose**: Issues non-transferable (Soulbound) ERC-721 tokens to verified voters.

**Key Features**:
- Extends OpenZeppelin `ERC721` and `AccessControl`
- `MINTER_ROLE` — only authorised admins can mint tokens
- Soulbound enforcement: overrides `_update()` to block all transfers after minting
- Stores voter's constituency for analytics
- One SBT per address enforced via `hasSBT` mapping

**Key Functions**:

| Function | Access | Description |
|---|---|---|
| `mintVoterToken(address, string)` | MINTER_ROLE | Mints SBT to a verified voter |
| `isEligible(address)` | Public | Returns true if address holds an SBT |
| `voterConstituency(address)` | Public | Returns voter's constituency string |
| `totalVoters()` | Public | Total number of registered voters |

**Soulbound Mechanism**:
```solidity
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address)
{
    address from = _ownerOf(tokenId);
    if (from != address(0)) {  // Block all transfers; only mint allowed
        revert("VoterSBT: token is soulbound and cannot be transferred");
    }
    return super._update(to, tokenId, auth);
}
```

---

### 7.2 Election.sol

**Purpose**: Core voting contract implementing the full election lifecycle.

**State Machine**:
```
NotStarted → CommitPhase → RevealPhase → Ended
```

**Roles**:
| Role | Permissions |
|---|---|
| `DEFAULT_ADMIN_ROLE` | Can grant/revoke all roles |
| `ELECTION_MANAGER_ROLE` | Add candidates, start commit phase |
| `TIMELOCK_ROLE` | End election (must go via TimelockController) |

**Key Functions**:

| Function | Access | Description |
|---|---|---|
| `addCandidate(name, imageCID)` | ELECTION_MANAGER_ROLE | Add candidate before election starts |
| `startCommitPhase(dur1, dur2)` | ELECTION_MANAGER_ROLE | Start election with commit & reveal durations |
| `startRevealPhase()` | Anyone | Transition after commit deadline passes |
| `endElection()` | TIMELOCK_ROLE | End election after reveal deadline |
| `commitVote(bytes32)` | Eligible voter | Submit hashed vote during commit phase |
| `revealVote(candidateId, salt, CID)` | Committed voter | Reveal vote during reveal phase |
| `getCandidate(id)` | Public | Get candidate details |
| `getElectionTimeline()` | Public | Get current state, deadlines, totals |

**Commit-Reveal Mechanism**:

Phase 1 — Commit:
```solidity
// Voter computes: hash = keccak256(abi.encodePacked(candidateId, salt))
commitments[msg.sender] = _commitHash;
hasCommitted[msg.sender] = true;
```

Phase 2 — Reveal:
```solidity
bytes32 expectedHash = keccak256(abi.encodePacked(_candidateId, _salt));
require(expectedHash == commitments[msg.sender], "Reveal does not match commitment");
candidates[_candidateId].voteCount++;
```

This prevents anyone from seeing real-time vote tallies during the commit phase, eliminating bandwagon effects.

---

### 7.3 TimelockController

- OpenZeppelin's governance contract
- Introduces a mandatory delay (60 seconds on testnet, 24h on mainnet) before `endElection()` executes
- Prevents the admin from abruptly ending the election
- Requires a proposal → wait → execute workflow for governance actions

---

## 8. Frontend Application

### 8.1 Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Landing page, MetaMask connect, navigation |
| `/admin` | Admin Dashboard | Manage election: candidates, phases, SBT minting |
| `/voter` | Voter Portal | Commit and reveal votes |
| `/results` | Live Results | Real-time vote counts from blockchain |
| `/analytics` | Analytics | Voter turnout, constituency breakdown |
| `/verify` | Vote Verifier | Verify vote by wallet address |

### 8.2 useWallet Hook (`src/hooks/useWallet.js`)

Central hook managing all MetaMask interactions:

```javascript
const { account, signer, provider, wrongNetwork, networkName, connect } = useWallet();
```

**Responsibilities**:
- Connects to MetaMask via `BrowserProvider`
- Detects network and sets `wrongNetwork` flag
- Supports chains: Hardhat Local (31337), Polygon Amoy (80002), Polygon Mainnet (137)
- Listens for account and network changes
- Exports `WrongNetworkBanner` component

### 8.3 Admin Dashboard (`/admin/page.js`)

**Features**:
- Wallet gate — shows connect prompt if not connected
- Wrong network blocker with one-click switch buttons
- Add candidates with name and IPFS image CID
- Set commit and reveal phase durations
- Start/end election phases
- Register voters by minting SBTs to wallet addresses
- Real-time stats: election state, registered voters, commits, revealed votes
- Election phase timeline visualisation

**Contract Interaction Pattern**:
Uses `useRef` for contract instances to avoid React stale closure bugs in async callbacks:
```javascript
const electionContractRef = useRef(null);
// In txAction:
const contract = electionContractRef.current; // always latest reference
```

---

## 9. Code Structure

```
BlockChainVoting/
├── hardhat/                          # Blockchain layer
│   ├── contracts/
│   │   ├── Election.sol              # Core voting contract
│   │   ├── VoterSBT.sol              # Soulbound voter identity token
│   │   ├── ElectionGovernor.sol      # DAO governance contract
│   │   ├── VoteToken.sol             # Governance token
│   │   └── Imports.sol               # OpenZeppelin imports
│   ├── scripts/
│   │   ├── deploy.js                 # Deploy all contracts + auto-write .env.local
│   │   ├── grant-roles.js            # Grant admin roles to wallet addresses
│   │   └── fund-accounts.js          # Fund test accounts with ETH
│   ├── test/
│   │   └── GovernanceAudit.js        # Contract test suite
│   ├── hardhat.config.js             # Hardhat configuration (localhost + amoy)
│   └── package.json                  # Scripts: node, deploy:local, deploy:amoy, etc.
│
├── frontend/                         # Next.js web application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js               # Home / landing page
│   │   │   ├── layout.js             # Root layout with global styles
│   │   │   ├── globals.css           # Global Tailwind + custom CSS
│   │   │   ├── admin/page.js         # Admin dashboard
│   │   │   ├── voter/page.js         # Voter portal (commit-reveal UI)
│   │   │   ├── results/page.js       # Live election results
│   │   │   ├── analytics/page.js     # Voter analytics
│   │   │   └── verify/page.js        # Vote verification
│   │   ├── hooks/
│   │   │   └── useWallet.js          # MetaMask connection hook + WrongNetworkBanner
│   │   └── contracts/
│   │       ├── ElectionABI.json      # Auto-generated by deploy.js
│   │       └── VoterSBTABI.json      # Auto-generated by deploy.js
│   ├── .env.local                    # Auto-written by deploy.js (contract addresses)
│   └── package.json
│
├── start-local.ps1                   # One-click dev launcher (PowerShell)
├── STRIDE_THREAT_MODEL.md            # Security threat model
└── .gitignore
```

---

## 10. Working on Localhost (Step-by-Step)

### Prerequisites
- Node.js (v18 recommended)
- MetaMask browser extension
- Git

### Step 1 — Install Dependencies
```powershell
# Install hardhat dependencies
cd hardhat
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2 — Start the Hardhat Local Node
Open Terminal 1:
```powershell
cd hardhat
npm run node
```
This starts a local Ethereum-compatible blockchain at `http://127.0.0.1:8545` with 20 pre-funded test accounts (10,000 ETH each).

### Step 3 — Deploy Contracts
Open Terminal 2:
```powershell
cd hardhat
npm run deploy:local
```
This:
1. Compiles all Solidity contracts
2. Deploys VoterSBT → TimelockController → Election
3. Configures roles
4. **Automatically writes contract addresses to `frontend/.env.local`**
5. **Automatically copies ABI JSON files to `frontend/src/contracts/`**

### Step 4 — Grant Admin Roles
```powershell
npm run grant-roles
```
Grants `ELECTION_MANAGER_ROLE`, `TIMELOCK_ROLE`, `MINTER_ROLE` to your MetaMask wallet.

### Step 5 — Fund Your Wallet
```powershell
npm run fund-accounts
```
Sends 100 test ETH to your wallets from the deployer account.

### Step 6 — Start the Frontend
Open Terminal 3:
```powershell
cd frontend
npm run dev
```
Access at: `http://localhost:3000`

### Step 7 — Configure MetaMask
Add network manually in MetaMask:
- **Network Name**: Hardhat Local
- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `31337`
- **Currency Symbol**: `ETH`

### Step 8 — Use the Application
1. Go to `http://localhost:3000`
2. Click **Connect MetaMask** → approve connection
3. Navigate to **Admin Dashboard** → add candidates, start election
4. Navigate to **Voter Portal** → commit then reveal vote
5. View **Live Results** to see vote counts

---

## 11. How Everything Works Together

### Complete Election Flow

```
ADMIN                           BLOCKCHAIN                    VOTER
  │                                  │                          │
  │── mintVoterToken(address) ──────►│                          │
  │                                  │── SBT minted ───────────►│
  │                                  │                          │
  │── addCandidate("Alice") ────────►│                          │
  │── addCandidate("Bob") ──────────►│                          │
  │                                  │                          │
  │── startCommitPhase(300s, 300s) ─►│                          │
  │                                  │                          │
  │                                  │◄── commitVote(hash) ─────│
  │                                  │    (vote hidden)         │
  │                                  │                          │
  │                        [300 seconds pass]                   │
  │                                  │                          │
  │                                  │◄── startRevealPhase() ───│
  │                                  │    (anyone can call)     │
  │                                  │                          │
  │                                  │◄── revealVote(id, salt) ─│
  │                                  │    (vote counted)        │
  │                                  │                          │
  │── endElection() ────────────────►│                          │
  │   (via TimelockController)       │                          │
  │                                  │                          │
  │                          Results public on-chain             │
```

### Data Flow

1. **MetaMask** signs transactions with the user's private key
2. **ethers.js** formats and sends transactions to the RPC endpoint
3. **RPC endpoint** (localhost:8545 or Amoy) broadcasts to the blockchain
4. **Smart contracts** execute deterministically and emit events
5. **Frontend** reads state via `eth_call` (free, no gas) every 10 seconds
6. **React state** updates the UI with live blockchain data

### Wallet Connection Flow

```
User clicks "Connect MetaMask"
        │
        ▼
useWallet.connect() called
        │
        ▼
window.ethereum.request("eth_requestAccounts")
        │
        ▼
BrowserProvider created → getSigner() → getNetwork()
        │
        ▼
checkNetwork(chainId):
  31337 → Hardhat Local ✓
  80002 → Polygon Amoy ✓
  others → wrongNetwork = true
        │
        ▼
Contract instances created with signer
        │
        ▼
Admin Dashboard unlocked → fetchData() starts polling
```

---

## 12. Security Features

### 12.1 Commit-Reveal Voting
Prevents front-running and bandwagon effects. During the commit phase, votes are stored as `keccak256(candidateId, salt)`. No one can see which candidate received votes until the reveal phase.

### 12.2 Soulbound Tokens (ERC-5114)
- One SBT per address — prevents double voting at the contract level
- Non-transferable — cannot be sold or borrowed
- On-chain verification — no trusted third party needed

### 12.3 Role-Based Access Control
- `DEFAULT_ADMIN_ROLE` — highest privilege, can grant/revoke roles
- `ELECTION_MANAGER_ROLE` — election operations only
- `TIMELOCK_ROLE` — sensitive finalization (requires governance delay)

### 12.4 TimelockController
- 60-second delay on testnet (24h in production)
- Prevents admin from abruptly ending elections
- All governance actions are publicly queued and verifiable on-chain

### 12.5 State Machine Enforcement
The `inState()` modifier ensures functions can only execute in the correct election phase, preventing out-of-order operations.

### 12.6 STRIDE Threat Model
The project includes a full STRIDE threat model (`STRIDE_THREAT_MODEL.md`) covering:
- **S**poofing — mitigated by wallet-based identity
- **T**ampering — mitigated by blockchain immutability
- **R**epudiation — all actions recorded on-chain with events
- **I**nformation Disclosure — commit phase hides votes
- **D**enial of Service — time-based phase transitions are permissionless
- **E**levation of Privilege — RBAC prevents unauthorised actions

---

## 13. Benefits

| Benefit | Description |
|---|---|
| **Transparency** | All votes and results are publicly verifiable on-chain |
| **Immutability** | Once recorded, votes cannot be altered by anyone |
| **No Central Authority** | No server, no database — just smart contracts |
| **Voter Privacy** | Commit-reveal prevents live vote tallying |
| **Fraud Prevention** | SBTs prevent double voting; RBAC prevents admin abuse |
| **Auditability** | Anyone can replay the blockchain and verify every vote |
| **Accessibility** | Accessible from any device with a browser and MetaMask |
| **Cost Efficiency** | Reading results is free (view functions); only writing costs gas |
| **Interoperability** | ERC-721 standard SBTs work with any NFT tooling |

---

## 14. Use Cases

### 14.1 University Student Elections
Students are issued SBTs to their wallet addresses during registration. They vote for student union candidates through the voter portal. Results are publicly verifiable.

### 14.2 Corporate Board Voting
Board members receive SBTs. Shareholder votes on resolutions are committed privately then revealed simultaneously, preventing coordinated last-minute vote changes.

### 14.3 DAO Governance
Decentralised Autonomous Organisations use this system for on-chain proposal voting. The TimelockController enforces mandatory review periods before decisions execute.

### 14.4 Local Government Polls
Municipal corporations can run ward-level polls with constituency-based voter registration, generating per-region turnout analytics.

### 14.5 Academic Research
Researchers studying blockchain voting systems can use this as a reference implementation with real commit-reveal, RBAC, and SBT patterns.

---

## 15. Deployment (Vercel + Polygon Amoy)

### 15.1 Deploy Contracts to Polygon Amoy Testnet

1. Export MetaMask private key: MetaMask → Account Details → Export Private Key
2. Add to `hardhat/.env`:
   ```
   PRIVATE_KEY=your_private_key_here
   AMOY_RPC_URL=https://rpc-amoy.polygon.technology
   ```
3. Get free test MATIC: https://faucet.polygon.technology/
4. Deploy:
   ```powershell
   cd hardhat
   npm run deploy:amoy
   ```
   Contract addresses auto-written to `frontend/.env.local`

### 15.2 Deploy Frontend to Vercel

1. Push code to GitHub
2. Import repo in Vercel dashboard
3. Set root directory to `frontend/`
4. Add Environment Variables in Vercel:
   ```
   NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS = 0x...
   NEXT_PUBLIC_VOTER_SBT_ADDRESS         = 0x...
   NEXT_PUBLIC_TIMELOCK_ADDRESS          = 0x...
   ```
5. Deploy — Vercel builds and hosts the Next.js app globally via CDN

### 15.3 User Experience on Production
- Users visiting the Vercel URL in any browser
- MetaMask prompts to switch to Polygon Amoy
- "Switch to Amoy" button auto-adds the network
- All interactions go directly to on-chain contracts — no backend server

---

## 16. Testing

### Contract Tests (`hardhat/test/GovernanceAudit.js`)
Test suite covers:
- Role assignment and access control enforcement
- Candidate addition and state transitions
- Commit-reveal voting flow
- SBT minting and transfer prevention
- TimelockController governance workflow

Run tests:
```powershell
cd hardhat
npm test
```

Run coverage report:
```powershell
npm run coverage
```

---

## 17. Future Scope

| Feature | Description |
|---|---|
| **Zero-Knowledge Proofs** | Use ZK-SNARKs (Circom) to prove vote validity without revealing the vote |
| **DigiLocker Integration** | Verify Indian voter identity via DigiLocker API before minting SBT |
| **IPFS Ballot Receipts** | Pin ballot proof documents to IPFS via Pinata for permanent receipt |
| **Biometric 2FA** | Add WebAuthn biometric verification before vote submission |
| **Multi-Election Support** | Factory pattern to deploy independent elections simultaneously |
| **Mobile App** | React Native app with WalletConnect integration |
| **Cross-Chain** | Deploy on multiple chains using LayerZero or Chainlink CCIP |
| **Quadratic Voting** | Allow token-weighted voting for DAO governance proposals |

---

## 18. Conclusion

This project successfully demonstrates a production-grade blockchain-based e-voting system that addresses the fundamental problems of traditional voting: transparency, fraud prevention, and auditability. By combining Soulbound Tokens for identity, commit-reveal for privacy, and OpenZeppelin's battle-tested access control and governance libraries, the system achieves a high security standard suitable for real-world deployment.

The modern Next.js frontend with MetaMask integration makes the system accessible to non-technical users while maintaining all the trust guarantees of the underlying blockchain. The automated deployment scripts (deploy.js auto-writing .env.local, grant-roles.js, fund-accounts.js) reduce developer friction and demonstrate engineering maturity.

---

## 19. References

1. Nakamoto, S. (2008). *Bitcoin: A Peer-to-Peer Electronic Cash System*
2. Wood, G. (2014). *Ethereum: A Secure Decentralised Generalised Transaction Ledger*
3. OpenZeppelin. *OpenZeppelin Contracts Documentation*. https://docs.openzeppelin.com/contracts
4. Polygon. *Polygon Amoy Testnet Documentation*. https://polygon.technology/
5. Ethereum Improvement Proposal 5114 — Soulbound Tokens
6. Hardhat. *Hardhat Documentation*. https://hardhat.org/docs
7. Next.js. *Next.js App Router Documentation*. https://nextjs.org/docs
8. ethers.js. *ethers.js v6 Documentation*. https://docs.ethers.org/v6/
9. Buterin, V., Weyl, E.G., Ohlhaver, P. (2022). *Decentralized Society: Finding Web3's Soul*
10. NIST. *Security Considerations for Electronic Voting*

---

*Document prepared for Major Project submission.*
*System: Decentralised E-Voting Using Blockchain*
*Stack: Solidity · Hardhat · Next.js · ethers.js · Polygon Amoy*
