"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Vote,
  Fingerprint,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Eye,
  Loader2,
  AlertTriangle,
  Hash,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { ethers } from "ethers";
import ElectionABI from "../../contracts/ElectionABI.json";
import VoterSBTABI from "../../contracts/VoterSBTABI.json";
import { useWallet, WrongNetworkBanner } from "../../hooks/useWallet";

const STATE_LABELS = ["Not Started", "Commit Phase", "Reveal Phase", "Ended"];

export default function VoterPortal() {
  const { account, wrongNetwork, networkName, signer } = useWallet();

  // ── Contract state ──
  const [electionContract, setElectionContract] = useState(null);
  const [sbtContract, setSbtContract] = useState(null);
  const [isEligible, setIsEligible] = useState(false);
  const [constituency, setConstituency] = useState("");
  const [electionState, setElectionState] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [timeline, setTimeline] = useState({ commitDeadline: 0, revealDeadline: 0 });

  // ── Voting state ──
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [hasCommitted, setHasCommitted] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [commitSalt, setCommitSalt] = useState(null);
  const [commitCandidateId, setCommitCandidateId] = useState(null);

  // ── UI state ──
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copiedSalt, setCopiedSalt] = useState(false);

  const ELECTION_ADDRESS = process.env.NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS;
  const SBT_ADDRESS = process.env.NEXT_PUBLIC_VOTER_SBT_ADDRESS;

  // ── Initialize ──
  useEffect(() => {
    const init = async () => {
      if (!signer || wrongNetwork) return;
      if (!ELECTION_ADDRESS || ELECTION_ADDRESS === "0x0000000000000000000000000000000000000000") return;

      try {
        const addr = account;

        const election = new ethers.Contract(ELECTION_ADDRESS, ElectionABI, signer);
        setElectionContract(election);

        if (SBT_ADDRESS && SBT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
          const sbt = new ethers.Contract(SBT_ADDRESS, VoterSBTABI, signer);
          setSbtContract(sbt);

          const eligible = await sbt.isEligible(addr);
          setIsEligible(eligible);
          if (eligible) {
            setConstituency(await sbt.voterConstituency(addr));
          }
        }

        const committed = await election.hasCommitted(addr);
        setHasCommitted(committed);
        if (committed) {
          const revealed = await election.hasRevealed(addr);
          setHasRevealed(revealed);
        }

        const savedData = localStorage.getItem(`vote_${ELECTION_ADDRESS}_${addr}`);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          setCommitSalt(parsed.salt);
          setCommitCandidateId(parsed.candidateId);
        }
      } catch (err) {
        console.error("Init error:", err);
      }
    };
    init();
  }, [account, signer, wrongNetwork, ELECTION_ADDRESS, SBT_ADDRESS]);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!electionContract) return;
    try {
      const tl = await electionContract.getElectionTimeline();
      setElectionState(Number(tl.currentState));
      setTimeline({
        commitDeadline: Number(tl._commitDeadline),
        revealDeadline: Number(tl._revealDeadline),
      });

      const count = Number(await electionContract.candidatesCount());
      const arr = [];
      for (let i = 1; i <= count; i++) {
        const c = await electionContract.getCandidate(i);
        arr.push({ id: Number(c.id), name: c.name, voteCount: Number(c.voteCount) });
      }
      setCandidates(arr);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [electionContract]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Commit Vote ──
  const handleCommitVote = async () => {
    if (!selectedCandidate || !electionContract) return;
    setLoading("commit");
    setError("");

    try {
      // Generate cryptographic salt
      const salt = ethers.hexlify(ethers.randomBytes(32));
      const commitHash = ethers.solidityPackedKeccak256(
        ["uint256", "bytes32"],
        [selectedCandidate, salt]
      );

      const tx = await electionContract.commitVote(commitHash);
      await tx.wait();

      // Save salt securely in localStorage (voter needs it for reveal)
      localStorage.setItem(
        `vote_${ELECTION_ADDRESS}_${account}`,
        JSON.stringify({ salt, candidateId: selectedCandidate })
      );

      setCommitSalt(salt);
      setCommitCandidateId(selectedCandidate);
      setHasCommitted(true);
      setTxHash(tx.hash);
      setSuccess("Vote committed! Save your salt — you'll need it to reveal.");
    } catch (err) {
      console.error("Commit error:", err);
      setError(err.reason || err.message || "Failed to commit vote");
    }
    setLoading("");
  };

  // ── Reveal Vote ──
  const handleRevealVote = async () => {
    if (!commitSalt || !commitCandidateId || !electionContract) return;
    setLoading("reveal");
    setError("");

    try {
      // Generate a mock ballot proof CID (in production, this would go through Pinata)
      const ballotProofCID = "QmBallotProof_" + account.slice(2, 10);

      const tx = await electionContract.revealVote(
        commitCandidateId,
        commitSalt,
        ballotProofCID
      );
      await tx.wait();

      setHasRevealed(true);
      setTxHash(tx.hash);
      setSuccess("Vote revealed and tallied successfully!");
      localStorage.removeItem(`vote_${ELECTION_ADDRESS}_${account}`);
      await fetchData();
    } catch (err) {
      console.error("Reveal error:", err);
      setError(err.reason || err.message || "Failed to reveal vote");
    }
    setLoading("");
  };

  // ── Copy salt helper ──
  const copySalt = () => {
    if (commitSalt) {
      navigator.clipboard.writeText(commitSalt);
      setCopiedSalt(true);
      setTimeout(() => setCopiedSalt(false), 2000);
    }
  };

  // ── Countdown ──
  const formatCountdown = (deadline) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = deadline - now;
    if (diff <= 0) return "Phase ended";
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}m ${s}s`;
  };

  // ════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto flex flex-col">
      {wrongNetwork && <WrongNetworkBanner networkName={networkName} />}
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center">
            <Vote className="w-8 h-8 mr-3 text-pink-400" />
            Voter Portal
          </h1>
          <p className="text-slate-400 mt-1">Commit-reveal voting with soulbound identity.</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors">
          Back to Home
        </Link>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 flex items-center bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-center bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-green-400 text-sm">
          <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />{success}
        </div>
      )}

      <div className="flex-grow flex items-start justify-center">
        <div className="w-full max-w-xl bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl" />

          {/* ── Not eligible ── */}
          {!isEligible && account && (
            <div className="relative z-10 text-center py-8">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Not Eligible</h2>
              <p className="text-slate-400">You don&apos;t hold a Voter Soulbound Token. Contact the election administrator to register.</p>
              <p className="text-xs text-slate-500 font-mono mt-4">{account}</p>
            </div>
          )}

          {/* ── Election not started ── */}
          {isEligible && electionState === 0 && (
            <div className="relative z-10 text-center py-8">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Clock className="w-8 h-8 text-slate-300" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Election Not Started</h2>
              <p className="text-slate-400">The election has not begun yet. Please wait for the admin to start the commit phase.</p>
              <div className="mt-4 flex items-center justify-center bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-green-400 text-sm">
                <ShieldCheck className="w-4 h-4 mr-2" />
                SBT Verified — {constituency}
              </div>
            </div>
          )}

          {/* ── Commit Phase ── */}
          {isEligible && electionState === 1 && !hasCommitted && (
            <div className="relative z-10">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full text-green-400 text-xs">
                    <ShieldCheck className="w-3 h-3 mr-1" /> SBT Verified — {constituency}
                  </div>
                  <span className="text-xs text-yellow-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatCountdown(timeline.commitDeadline)}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-white mt-3">
                  <Lock className="w-5 h-5 inline mr-2 text-yellow-400" />
                  Phase 1: Commit Your Vote
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Your vote is hashed with a secret salt. Nobody can see your choice until the reveal phase.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {candidates.map((candidate) => (
                  <label
                    key={candidate.id}
                    className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedCandidate === candidate.id
                        ? "bg-pink-500/20 border-pink-500 shadow-[0_0_15px_rgba(219,39,119,0.2)]"
                        : "bg-black/20 border-white/10 hover:bg-white/5"
                    }`}
                  >
                    <input type="radio" name="candidate" className="hidden"
                      checked={selectedCandidate === candidate.id}
                      onChange={() => setSelectedCandidate(candidate.id)} />
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-4 ${
                      selectedCandidate === candidate.id ? "border-pink-500" : "border-slate-500"
                    }`}>
                      {selectedCandidate === candidate.id && <div className="w-3 h-3 bg-pink-500 rounded-full" />}
                    </div>
                    <span className="text-white font-medium">{candidate.name}</span>
                  </label>
                ))}
              </div>

              <button onClick={handleCommitVote} disabled={!selectedCandidate || !!loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] disabled:opacity-50 disabled:shadow-none flex items-center justify-center">
                {loading === "commit" ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Hash className="w-5 h-5 mr-2" />}
                Commit Encrypted Vote
              </button>
            </div>
          )}

          {/* ── Committed — waiting for reveal phase ── */}
          {isEligible && electionState === 1 && hasCommitted && !hasRevealed && (
            <div className="relative z-10 text-center py-6">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
                <Lock className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Vote Committed!</h2>
              <p className="text-slate-400 mb-4">Your encrypted vote is on-chain. Wait for the reveal phase to finalize.</p>

              {commitSalt && (
                <div className="bg-black/30 border border-white/5 rounded-lg p-4 text-left mb-4">
                  <p className="text-xs text-slate-500 mb-1">Your Secret Salt (save this!):</p>
                  <div className="flex items-center">
                    <code className="text-xs text-yellow-400 font-mono break-all flex-1">{commitSalt}</code>
                    <button onClick={copySalt} className="ml-2 p-1 hover:bg-white/10 rounded transition-colors">
                      <Copy className={`w-4 h-4 ${copiedSalt ? "text-green-400" : "text-slate-400"}`} />
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500">
                Reveal phase begins: {new Date(timeline.commitDeadline * 1000).toLocaleString()}
              </p>
            </div>
          )}

          {/* ── Reveal Phase — ready to reveal ── */}
          {isEligible && electionState === 2 && hasCommitted && !hasRevealed && (
            <div className="relative z-10">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-blue-400 flex items-center">
                    <Eye className="w-3 h-3 mr-1" /> Reveal Phase Active
                  </span>
                  <span className="text-xs text-blue-400">
                    {formatCountdown(timeline.revealDeadline)}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-white mt-3">
                  <Eye className="w-5 h-5 inline mr-2 text-blue-400" />
                  Phase 2: Reveal Your Vote
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Your vote and salt are sent to the contract, which verifies they match your commitment.
                </p>
              </div>

              {commitCandidateId && (
                <div className="bg-black/20 border border-white/10 rounded-xl p-4 mb-6">
                  <p className="text-xs text-slate-500 mb-1">Your committed vote:</p>
                  <p className="text-white font-medium">
                    Candidate #{commitCandidateId} — {candidates.find(c => c.id === commitCandidateId)?.name || "Unknown"}
                  </p>
                </div>
              )}

              <button onClick={handleRevealVote} disabled={!!loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50 flex items-center justify-center">
                {loading === "reveal" ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Eye className="w-5 h-5 mr-2" />}
                Reveal & Verify Vote
              </button>
            </div>
          )}

          {/* ── Vote Revealed (success) ── */}
          {isEligible && hasRevealed && (
            <div className="relative z-10 text-center py-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Vote Counted!</h2>
              <p className="text-slate-300 mb-6">
                Your commitment was verified on-chain and your vote has been tallied. It is immutable and verifiable.
              </p>

              {txHash && (
                <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-left text-slate-400 break-all mb-6">
                  <span className="text-indigo-400 font-semibold block mb-1">Transaction Hash:</span>
                  {txHash}
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Link href="/verify" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors">
                  Verify My Vote
                </Link>
                <Link href="/" className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium transition-colors">
                  Home
                </Link>
              </div>
            </div>
          )}

          {/* ── Election ended ── */}
          {isEligible && electionState === 3 && !hasRevealed && (
            <div className="relative z-10 text-center py-8">
              <h2 className="text-2xl font-bold text-white mb-2">Election Ended</h2>
              <p className="text-slate-400">The election has concluded. View the results page for final tallies.</p>
              <Link href="/results" className="inline-block mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors">
                View Results
              </Link>
            </div>
          )}

          {/* ── No wallet ── */}
          {!account && (
            <div className="relative z-10 text-center py-8">
              <Fingerprint className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
              <p className="text-slate-400">Go to the home page and connect MetaMask to access the voter portal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
