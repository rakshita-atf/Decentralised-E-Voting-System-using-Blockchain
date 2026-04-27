"use client";

import { useState } from "react";
import { PlusCircle, Shield, Settings, Activity } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [newCandidateName, setNewCandidateName] = useState("");

  const handleAddCandidate = (e) => {
    e.preventDefault();
    if (newCandidateName.trim() === "") return;
    setCandidates([...candidates, { id: Date.now(), name: newCandidateName, voteCount: 0 }]);
    setNewCandidateName("");
  };

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-bold text-white flex items-center">
            <Shield className="w-8 h-8 mr-3 text-indigo-400" />
            Admin Dashboard
          </h1>
          <p className="text-slate-400 mt-2">Manage elections, candidates, and permissions.</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors">
          Back to Home
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Actions */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-slate-400" />
              Election Controls
            </h2>
            <div className="space-y-4">
              <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                Start Election
              </button>
              <button className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-medium transition-colors">
                End Election
              </button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <PlusCircle className="w-5 h-5 mr-2 text-slate-400" />
              Add Candidate
            </h2>
            <form onSubmit={handleAddCandidate} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Candidate Name</label>
                <input 
                  type="text" 
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="e.g., Alice Smith"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                Add to Ballot
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Candidates & Stats */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-slate-400" />
              Current Ballot
            </h2>
            
            {candidates.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-white/10 rounded-xl">
                No candidates added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {candidates.map((candidate, idx) => (
                  <div key={candidate.id} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold mr-4 shadow-lg">
                        {idx + 1}
                      </div>
                      <span className="text-lg text-white font-medium">{candidate.name}</span>
                    </div>
                    <div className="px-3 py-1 bg-white/5 rounded-full text-sm text-slate-300">
                      0 Votes
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
