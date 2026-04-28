"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

// Chain IDs we support
const SUPPORTED_CHAINS = {
  31337: "Hardhat Local",
  80002: "Polygon Amoy",
  137: "Polygon Mainnet",
};

/**
 * useWallet — shared hook for MetaMask connection, network detection,
 * and account-change handling (fixes BUG-003 & BUG-004).
 */
export function useWallet() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [networkName, setNetworkName] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const checkNetwork = useCallback((id) => {
    const numId = Number(id);
    setChainId(numId);
    const supported = !!SUPPORTED_CHAINS[numId];
    setWrongNetwork(!supported);
    setNetworkName(SUPPORTED_CHAINS[numId] || `Unknown (${numId})`);
    return supported;
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return null;
    try {
      const p = new ethers.BrowserProvider(window.ethereum);
      const net = await p.getNetwork();
      checkNetwork(net.chainId);
      const s = await p.getSigner();
      const addr = await s.getAddress();
      setProvider(p);
      setSigner(s);
      setAccount(addr);
      return { provider: p, signer: s, address: addr };
    } catch (err) {
      console.error("Wallet connect error:", err);
      return null;
    }
  }, [checkNetwork]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    // Listen for account changes (BUG-004 fix)
    const handleAccounts = (accounts) => {
      if (accounts.length === 0) {
        setAccount("");
        setSigner(null);
      } else {
        setAccount(accounts[0]);
        connect(); // re-init signer
      }
    };

    // Listen for chain changes (BUG-003 fix)
    const handleChain = (id) => {
      checkNetwork(id);
      connect(); // re-init provider for new chain
    };

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);

    // Auto-connect if already permitted
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accs) => {
        if (accs.length > 0) connect();
      })
      .catch(() => {});

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccounts);
      window.ethereum.removeListener("chainChanged", handleChain);
    };
  }, [connect, checkNetwork]);

  return { account, chainId, wrongNetwork, networkName, provider, signer, connect };
}

/**
 * WrongNetworkBanner — drop-in component shown when user is on the wrong chain.
 */
export function WrongNetworkBanner({ networkName }) {
  const switchToAmoy = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x13882" }], // 80002
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x13882",
              chainName: "Polygon Amoy Testnet",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://rpc-amoy.polygon.technology"],
              blockExplorerUrls: ["https://amoy.polygonscan.com"],
            },
          ],
        });
      }
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-3 px-4 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <span>⚠️ Wrong Network — connected to {networkName}. Please switch to Polygon Amoy or Hardhat Local.</span>
      <button
        onClick={switchToAmoy}
        className="px-3 py-1 bg-white text-red-600 rounded-md font-bold hover:bg-red-50 transition-colors text-xs"
      >
        Switch to Amoy
      </button>
    </div>
  );
}
