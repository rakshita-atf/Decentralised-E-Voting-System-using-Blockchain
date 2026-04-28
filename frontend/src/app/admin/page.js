"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PlusCircle,
  Shield,
  Settings,
  Activity,
  UserPlus,
  Clock,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { ethers } from "ethers";
import ElectionABI from "../../contracts/ElectionABI.json";
import VoterSBTABI from "../../contracts/VoterSBTABI.json";
import { useWallet, WrongNetworkBanner } from "../../hooks/useWallet";

// ──────────────────────────────────────────────
// State labels
// ──────────────────────────────────────────────
const STATE_LABELS = ["Not Started", "Commit Phase", "Reveal Phase", "Ended"];
const STATE_COLORS = ["text-slate-400", "text-yellow-400", "text-blue-400", "text-green-400"];

export default function AdminDashboard() {
  const { account, wrongNetwork, networkName, signer } = useWallet();

  // ── Contract state ──
  const [electionContract, setElectionContract] = useState(null);
  const [sbtContract, setSbtContract] = useState(null);
  const [electionState, setElectionState] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [timeline, setTimeline] = useState({ commitDeadline: 0, revealDeadline: 0, totalCommits: 0, totalVotes: 0 });
  const [totalVoters, setTotalVoters] = useState(0);

  // ── Form state ──
  const [newCandidateName, setNewCandidateName] = useState("");
  const [newCandidateImage, setNewCandidateImage] = useState("");
  const [voterAddress, setVoterAddress] = useState("");
  const [voterConstituency, setVoterConstituency] = useState("");
  const [commitDuration, setCommitDuration] = useState("300"); // 5 min default for testing
  const [revealDuration, setRevealDuration] = useState("300");

  // ── UI state ──
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const ELECTION_ADDRESS = process.env.NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS;
  const SBT_ADDRESS = process.env.NEXT_PUBLIC_VOTER_SBT_ADDRESS;

  // ── Initialize contracts ──
  useEffect(() => {
    if (!signer || wrongNetwork) return;
    if (!ELECTION_ADDRESS || ELECTION_ADDRESS === "0x0000000000000000000000000000000000000000") return;

    try {
      const election = new ethers.Contract(ELECTION_ADDRESS, ElectionABI, signer);
      setElectionContract(election);

      if (SBT_ADDRESS && SBT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
        const sbt = new ethers.Contract(SBT_ADDRESS, VoterSBTABI, signer);
        setSbtContract(sbt);
      }
    } catch (err) {
      console.error("Init error:", err);
    }
  }, [signer, wrongNetwork, ELECTION_ADDRESS, SBT_ADDRESS]);

  // ── Fetch election data ──
  const fetchData = useCallback(async () => {
    if (!electionContract) return;
    try {
      const tl = await electionContract.getElectionTimeline();
      setElectionState(Number(tl.currentState));
      setTimeline({
        commitDeadline: Number(tl._commitDeadline),
        revealDeadline: Number(tl._revealDeadline),
        totalCommits: Number(tl._totalCommits),
        totalVotes: Number(tl._totalVotes),
      });

      const count = Number(await electionContract.candidatesCount());
      const arr = [];
      for (let i = 1; i <= count; i++) {
        const c = await electionContract.getCandidate(i);
        arr.push({ id: Number(c.id), name: c.name, imageCID: c.imageCID, voteCount: Number(c.voteCount) });
      }
      setCandidates(arr);

      if (sbtContract) {
        setTotalVoters(Number(await sbtContract.totalVoters()));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [electionContract, sbtContract]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Helpers ──
  const showMsg = (type, msg) => {
    if (type === "error") { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(() => { setError(""); setSuccess(""); }, 5000);
  };

  const txAction = async (label, fn) => {
    setLoading(label);
    try {
      const tx = await fn();
      await tx.wait();
      showMsg("success", `${label} successful!`);
      await fetchData();
    } catch (err) {
      console.error(`${label} error:`, err);
      showMsg("error", err.reason || err.message || `${label} failed`);
    }
    setLoading("");
  };

  // ── Actions ──
  const handleAddCandidate = (e) => {
    e.preventDefault();
    if (!newCandidateName.trim()) return;
    txAction("Add Candidate", () =>
      electionContract.addCandidate(newCandidateName, newCandidateImage || "none")
    ).then(() => { setNewCandidateName(""); setNewCandidateImage(""); });
  };

  const handleMintSBT = (e) => {
    e.preventDefault();
    if (!ethers.isAddress(voterAddress)) { showMsg("error", "Invalid wallet address"); return; }
    txAction("Mint Voter SBT", () =>
      sbtContract.mintVoterToken(voterAddress, voterConstituency || "Unassigned")
    ).then(() => { setVoterAddress(""); setVoterConstituency(""); });
  };

  const handleStartCommit = () => {
    txAction("Start Commit Phase", () =>
      electionContract.startCommitPhase(parseInt(commitDuration), parseInt(revealDuration))
    );
  };

  const handleStartReveal = () => {
    txAction("Start Reveal Phase", () => electionContract.startRevealPhase());
  };

  const handleEndElection = () => {
    txAction("End Election", () => electionContract.endElection());
  };

  // ── Countdown helper ──
  const formatCountdown = (deadline) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = deadline - now;
    if (diff <= 0) return "Ended";
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}m ${s}s remaining`;
  };

  // ════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto">
      {wrongNetwork && <WrongNetworkBanner networkName={networkName} />}
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center">
            <Shield className="w-8 h-8 mr-3 text-indigo-400" />
            Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Manage elections, candidates, voter SBTs, and governance.</p>
          {account && (
            <p className="text-xs text-indigo-300 mt-1 font-mono">
              Connected: {account.slice(0, 6)}...{account.slice(-4)}
            </p>
          )}
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors"
        >
          Back to Home
        </Link>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 flex items-center bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-center bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-green-400 text-sm">
          <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Election State", value: STATE_LABELS[electionState], color: STATE_COLORS[electionState] },
          { label: "Registered Voters", value: totalVoters, color: "text-purple-400" },
          { label: "Commits", value: timeline.totalCommits, color: "text-yellow-400" },
          { label: "Revealed Votes", value: timeline.totalVotes, color: "text-green-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-1 space-y-6">
          {/* Election Controls */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-slate-400" />
              Election Controls
            </h2>

            {/* Timeline Display */}
            {electionState > 0 && (
              <div className="mb-4 p-3 bg-black/20 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Commit Deadline</span>
                  <span className="text-yellow-400">{timeline.commitDeadline > 0 ? formatCountdown(timeline.commitDeadline) : "—"}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="flex items-center"><Timer className="w-3 h-3 mr-1" /> Reveal Deadline</span>
                  <span className="text-blue-400">{timeline.revealDeadline > 0 ? formatCountdown(timeline.revealDeadline) : "—"}</span>
                </div>
              </div>
            )}

            {/* Phase-specific controls */}
            <div className="space-y-3">
              {electionState === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Commit (sec)</label>
                      <input type="number" value={commitDuration} onChange={(e) => setCommitDuration(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Reveal (sec)</label>
                      <input type="number" value={revealDuration} onChange={(e) => setRevealDuration(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                  <button onClick={handleStartCommit} disabled={!!loading || candidates.length === 0}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50 flex items-center justify-center">
                    {loading === "Start Commit Phase" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Start Commit Phase
                  </button>
                </>
              )}

              {electionState === 1 && (
                <button onClick={handleStartReveal} disabled={!!loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 flex items-center justify-center">
                  {loading === "Start Reveal Phase" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Start Reveal Phase
                </button>
              )}

              {electionState === 2 && (
                <button onClick={handleEndElection} disabled={!!loading}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center">
                  {loading === "End Election" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  End Election (Timelock)
                </button>
              )}

              {electionState === 3 && (
                <div className="text-center py-4 text-green-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 mr-2" /> Election Concluded
                </div>
              )}
            </div>
          </div>

          {/* Add Candidate */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-slate-400" />
              Add Candidate
            </h2>
            <form onSubmit={handleAddCandidate} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Candidate Name</label>
                <input type="text" value={newCandidateName} onChange={(e) => setNewCandidateName(e.target.value)}
                  disabled={!!loading || electionState !== 0}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  placeholder="e.g., Alice Smith" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Image CID (optional)</label>
                <input type="text" value={newCandidateImage} onChange={(e) => setNewCandidateImage(e.target.value)}
                  disabled={!!loading || electionState !== 0}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  placeholder="QmHash..." />
              </div>
              <button type="submit" disabled={!!loading || electionState !== 0}
                className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center text-sm">
                {loading === "Add Candidate" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add to Ballot
              </button>
            </form>
          </div>

          {/* Mint Voter SBT */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <UserPlus className="w-5 h-5 mr-2 text-purple-400" />
              Register Voter (Mint SBT)
            </h2>
            <form onSubmit={handleMintSBT} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Wallet Address</label>
                <input type="text" value={voterAddress} onChange={(e) => setVoterAddress(e.target.value)}
                  disabled={!!loading || !sbtContract}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  placeholder="0x..." />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Constituency / Region</label>
                <select value={voterConstituency} onChange={(e) => setVoterConstituency(e.target.value)}
                  disabled={!!loading || !sbtContract}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50">
                  <option value="">Select Region</option>
                  <option value="Delhi-North">Delhi-North</option>
                  <option value="Delhi-South">Delhi-South</option>
                  <option value="Mumbai-North">Mumbai-North</option>
                  <option value="Mumbai-South">Mumbai-South</option>
                  <option value="Kolkata-Central">Kolkata-Central</option>
                  <option value="Chennai-East">Chennai-East</option>
                  <option value="Bengaluru-West">Bengaluru-West</option>
                  <option value="Hyderabad-Central">Hyderabad-Central</option>
                </select>
              </div>
              <button type="submit" disabled={!!loading || !sbtContract}
                className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/20 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center text-sm">
                {loading === "Mint Voter SBT" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Mint Soulbound Token
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Candidate Ballot */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-slate-400" />
              Current Ballot
              <span className="ml-auto text-xs text-slate-500">{candidates.length} candidate(s)</span>
            </h2>

            {candidates.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-xl">
                No candidates added yet. Add candidates before starting the election.
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate, idx) => {
                  const pct = timeline.totalVotes > 0 ? (candidate.voteCount / timeline.totalVotes) * 100 : 0;
                  return (
                    <div key={candidate.id} className="p-4 bg-black/20 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold mr-4 shadow-lg text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="text-white font-medium">{candidate.name}</span>
                            {candidate.imageCID && candidate.imageCID !== "none" && (
                              <p className="text-xs text-slate-500 font-mono">{candidate.imageCID.slice(0, 16)}...</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-white">{candidate.voteCount}</span>
                          <span className="text-xs text-slate-500 ml-1">votes</span>
                          {timeline.totalVotes > 0 && (
                            <p className="text-xs text-slate-400">{pct.toFixed(1)}%</p>
                          )}
                        </div>
                      </div>
                      {/* Vote bar */}
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phase Timeline Visualization */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-slate-400" />
              Election Phase Timeline
            </h2>
            <div className="flex items-center gap-0">
              {["Not Started", "Commit", "Reveal", "Ended"].map((phase, idx) => (
                <div key={phase} className="flex-1 flex flex-col items-center relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all z-10 ${
                    idx <= electionState
                      ? "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                      : "bg-white/5 border-white/10 text-slate-500"
                  }`}>
                    {idx < electionState ? "✓" : idx + 1}
                  </div>
                  <span className={`text-xs mt-2 ${idx === electionState ? "text-indigo-300 font-semibold" : "text-slate-500"}`}>
                    {phase}
                  </span>
                  {idx < 3 && (
                    <div className={`absolute top-4 left-[calc(50%+16px)] w-[calc(100%-32px)] h-0.5 ${
                      idx < electionState ? "bg-indigo-500" : "bg-white/10"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
