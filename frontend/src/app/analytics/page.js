"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, BarChart3, PieChart, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ethers } from "ethers";
import ElectionABI from "../../contracts/ElectionABI.json";
import VoterSBTABI from "../../contracts/VoterSBTABI.json";

// ──────────────────────────────────────────────
// Mock constituency data for the heatmap
// ──────────────────────────────────────────────
const REGIONS = [
  { id: "Delhi-North", name: "Delhi North", lat: 28.7, lng: 77.1, registered: 0, voted: 0 },
  { id: "Delhi-South", name: "Delhi South", lat: 28.5, lng: 77.2, registered: 0, voted: 0 },
  { id: "Mumbai-North", name: "Mumbai North", lat: 19.2, lng: 72.9, registered: 0, voted: 0 },
  { id: "Mumbai-South", name: "Mumbai South", lat: 18.9, lng: 72.8, registered: 0, voted: 0 },
  { id: "Kolkata-Central", name: "Kolkata Central", lat: 22.6, lng: 88.4, registered: 0, voted: 0 },
  { id: "Chennai-East", name: "Chennai East", lat: 13.1, lng: 80.3, registered: 0, voted: 0 },
  { id: "Bengaluru-West", name: "Bengaluru West", lat: 13.0, lng: 77.5, registered: 0, voted: 0 },
  { id: "Hyderabad-Central", name: "Hyderabad Central", lat: 17.4, lng: 78.5, registered: 0, voted: 0 },
];

// Mock turnout data (since we can't query on-chain per-region without events)
const MOCK_TURNOUT = {
  "Delhi-North": { registered: 1250, voted: 890 },
  "Delhi-South": { registered: 980, voted: 720 },
  "Mumbai-North": { registered: 1500, voted: 1100 },
  "Mumbai-South": { registered: 1320, voted: 950 },
  "Kolkata-Central": { registered: 870, voted: 610 },
  "Chennai-East": { registered: 1100, voted: 830 },
  "Bengaluru-West": { registered: 1400, voted: 980 },
  "Hyderabad-Central": { registered: 1050, voted: 780 },
};

function getTurnoutColor(percentage) {
  if (percentage >= 80) return { bg: "bg-emerald-500", text: "text-emerald-400", hex: "#10b981" };
  if (percentage >= 60) return { bg: "bg-green-500", text: "text-green-400", hex: "#22c55e" };
  if (percentage >= 40) return { bg: "bg-yellow-500", text: "text-yellow-400", hex: "#eab308" };
  if (percentage >= 20) return { bg: "bg-orange-500", text: "text-orange-400", hex: "#f97316" };
  return { bg: "bg-red-500", text: "text-red-400", hex: "#ef4444" };
}

export default function AnalyticsPage() {
  const [candidates, setCandidates] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [regions, setRegions] = useState([]);

  const ELECTION_ADDRESS = process.env.NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS;

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!ELECTION_ADDRESS || ELECTION_ADDRESS === "0x0000000000000000000000000000000000000000") return;
    if (typeof window.ethereum === "undefined") return;

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(ELECTION_ADDRESS, ElectionABI, provider);

      const tl = await contract.getElectionTimeline();
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

    // Use mock turnout data
    const regionData = REGIONS.map((r) => ({
      ...r,
      registered: MOCK_TURNOUT[r.id]?.registered || 0,
      voted: MOCK_TURNOUT[r.id]?.voted || 0,
    }));
    setRegions(regionData);
  }, [ELECTION_ADDRESS]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalRegistered = regions.reduce((s, r) => s + r.registered, 0);
  const totalMockVoted = regions.reduce((s, r) => s + r.voted, 0);
  const overallTurnout = totalRegistered > 0 ? ((totalMockVoted / totalRegistered) * 100).toFixed(1) : 0;

  const barColors = [
    "from-indigo-500 to-purple-500",
    "from-pink-500 to-rose-500",
    "from-cyan-500 to-blue-500",
    "from-amber-500 to-orange-500",
    "from-emerald-500 to-green-500",
    "from-violet-500 to-fuchsia-500",
  ];

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center">
            <MapPin className="w-8 h-8 mr-3 text-amber-400" />
            Election Analytics
          </h1>
          <p className="text-slate-400 mt-1">Voter turnout heatmap and vote share analysis.</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors">
          Home
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Registered", value: totalRegistered.toLocaleString(), color: "text-purple-400" },
          { label: "Total Voted", value: totalMockVoted.toLocaleString(), color: "text-green-400" },
          { label: "Turnout", value: `${overallTurnout}%`, color: "text-amber-400" },
          { label: "Constituencies", value: regions.length, color: "text-cyan-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap (CSS-based choropleth visualization) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-amber-400" />
            Voter Turnout by Region
          </h2>

          {/* Grid-based heatmap */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {regions.map((region) => {
              const pct = region.registered > 0 ? (region.voted / region.registered) * 100 : 0;
              const color = getTurnoutColor(pct);
              const isHovered = hoveredRegion === region.id;

              return (
                <div
                  key={region.id}
                  className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                    isHovered
                      ? "bg-white/10 border-white/20 scale-105 shadow-lg"
                      : "bg-black/20 border-white/5 hover:bg-white/5"
                  }`}
                  onMouseEnter={() => setHoveredRegion(region.id)}
                  onMouseLeave={() => setHoveredRegion(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white font-medium">{region.name}</span>
                    <span className={`text-lg font-bold ${color.text}`}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color.bg} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {isHovered && (
                    <div className="mt-2 text-xs text-slate-400">
                      {region.voted.toLocaleString()} / {region.registered.toLocaleString()} voters
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Color Scale Legend */}
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500 mt-2">
            <span>Low</span>
            <div className="flex gap-1">
              {[
                { pct: 10, color: "bg-red-500" },
                { pct: 30, color: "bg-orange-500" },
                { pct: 50, color: "bg-yellow-500" },
                { pct: 70, color: "bg-green-500" },
                { pct: 90, color: "bg-emerald-500" },
              ].map((item) => (
                <div key={item.pct} className={`w-8 h-3 rounded ${item.color}`} title={`${item.pct}%`} />
              ))}
            </div>
            <span>High</span>
          </div>
        </div>

        {/* Vote Share */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-cyan-400" />
            Vote Share
          </h2>

          {candidates.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No vote data available.</div>
          ) : (
            <>
              {/* Simple pie chart using conic-gradient */}
              <div className="flex justify-center mb-6">
                <div
                  className="w-48 h-48 rounded-full shadow-lg border-4 border-white/5"
                  style={{
                    background: (() => {
                      if (totalVotes === 0) return "conic-gradient(rgba(255,255,255,0.05) 100%)";
                      let gradientParts = [];
                      let cumulativePct = 0;
                      const colors = ["#6366f1", "#ec4899", "#06b6d4", "#f59e0b", "#10b981", "#8b5cf6"];
                      candidates.forEach((c, i) => {
                        const pct = (c.voteCount / totalVotes) * 100;
                        gradientParts.push(
                          `${colors[i % colors.length]} ${cumulativePct}% ${cumulativePct + pct}%`
                        );
                        cumulativePct += pct;
                      });
                      return `conic-gradient(${gradientParts.join(", ")})`;
                    })(),
                  }}
                />
              </div>

              {/* Legend */}
              <div className="space-y-3">
                {candidates
                  .sort((a, b) => b.voteCount - a.voteCount)
                  .map((c, idx) => {
                    const pct = totalVotes > 0 ? ((c.voteCount / totalVotes) * 100).toFixed(1) : "0.0";
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                        <div className="flex items-center">
                          <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${barColors[idx % barColors.length]} mr-3`} />
                          <span className="text-white text-sm font-medium">{c.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-bold text-sm">{c.voteCount}</span>
                          <span className="text-xs text-slate-500 ml-1">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
