"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart3,
  Activity,
  Radio,
  TrendingUp,
  Users,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { ethers } from "ethers";
import { io } from "socket.io-client";
import ElectionABI from "../../contracts/ElectionABI.json";

const STATE_LABELS = ["Not Started", "Commit Phase", "Reveal Phase", "Ended"];

export default function ResultsPage() {
  const [candidates, setCandidates] = useState([]);
  const [electionState, setElectionState] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [totalCommits, setTotalCommits] = useState(0);
  const [events, setEvents] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const socketRef = useRef(null);
  const maxEvents = 50;

  const ELECTION_ADDRESS = process.env.NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS;
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  // ── Fetch on-chain data ──
  const fetchData = useCallback(async () => {
    if (!ELECTION_ADDRESS || ELECTION_ADDRESS === "0x0000000000000000000000000000000000000000") return;
    if (typeof window.ethereum === "undefined") return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(ELECTION_ADDRESS, ElectionABI, provider);

      const tl = await contract.getElectionTimeline();
      setElectionState(Number(tl.currentState));
      setTotalCommits(Number(tl._totalCommits));
      setTotalVotes(Number(tl._totalVotes));

      const count = Number(await contract.candidatesCount());
      const arr = [];
      for (let i = 1; i <= count; i++) {
        const c = await contract.getCandidate(i);
        arr.push({ id: Number(c.id), name: c.name, voteCount: Number(c.voteCount) });
      }
      setCandidates(arr);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [ELECTION_ADDRESS]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Socket.io live feed ──
  useEffect(() => {
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsLive(true);
    });

    socket.on("disconnect", () => {
      setIsLive(false);
    });

    socket.on("election-event", (event) => {
      setEvents((prev) => [event, ...prev].slice(0, maxEvents));

      // Refresh data on relevant events
      if (event.type === "VoteRevealed" || event.type === "ElectionStateChanged") {
        fetchData();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [BACKEND_URL, fetchData]);

  // ── Find winner ──
  const maxVotes = Math.max(...candidates.map((c) => c.voteCount), 0);
  const winner = candidates.find((c) => c.voteCount === maxVotes && maxVotes > 0);

  // ── Gradient colors for bars ──
  const barColors = [
    "from-indigo-500 to-purple-500",
    "from-pink-500 to-rose-500",
    "from-cyan-500 to-blue-500",
    "from-amber-500 to-orange-500",
    "from-emerald-500 to-green-500",
    "from-violet-500 to-fuchsia-500",
  ];

  // ── Event icon/color mapping ──
  const eventStyles = {
    VoteCommitted: { icon: "🔒", color: "text-yellow-400", label: "Vote Committed" },
    VoteRevealed: { icon: "✅", color: "text-green-400", label: "Vote Revealed" },
    ElectionStateChanged: { icon: "⚡", color: "text-blue-400", label: "Phase Change" },
    CandidateAdded: { icon: "👤", color: "text-purple-400", label: "Candidate Added" },
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center">
            <BarChart3 className="w-8 h-8 mr-3 text-emerald-400" />
            Election Results
          </h1>
          <p className="text-slate-400 mt-1">Live results and real-time event feed.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center text-xs px-3 py-1 rounded-full border ${
            isLive ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <Radio className={`w-3 h-3 mr-1 ${isLive ? "animate-pulse" : ""}`} />
            {isLive ? "LIVE" : "OFFLINE"}
          </div>
          <Link href="/" className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors">
            Home
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Activity, label: "Status", value: STATE_LABELS[electionState], color: "text-indigo-400" },
          { icon: Users, label: "Commits", value: totalCommits, color: "text-yellow-400" },
          { icon: TrendingUp, label: "Votes Revealed", value: totalVotes, color: "text-green-400" },
          { icon: Clock, label: "Candidates", value: candidates.length, color: "text-purple-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center text-xs text-slate-500 mb-1">
              <stat.icon className="w-3 h-3 mr-1" />{stat.label}
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vote Tallies */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white mb-6">Vote Tally</h2>

          {candidates.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No candidates registered yet.</div>
          ) : (
            <div className="space-y-5">
              {candidates
                .sort((a, b) => b.voteCount - a.voteCount)
                .map((candidate, idx) => {
                  const pct = totalVotes > 0 ? (candidate.voteCount / totalVotes) * 100 : 0;
                  const isWinner = winner && candidate.id === winner.id && electionState === 3;
                  return (
                    <div key={candidate.id} className={`relative ${isWinner ? "ring-2 ring-green-500/50 rounded-xl" : ""}`}>
                      {isWinner && (
                        <span className="absolute -top-2 right-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold z-10">
                          🏆 WINNER
                        </span>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${barColors[idx % barColors.length]} flex items-center justify-center text-white font-bold text-sm mr-3 shadow-lg`}>
                            {idx + 1}
                          </div>
                          <span className="text-white font-medium">{candidate.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-bold">{candidate.voteCount}</span>
                          <span className="text-xs text-slate-500 ml-1">({pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${barColors[idx % barColors.length]} rounded-full transition-all duration-1000 ease-out`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Live Event Feed */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Radio className={`w-4 h-4 mr-2 ${isLive ? "text-green-400 animate-pulse" : "text-slate-500"}`} />
            Live Feed
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Waiting for events...
              </div>
            ) : (
              events.map((event, idx) => {
                const style = eventStyles[event.type] || { icon: "📌", color: "text-slate-400", label: event.type };
                return (
                  <div
                    key={idx}
                    className="p-3 bg-black/20 rounded-lg border border-white/5 text-sm animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium ${style.color}`}>
                        {style.icon} {style.label}
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {event.voter && (
                      <p className="text-xs text-slate-500 font-mono truncate">
                        {event.voter}
                      </p>
                    )}
                    {event.stateName && (
                      <p className="text-xs text-slate-400">→ {event.stateName}</p>
                    )}
                    {event.name && (
                      <p className="text-xs text-slate-400">{event.name}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
