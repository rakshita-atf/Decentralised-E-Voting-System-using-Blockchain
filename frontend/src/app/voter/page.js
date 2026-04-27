"use client";

import { useState } from "react";
import { Vote, Fingerprint, Lock, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function VoterPortal() {
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState(1); // 1: Enter Aadhaar, 2: Enter OTP, 3: Voting
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);

  // Mock candidates list
  const candidates = [
    { id: 1, name: "Alice Smith" },
    { id: 2, name: "Bob Jones" },
  ];

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (aadhaar.length !== 12) {
      alert("Aadhaar number must be 12 digits.");
      return;
    }
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setStep(2);
    }, 1500);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (otp !== "1234") {
      alert("Invalid OTP! (Hint: use 1234)");
      return;
    }
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
      setStep(3);
    }, 1500);
  };

  const handleVote = () => {
    if (!selectedCandidate) return;
    setHasVoted(true);
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto flex flex-col">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-bold text-white flex items-center">
            <Vote className="w-8 h-8 mr-3 text-pink-400" />
            Voter Portal
          </h1>
          <p className="text-slate-400 mt-2">Verify your identity anonymously and cast your vote.</p>
        </div>
        <Link href="/" className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors">
          Back to Home
        </Link>
      </div>

      <div className="flex-grow flex items-center justify-center">
        <div className="w-full max-w-lg bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          
          {/* Background decoration */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl"></div>
          
          {!isVerified && step === 1 && (
            <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <Fingerprint className="w-8 h-8 text-slate-300" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Identity Verification</h2>
                <p className="text-sm text-slate-400">Connect to DigiLocker to prove eligibility. Your identity will NOT be stored on the blockchain.</p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Aadhaar Number</label>
                  <input 
                    type="text" 
                    maxLength={12}
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono tracking-widest text-center text-lg"
                    placeholder="XXXX XXXX XXXX"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-2 text-center">Use 123456789012 for simulation</p>
                </div>
                <button 
                  type="submit" 
                  disabled={isVerifying}
                  className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(219,39,119,0.3)] disabled:opacity-50"
                >
                  {isVerifying ? "Requesting..." : "Send OTP"}
                </button>
              </form>
            </div>
          )}

          {!isVerified && step === 2 && (
            <div className="relative z-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Enter OTP</h2>
                <p className="text-sm text-slate-400">An OTP was sent to your registered mobile number.</p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <input 
                    type="text" 
                    maxLength={4}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono tracking-widest text-center text-2xl"
                    placeholder="----"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isVerifying}
                  className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(219,39,119,0.3)] disabled:opacity-50 flex items-center justify-center"
                >
                  {isVerifying ? "Verifying..." : "Verify & Generate ZKP"}
                  {!isVerifying && <Lock className="w-4 h-4 ml-2" />}
                </button>
                <button 
                  type="button" 
                  onClick={() => setStep(1)}
                  className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Go Back
                </button>
              </form>
            </div>
          )}

          {isVerified && !hasVoted && step === 3 && (
            <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="mb-6 flex items-center bg-green-500/10 border border-green-500/20 p-3 rounded-lg text-green-400 text-sm">
                 <CheckCircle2 className="w-5 h-5 mr-2" />
                 Identity verified. Zero Knowledge Proof generated.
               </div>
               
               <h2 className="text-xl font-semibold text-white mb-6">Select your candidate</h2>
               
               <div className="space-y-4 mb-8">
                 {candidates.map(candidate => (
                   <label 
                    key={candidate.id} 
                    className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedCandidate === candidate.id 
                        ? 'bg-pink-500/20 border-pink-500 shadow-[0_0_15px_rgba(219,39,119,0.2)]' 
                        : 'bg-black/20 border-white/10 hover:bg-white/5'
                    }`}
                  >
                     <input 
                       type="radio" 
                       name="candidate" 
                       className="hidden"
                       checked={selectedCandidate === candidate.id}
                       onChange={() => setSelectedCandidate(candidate.id)}
                     />
                     <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-4 ${
                       selectedCandidate === candidate.id ? 'border-pink-500' : 'border-slate-500'
                     }`}>
                        {selectedCandidate === candidate.id && <div className="w-3 h-3 bg-pink-500 rounded-full"></div>}
                     </div>
                     <span className="text-white text-lg font-medium">{candidate.name}</span>
                   </label>
                 ))}
               </div>

               <button 
                  onClick={handleVote}
                  disabled={!selectedCandidate}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] disabled:opacity-50 disabled:shadow-none"
                >
                  Cast Anonymous Vote
                </button>
            </div>
          )}

          {hasVoted && (
            <div className="relative z-10 text-center animate-in zoom-in duration-500 py-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Vote Cast Successfully!</h2>
              <p className="text-slate-300 mb-8">Your Zero Knowledge Proof was verified on-chain. Your vote is immutable and completely anonymous.</p>
              
              <div className="bg-black/30 border border-white/5 rounded-lg p-4 font-mono text-xs text-left text-slate-400 break-all mb-8">
                <span className="text-indigo-400 font-semibold block mb-1">Transaction Hash:</span>
                0x8f2d5a3...e9b7c2f1
                <br/><br/>
                <span className="text-pink-400 font-semibold block mb-1">Nullifier:</span>
                0x2a9d...44bc
              </div>

              <Link href="/" className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors">
                Return to Home
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
