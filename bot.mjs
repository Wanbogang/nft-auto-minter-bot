import { soundnessPrecheck } from "./soundness.mjs";
import { logTx } from "./logger.mjs";

import 'dotenv/config';
import { ethers, Interface } from 'ethers';

// ⏳ Utility
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const env = (k, d = undefined) => (process.env[k] ?? d);
function parseBool(x, d=false){ if (x === undefined) return d; return /^true$/i.test(String(x)); }
function parsePercentInt(x, d){ const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : d; }
function parseGwei(x, d){ if (!x) return d; try { return ethers.parseUnits(String(x), 'gwei'); } catch { return d; } }
function mulBigIntDecimal(x, decimalStr='1.0', scale=1000n){ const [ip, fp=''] = String(decimalStr).split('.'); const frac = (fp + '0'.repeat(3)).slice(0,3); const m = BigInt(ip) * scale + BigInt(frac); return (x * m) / scale; }

// 🔑 ENV
const HTTP_URL = env('ALCHEMY_HTTP_URL');
const WSS_URL  = env('ALCHEMY_WSS_URL');
const CHAIN_ID = Number(env('CHAIN_ID', '84532'));

const CONTRACT_ADDRESS = env('CONTRACT_ADDRESS');
const MINT_SIGNATURE   = env('MINT_SIGNATURE', 'function mint()');
const MINT_ARGS        = JSON.parse(env('MINT_ARGS', '[]'));
const MINT_VALUE_ETH   = env('MINT_VALUE_ETH', '0');

const WAIT_FOR_CODE = parseBool(env('WAIT_FOR_CODE', 'true'), true);
const DRY_RUN       = parseBool(env('DRY_RUN', 'true'), true);

const GAS_LIMIT_PAD_PERCENT = parsePercentInt(env('GAS_LIMIT_PAD_PERCENT', '20'), 20);
const MAX_PRIORITY_FEE_GWEI = parseGwei(env('MAX_PRIORITY_FEE_GWEI'), ethers.parseUnits('1.5', 'gwei'));
const MAX_FEE_MULTIPLIER    = env('MAX_FEE_MULTIPLIER', '2.0');

const REPLACEMENT_AFTER_SECONDS       = Number(env('REPLACEMENT_AFTER_SECONDS', '20'));
const REPLACEMENT_PRIORITY_BUMP_GWEI  = env('REPLACEMENT_PRIORITY_BUMP_GWEI', '0.5');
const MAX_REPLACEMENTS                = Math.max(0, Number(env('MAX_REPLACEMENTS', '3')));

// 🛑 ENV check
if (!HTTP_URL || !process.env.PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error('❌ Pastikan ALCHEMY_HTTP_URL, PRIVATE_KEY, dan CONTRACT_ADDRESS terisi di .env');
  process.exit(1);
}

// ✅ Milestone 1: Soundness precheck
if (!soundnessPrecheck()) {
  console.error("⛔ Soundness precheck gagal. Bot dihentikan.");
  process.exit(1);
}

const httpProvider = new ethers.JsonRpcProvider(HTTP_URL, CHAIN_ID);
let wsProvider = null;
if (WSS_URL) {
  wsProvider = new ethers.WebSocketProvider(WSS_URL, CHAIN_ID);
}

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, httpProvider);
console.log("👋 NFT Bot Sniper — Base Sepolia");
console.log("Wallet:", wallet.address);
console.log("RPC (HTTP):", HTTP_URL);

// Contract interface
const iface = new Interface([MINT_SIGNATURE]);

// 🚀 Milestone 2: Send tx with replace logic + logging
async function sendWithReplace(txRequest) {
  let attempt = 0;
  while (attempt <= MAX_REPLACEMENTS) {
    try {
      const feeData = await httpProvider.getFeeData();
      let maxPriorityFeePerGas = MAX_PRIORITY_FEE_GWEI;
      let maxFeePerGas = feeData.maxFeePerGas * BigInt(Math.ceil(MAX_FEE_MULTIPLIER * 100)) / 100n;

      if (attempt > 0) {
        maxPriorityFeePerGas += ethers.parseUnits(REPLACEMENT_PRIORITY_BUMP_GWEI, "gwei");
        console.log(`⏫ Replace attempt #${attempt}: bumping priority fee to ${maxPriorityFeePerGas}`);
      }

      txRequest.maxPriorityFeePerGas = maxPriorityFeePerGas;
      txRequest.maxFeePerGas = maxFeePerGas;

      if (DRY_RUN) {
        console.log("🧪 DRY_RUN aktif — tidak broadcast tx.");
        logTx({ attempt, action: "simulate", maxPriorityFeePerGas: String(maxPriorityFeePerGas) });
        return;
      }

      const tx = await wallet.sendTransaction(txRequest);
      console.log("📤 TX sent:", tx.hash);
      logTx({ attempt, nonce: tx.nonce, hash: tx.hash, maxPriorityFeePerGas: String(maxPriorityFeePerGas) });

      const receipt = await tx.wait();
      if (receipt && receipt.status === 1) {
        console.log("✅ TX confirmed:", receipt.transactionHash);
        logTx({ attempt, hash: tx.hash, status: "confirmed" });
        return receipt;
      }
    } catch (err) {
      console.error("⚠️ Error sending tx:", err.message);
    }

    attempt++;
    if (attempt <= MAX_REPLACEMENTS) {
      console.log(`⏳ Waiting ${REPLACEMENT_AFTER_SECONDS}s before next attempt...`);
      await sleep(REPLACEMENT_AFTER_SECONDS * 1000);
    }
  }

  console.error("❌ All attempts failed after max replacements");
  logTx({ status: "failed" });
  return null;
}

// Main flow (contoh trigger manual mint)
async function main() {
  console.log("⏳ Menunggu kontrak", CONTRACT_ADDRESS, "...");
  const code = await httpProvider.getCode(CONTRACT_ADDRESS);
  if (!code || code === "0x") {
    console.log("⏳ Kontrak belum live, keluar...");
    return;
  }
  console.log("✅ Kontrak sudah live.");

  const txRequest = {
    to: CONTRACT_ADDRESS,
    data: iface.encodeFunctionData("mint", MINT_ARGS),
    value: ethers.parseEther(MINT_VALUE_ETH)
  };

  await sendWithReplace(txRequest);
}

main().catch((e) => {
  console.error("❌ Fatal error:", e);
  process.exit(1);
});
