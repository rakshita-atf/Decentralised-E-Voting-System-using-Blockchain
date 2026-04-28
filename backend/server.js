const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const { ethers } = require("ethers");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-zkp-key";
const PINATA_JWT = process.env.PINATA_JWT || "";
const ELECTION_ADDRESS = process.env.ELECTION_CONTRACT_ADDRESS || "";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

// ──────────────────────────────────────────────
// In-memory mock KYC database (DigiLocker simulation)
// ──────────────────────────────────────────────
const mockDigiLockerDB = {
  "123456789012": { name: "Alice Smith", isVerified: true },
  "987654321098": { name: "Bob Jones", isVerified: true },
  "111111111111": { name: "Charlie Brown", isVerified: true },
  "222222222222": { name: "Diana Prince", isVerified: true },
};

// ──────────────────────────────────────────────
// KYC Routes
// ──────────────────────────────────────────────

app.post("/api/kyc/send-otp", (req, res) => {
  const { aadhaarNumber } = req.body;

  if (!aadhaarNumber || aadhaarNumber.length !== 12) {
    return res.status(400).json({ error: "Invalid Aadhaar Number (must be 12 digits)" });
  }
  if (!mockDigiLockerDB[aadhaarNumber]) {
    return res.status(404).json({ error: "Identity not found in DigiLocker Database" });
  }

  console.log(`[DigiLocker API] Sending OTP "1234" for ${aadhaarNumber}`);
  res.json({ message: "OTP sent successfully", success: true });
});

app.post("/api/kyc/verify-otp", (req, res) => {
  const { aadhaarNumber, otp, walletAddress } = req.body;

  if (otp !== "1234") {
    return res.status(401).json({ error: "Invalid OTP" });
  }
  if (!walletAddress) {
    return res.status(400).json({ error: "Wallet address required" });
  }

  const userData = mockDigiLockerDB[aadhaarNumber];
  const token = jwt.sign(
    { kycId: aadhaarNumber, wallet: walletAddress, verifiedAt: new Date().toISOString() },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  console.log(`[Identity] Verified ${userData.name} → ${walletAddress}`);
  res.json({ success: true, voterToken: token, name: userData.name });
});

// ──────────────────────────────────────────────
// Ballot Proof Pinning (Pinata IPFS)
// ──────────────────────────────────────────────

app.post("/api/ballot/pin", async (req, res) => {
  const { voterAddress, electionId, candidateId, txHash } = req.body;

  if (!voterAddress || !txHash) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Create the ballot receipt
  const receipt = {
    hashedVoter: crypto.createHash("sha256").update(voterAddress.toLowerCase()).digest("hex"),
    timestamp: new Date().toISOString(),
    electionId: electionId || "default",
    voteHash: crypto.createHash("sha256").update(`${candidateId}:${txHash}`).digest("hex"),
    txHash: txHash,
    schema: "evoting-ballot-proof-v1",
  };

  // If Pinata JWT is configured, pin to IPFS
  if (PINATA_JWT) {
    try {
      const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
          pinataContent: receipt,
          pinataMetadata: { name: `ballot-proof-${receipt.hashedVoter.slice(0, 8)}` },
        }),
      });

      const data = await response.json();
      console.log(`[Pinata] Pinned ballot proof: ${data.IpfsHash}`);
      return res.json({ success: true, cid: data.IpfsHash, receipt });
    } catch (err) {
      console.error("[Pinata] Error:", err.message);
    }
  }

  // Fallback: return a mock CID for local development
  const mockCID = "Qm" + crypto.createHash("sha256").update(JSON.stringify(receipt)).digest("hex").slice(0, 44);
  console.log(`[Mock IPFS] Generated mock CID: ${mockCID}`);
  res.json({ success: true, cid: mockCID, receipt, mock: true });
});

// Fetch a ballot proof by CID
app.get("/api/ballot/:cid", async (req, res) => {
  const { cid } = req.params;

  // Try fetching from IPFS gateway
  try {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (response.ok) {
      const data = await response.json();
      return res.json({ success: true, receipt: data });
    }
  } catch (err) {
    // Gateway unavailable
  }

  res.status(404).json({ error: "Ballot proof not found. CID may be invalid or IPFS gateway is unavailable." });
});

// ──────────────────────────────────────────────
// WebSocket Event Feed (Socket.io)
// ──────────────────────────────────────────────

let electionContract = null;

function initEventListener() {
  if (!ELECTION_ADDRESS || ELECTION_ADDRESS === "0x0000000000000000000000000000000000000000") {
    console.log("[WebSocket] No election address configured, skipping event listener.");
    return;
  }

  try {
    // Load ABI
    let ElectionABI;
    try {
      ElectionABI = require("../hardhat/artifacts/contracts/Election.sol/Election.json").abi;
    } catch {
      console.log("[WebSocket] Election ABI not found, skipping.");
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    electionContract = new ethers.Contract(ELECTION_ADDRESS, ElectionABI, provider);

    // Listen for VoteCommitted
    electionContract.on("VoteCommitted", (voter) => {
      const event = {
        type: "VoteCommitted",
        voter: voter,
        timestamp: Date.now(),
      };
      console.log(`[Event] VoteCommitted by ${voter}`);
      io.emit("election-event", event);
    });

    // Listen for VoteRevealed
    electionContract.on("VoteRevealed", (voter, candidateId, ballotProofCID) => {
      const event = {
        type: "VoteRevealed",
        voter: voter,
        candidateId: Number(candidateId),
        ballotProofCID: ballotProofCID,
        timestamp: Date.now(),
      };
      console.log(`[Event] VoteRevealed by ${voter} for candidate #${candidateId}`);
      io.emit("election-event", event);
    });

    // Listen for ElectionStateChanged
    electionContract.on("ElectionStateChanged", (newState) => {
      const states = ["NotStarted", "CommitPhase", "RevealPhase", "Ended"];
      const event = {
        type: "ElectionStateChanged",
        newState: Number(newState),
        stateName: states[Number(newState)] || "Unknown",
        timestamp: Date.now(),
      };
      console.log(`[Event] Election state → ${event.stateName}`);
      io.emit("election-event", event);
    });

    // Listen for CandidateAdded
    electionContract.on("CandidateAdded", (candidateId, name, imageCID) => {
      const event = {
        type: "CandidateAdded",
        candidateId: Number(candidateId),
        name: name,
        timestamp: Date.now(),
      };
      console.log(`[Event] Candidate added: ${name}`);
      io.emit("election-event", event);
    });

    console.log(`[WebSocket] Listening to Election events at ${ELECTION_ADDRESS}`);
  } catch (err) {
    console.error("[WebSocket] Error setting up event listener:", err.message);
  }
}

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ──────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    status: "Identity & Event API Online",
    websocket: !!electionContract,
    pinata: !!PINATA_JWT,
  });
});

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] WebSocket ready for connections`);
  initEventListener();
});
