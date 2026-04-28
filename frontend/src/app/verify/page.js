"use client";

import { useState } from "react";
import { Search, CheckCircle2, AlertTriangle, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function VerifyVotePage() {
  const [cid, setCid] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!cid.trim()) return;

    setLoading(true);
    setError("");
    setReceipt(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ballot/${cid}`);
      const data = await res.json();

      if (data.success) {
        setReceipt(data.receipt);
      } else {
        setError(data.error || "Ballot proof not found");
      }
    } catch (err) {
      // Try direct IPFS gateway as fallback
      try {
        const gatewayRes = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
        if (gatewayRes.ok) {
          const data = await gatewayRes.json();
          setReceipt(data);
        } else {
          setError("Could not fetch ballot proof from IPFS or backend.");
        }
      } catch {
        setError("Could not connect to backend or IPFS gateway.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center">
            <FileText className="w-8 h-8 mr-3 text-cyan-400" />
            Verify My Vote
          </h1>
          <p className="text-slate-400 mt-1">
            Enter your Ballot Proof CID to verify your vote on IPFS.
          </p>
        </div>
        <Link href="/" className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors">
          Home
        </Link>
      </div>

      {/* Search Form */}
      <form onSubmit={handleVerify} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            placeholder="Enter IPFS CID (e.g., QmX7b3...)"
          />
          <button
            type="submit"
            disabled={loading || !cid.trim()}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center"
          >
            <Search className="w-4 h-4 mr-2" />
            {loading ? "Searching..." : "Verify"}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Receipt Display */}
      {receipt && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mr-4 border border-green-500/30">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Ballot Proof Verified</h2>
              <p className="text-sm text-slate-400">This cryptographic receipt is stored immutably on IPFS.</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: "Hashed Voter ID", value: receipt.hashedVoter, mono: true },
              { label: "Timestamp", value: receipt.timestamp },
              { label: "Election ID", value: receipt.electionId },
              { label: "Vote Hash (SHA-256)", value: receipt.voteHash, mono: true },
              { label: "Transaction Hash", value: receipt.txHash, mono: true },
              { label: "Schema Version", value: receipt.schema },
            ].map((field) => (
              <div key={field.label} className="p-3 bg-black/20 rounded-lg border border-white/5">
                <p className="text-xs text-slate-500 mb-1">{field.label}</p>
                <p className={`text-sm text-white break-all ${field.mono ? "font-mono" : ""}`}>
                  {field.value || "—"}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <a
              href={`https://gateway.pinata.cloud/ipfs/${cid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-slate-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on IPFS
            </a>
          </div>
        </div>
      )}

      {/* Explainer */}
      {!receipt && !error && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-white font-semibold mb-3">How Ballot Verification Works</h3>
          <ol className="space-y-2 text-sm text-slate-400 list-decimal list-inside">
            <li>When you reveal your vote, a cryptographic receipt is generated.</li>
            <li>The receipt is pinned to IPFS via Pinata, creating an immutable record.</li>
            <li>The IPFS CID is stored on-chain in the VoteRevealed event.</li>
            <li>Enter the CID here to fetch and verify the receipt contents.</li>
            <li>The receipt contains hashed identifiers — your actual identity is never exposed.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
