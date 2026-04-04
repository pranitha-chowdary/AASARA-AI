/**
 * AASARA Web3 Service
 * ───────────────────
 * Interacts with the AasaraParametric smart contract to log every
 * disruption event and parametric payout immutably on-chain.
 *
 * CONFIGURATION (backend/server/.env)
 * ─────────────────────────────────────────────────────
 * AASARA_CONTRACT_ADDRESS=0x...     (deployed contract)
 * DEPLOYER_PRIVATE_KEY=0x...        (wallet that owns the contract)
 * CONTRACT_NETWORK=sepolia          (sepolia | polygonAmoy | hardhat)
 * SEPOLIA_RPC_URL=https://...       (optional — defaults to Ankr public)
 * POLYGON_AMOY_RPC_URL=https://...  (optional)
 * ─────────────────────────────────────────────────────
 *
 * When the env vars are not set, all functions return gracefully with
 * { success: false } — the rest of the server continues without Web3.
 */

'use strict';

const { ethers } = require('ethers');
const { randomBytes } = require('crypto');

// ── Minimal ABI (only the functions called from this service) ──────────
const CONTRACT_ABI = [
  // Write
  'function registerDisruption(string city, string disruptionType, uint256 weatherRiskScore) returns (bytes32)',
  'function executePayout(string workerId, string workerEmail, uint256 amountPaise, bytes32 disruptionEventId, string payoutMethod, string externalPayoutId) returns (bytes32)',
  'function recordPremium(string workerId, uint256 amountPaise, string planType)',
  // Read
  'function getStats() view returns (uint256 totalPaid, uint256 totalWorkers, uint256 totalPremiums, uint256 totalEvents)',
  'function getPayoutCount() view returns (uint256)',
  'function getEventCount() view returns (uint256)',
  // Events
  'event PayoutExecuted(bytes32 indexed payoutId, string workerId, uint256 amountPaise, bytes32 indexed disruptionEventId, string payoutMethod)',
  'event DisruptionRegistered(bytes32 indexed eventId, string city, string disruptionType, uint256 weatherRiskScore, bool oracleValidated)',
];

const RPC_URLS = {
  sepolia:     process.env.SEPOLIA_RPC_URL      || 'https://rpc.ankr.com/eth_sepolia',
  polygonAmoy: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
  hardhat:     'http://127.0.0.1:8545',
};

const EXPLORER_BASE = {
  sepolia:     'https://sepolia.etherscan.io/tx',
  polygonAmoy: 'https://amoy.polygonscan.com/tx',
};

// ── Module-level singletons ────────────────────────────────────────────
let _provider  = null;
let _signer    = null;
let _contract  = null;
let _configured = false;

function _init() {
  const contractAddress = process.env.AASARA_CONTRACT_ADDRESS;
  const privateKey      = process.env.DEPLOYER_PRIVATE_KEY;
  const network         = (process.env.CONTRACT_NETWORK || 'sepolia').trim();

  if (!contractAddress || !privateKey) {
    console.log('[Web3] Contract not configured — on-chain logging disabled.');
    console.log('[Web3] Set AASARA_CONTRACT_ADDRESS + DEPLOYER_PRIVATE_KEY to enable.');
    _configured = false;
    return;
  }

  // Basic key format validation — never log the key itself
  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    console.warn('[Web3] DEPLOYER_PRIVATE_KEY appears malformed — Web3 disabled.');
    _configured = false;
    return;
  }

  try {
    const rpcUrl  = RPC_URLS[network] || RPC_URLS.sepolia;
    _provider     = new ethers.JsonRpcProvider(rpcUrl);
    _signer       = new ethers.Wallet(privateKey, _provider);
    _contract     = new ethers.Contract(contractAddress, CONTRACT_ABI, _signer);
    _configured   = true;
    console.log(`[Web3] ✅ Connected → ${network} | Contract: ${contractAddress}`);
  } catch (err) {
    console.error('[Web3] Initialization failed:', err.message);
    _configured = false;
  }
}

_init();

// ── Helpers ────────────────────────────────────────────────────────────

function _localHash() {
  return `0x${randomBytes(32).toString('hex')}`;
}

function _explorerUrl(txHash) {
  const network = (process.env.CONTRACT_NETWORK || 'sepolia').trim();
  const base    = EXPLORER_BASE[network];
  return base ? `${base}/${txHash}` : null;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Register a disruption event on-chain.
 *
 * @param {string} city
 * @param {string} disruptionType  e.g. "monsoon"
 * @param {number} weatherRiskScore  0-100
 * @returns {{ success, txHash, onChainEventId, explorerUrl }}
 */
async function registerDisruptionOnChain(city, disruptionType, weatherRiskScore) {
  if (!_configured) {
    return { success: false, reason: 'Web3 not configured' };
  }
  try {
    const tx      = await _contract.registerDisruption(city, disruptionType, Math.round(weatherRiskScore));
    const receipt = await tx.wait(1);

    let onChainEventId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = _contract.interface.parseLog(log);
        if (parsed?.name === 'DisruptionRegistered') {
          onChainEventId = parsed.args.eventId;
          break;
        }
      } catch { /* skip unparseable logs */ }
    }

    console.log(`[Web3] DisruptionRegistered on-chain — tx: ${receipt.hash}`);
    return {
      success:        true,
      txHash:         receipt.hash,
      blockNumber:    receipt.blockNumber,
      onChainEventId,
      explorerUrl:    _explorerUrl(receipt.hash),
    };
  } catch (err) {
    console.error('[Web3] registerDisruption failed:', err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Record a parametric payout on-chain.
 * Falls back to a local hash if Web3 is not configured.
 *
 * @param {string} workerId
 * @param {string} workerEmail
 * @param {number} amountPaise        e.g. 70000 = ₹700
 * @param {string|null} onChainEventId  bytes32 from registerDisruptionOnChain
 * @param {string} payoutMethod        "razorpay"|"upi"|"simulated"
 * @param {string} externalPayoutId    Razorpay payout ID (empty string if n/a)
 * @returns {{ success, txHash, explorerUrl }}
 */
async function recordPayoutOnChain(
  workerId,
  workerEmail,
  amountPaise,
  onChainEventId,
  payoutMethod,
  externalPayoutId
) {
  if (!_configured || !onChainEventId) {
    return {
      success:     false,
      txHash:      _localHash(),
      reason:      !_configured ? 'Web3 not configured' : 'No on-chain event ID',
    };
  }
  try {
    const tx = await _contract.executePayout(
      workerId,
      workerEmail    || '',
      BigInt(amountPaise),
      onChainEventId,
      payoutMethod   || 'simulated',
      externalPayoutId || ''
    );
    const receipt = await tx.wait(1);
    console.log(`[Web3] PayoutExecuted on-chain — tx: ${receipt.hash}`);
    return {
      success:     true,
      txHash:      receipt.hash,
      blockNumber: receipt.blockNumber,
      explorerUrl: _explorerUrl(receipt.hash),
    };
  } catch (err) {
    console.error('[Web3] executePayout failed:', err.message);
    // Return a local hash so the payout still completes in the DB
    return {
      success:  false,
      txHash:   _localHash(),
      reason:   err.message,
    };
  }
}

/**
 * Record a premium payment on-chain (fire-and-forget).
 */
async function recordPremiumOnChain(workerId, amountPaise, planType) {
  if (!_configured) return { success: false };
  try {
    const tx = await _contract.recordPremium(workerId, BigInt(amountPaise), planType || 'basic');
    await tx.wait(1);
    return { success: true };
  } catch (err) {
    console.error('[Web3] recordPremium failed:', err.message);
    return { success: false };
  }
}

/**
 * Fetch on-chain cumulative stats.
 * @returns {object|null}
 */
async function getOnChainStats() {
  if (!_configured) return null;
  try {
    const s = await _contract.getStats();
    return {
      totalPayoutsPaise:       s[0].toString(),
      totalWorkersProtected:   s[1].toString(),
      premiumsCollectedPaise:  s[2].toString(),
      totalEvents:             s[3].toString(),
    };
  } catch (err) {
    console.error('[Web3] getStats failed:', err.message);
    return null;
  }
}

function isConfigured() {
  return _configured;
}

module.exports = {
  registerDisruptionOnChain,
  recordPayoutOnChain,
  recordPremiumOnChain,
  getOnChainStats,
  isConfigured,
};
