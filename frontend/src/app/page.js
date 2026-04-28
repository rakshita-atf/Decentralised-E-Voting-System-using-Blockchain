"use client";

import { ShieldCheck, Vote, Users, ChevronRight, UserCircle } from "lucide-react";
import Link from "next/link";
import { useWallet, WrongNetworkBanner } from "../hooks/useWallet";

export default function Home() {
  const { account, wrongNetwork, networkName, connect } = useWallet();

  const connectWallet = async () => {
    if (typeof window !== "undefined" && !window.ethereum) {
      alert("Please install MetaMask to use this application.");
      return;
    }
    await connect();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {wrongNetwork && <WrongNetworkBanner networkName={networkName} />}

      <div className={`max-w-4xl w-full flex flex-col items-center text-center space-y-8 ${wrongNetwork ? "mt-12" : ""}`}>
        
        <div className="p-4 bg-white/5 backdrop-blur-xl rounded-full mb-4 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          <ShieldCheck className="w-16 h-16 text-indigo-400" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 drop-shadow-sm">
          Decentralised E-Voting
        </h1>
        
        <p className="text-lg md:text-xl text-slate-300 max-w-2xl font-light">
          A highly secure, transparent, and immutable voting platform powered by Polygon Amoy. 
          Experience the future of democracy with zero-knowledge privacy.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 mt-12 w-full max-w-md justify-center">
          {!account ? (
            <button 
              onClick={connectWallet}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-2xl hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 overflow-hidden shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_60px_rgba(79,70,229,0.6)] cursor-pointer"
            >
              <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black"></span>
              <span className="relative flex items-center">
                Connect MetaMask
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center space-y-4 w-full">
              <div className="px-6 py-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-full font-mono text-sm flex items-center shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-3 animate-pulse"></div>
                Connected: {account.slice(0, 6)}...{account.slice(-4)}
                <span className="ml-3 text-xs text-slate-500">({networkName})</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full mt-8">
                <Link href="/voter" className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group backdrop-blur-md cursor-pointer">
                  <Vote className="w-8 h-8 text-pink-400 mb-3 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-white">Voter Portal</span>
                </Link>
                
                <Link href="/admin" className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group backdrop-blur-md cursor-pointer">
                  <Users className="w-8 h-8 text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-white">Admin Dashboard</span>
                </Link>

                <Link href="/results" className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group backdrop-blur-md cursor-pointer">
                  <ShieldCheck className="w-8 h-8 text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-white">Live Results</span>
                </Link>

                <Link href="/analytics" className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group backdrop-blur-md cursor-pointer">
                  <UserCircle className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-white">Analytics</span>
                </Link>

                <Link href="/verify" className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group backdrop-blur-md cursor-pointer col-span-2 sm:col-span-1">
                  <ChevronRight className="w-8 h-8 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-white">Verify Vote</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
