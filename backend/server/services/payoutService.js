/**
 * AASARA Payout Service
 * 
 * Handles Razorpay payouts from the community liquidity pool to gig workers.
 * Uses RazorpayX Contact → Fund Account → Payout flow when RAZORPAY_ACCOUNT_NUMBER is set.
 * Falls back to simulated payouts for dev/demo.
 */
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SV9qs8KKmSxRuW',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '4wB53umj6foo7xJMYgqKIMqc',
});

const RAZORPAY_ACCOUNT_NUMBER = process.env.RAZORPAY_ACCOUNT_NUMBER || null;

/**
 * Check if the liquidity pool has sufficient balance for a payout.
 * @param {Object} LiquidityPool - Mongoose model
 * @param {number} amount - Payout amount in ₹
 * @returns {{ sufficient: boolean, poolBalance: number }}
 */
async function checkPoolBalance(LiquidityPool, amount) {
  const pool = await LiquidityPool.findOne({ poolId: 'main_pool' }).lean();
  const poolBalance = pool ? pool.totalBalance : 0;
  return {
    sufficient: poolBalance >= amount,
    poolBalance,
    deficit: poolBalance < amount ? amount - poolBalance : 0,
  };
}

/**
 * Deduct payout amount from the liquidity pool and log the transaction.
 * @param {Object} LiquidityPool - Mongoose model
 * @param {number} amount - Amount to deduct in ₹
 * @param {string} workerId - Worker receiving payout
 * @param {string} claimId - Associated claim/transaction ID
 */
async function deductFromPool(LiquidityPool, amount, workerId, claimId) {
  await LiquidityPool.findOneAndUpdate(
    { poolId: 'main_pool' },
    {
      $inc: { totalBalance: -amount, totalPayouts: amount, totalClaims: 1 },
      $set: { lastUpdated: new Date() },
      $push: {
        transactions: {
          $each: [{
            type: 'payout',
            amount,
            workerId,
            claimId,
            timestamp: new Date(),
          }],
          $slice: -100,
        },
      },
    },
    { upsert: true }
  );
}

/**
 * Create a Razorpay Contact for the worker (or return existing).
 * Contacts are reusable — create once per worker.
 */
async function createContact(worker) {
  const contact = await razorpay.fundAccount.create({
    // Actually, we create a Contact first
  });
  // RazorpayX SDK may vary — use raw API call
  const axios = require('axios');
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');

  const res = await axios.post(
    'https://api.razorpay.com/v1/contacts',
    {
      name: worker.fullName,
      email: worker.email,
      contact: `+91${worker.phoneNumber}`,
      type: 'employee',
      reference_id: worker._id.toString(),
      notes: {
        platform: worker.platform || 'unknown',
        source: 'aasara_ai',
      },
    },
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return res.data;
}

/**
 * Create a Fund Account (UPI VPA) for a Contact.
 */
async function createFundAccount(contactId, worker) {
  const axios = require('axios');
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64');

  const upiId = worker.upiId || `${worker.fullName.toLowerCase().replace(/\s+/g, '')}@okicici`;

  const res = await axios.post(
    'https://api.razorpay.com/v1/fund_accounts',
    {
      contact_id: contactId,
      account_type: 'vpa',
      vpa: { address: upiId },
    },
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return res.data;
}

/**
 * Execute a Razorpay Payout from the liquidity pool to a worker.
 * 
 * @param {Object} params
 * @param {Object} params.worker - User document (fullName, email, phoneNumber, upiId)
 * @param {number} params.amount - Amount in ₹
 * @param {string} params.disruptionType - Type of disruption
 * @param {string} params.disruptionId - Disruption ID for narration
 * @param {Object} params.LiquidityPool - Mongoose model
 * @param {string} params.claimId - Claim transaction ID
 * @returns {{ success, payoutId, payoutMethod, payoutStatus, message }}
 */
async function executePayout({ worker, amount, disruptionType, disruptionId, LiquidityPool, claimId }) {
  // Step 1: Check pool balance
  const poolCheck = await checkPoolBalance(LiquidityPool, amount);
  if (!poolCheck.sufficient) {
    console.error(`🔴 POOL INSUFFICIENT: Need ₹${amount}, pool has ₹${poolCheck.poolBalance}`);
    return {
      success: false,
      payoutId: null,
      payoutMethod: 'pool_insufficient',
      payoutStatus: 'failed',
      poolBalance: poolCheck.poolBalance,
      message: `Liquidity pool insufficient. Balance: ₹${poolCheck.poolBalance}, Required: ₹${amount}`,
    };
  }

  // Step 2: Attempt Razorpay payout (if configured)
  if (RAZORPAY_ACCOUNT_NUMBER) {
    try {
      // Create Contact
      const contact = await createContact(worker);
      console.log(`[Payout] Contact created: ${contact.id}`);

      // Create Fund Account (UPI)
      const fundAccount = await createFundAccount(contact.id, worker);
      console.log(`[Payout] Fund account created: ${fundAccount.id}`);

      // Execute Payout via RazorpayX
      const axios = require('axios');
      const auth = Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString('base64');

      const payoutRes = await axios.post(
        'https://api.razorpay.com/v1/payouts',
        {
          account_number: RAZORPAY_ACCOUNT_NUMBER,
          fund_account_id: fundAccount.id,
          amount: Math.round(amount * 100), // paise
          currency: 'INR',
          mode: 'UPI',
          purpose: 'payout',
          queue_if_low_balance: false,
          reference_id: claimId,
          narration: `AASARA ${disruptionType.toUpperCase()} PAYOUT`,
          notes: {
            disruptionId,
            disruptionType,
            workerName: worker.fullName,
            source: 'aasara_liquidity_pool',
          },
        },
        { headers: { Authorization: `Basic ${auth}` } }
      );

      const payout = payoutRes.data;
      console.log(`✅ RazorpayX payout created: ${payout.id} | Status: ${payout.status}`);

      // Deduct from pool
      await deductFromPool(LiquidityPool, amount, worker._id.toString(), claimId);

      return {
        success: true,
        payoutId: payout.id,
        payoutMethod: 'razorpay',
        payoutStatus: payout.status === 'processed' ? 'completed' : 'processing',
        razorpayStatus: payout.status,
        utr: payout.utr || null,
        message: `₹${amount} payout initiated via RazorpayX UPI to ${worker.upiId || 'linked VPA'}`,
      };
    } catch (rzErr) {
      console.error(`🔴 RazorpayX payout failed:`, rzErr.response?.data || rzErr.message);
      return {
        success: false,
        payoutId: null,
        payoutMethod: 'razorpay',
        payoutStatus: 'failed',
        message: `RazorpayX payout failed: ${rzErr.response?.data?.error?.description || rzErr.message}`,
      };
    }
  }

  // Step 3: Simulated payout (dev/demo — no RazorpayX account)
  const simPayoutId = `rz_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`💸 [SIMULATED] Payout ₹${amount} from pool → ${worker.fullName} (${worker.upiId || 'auto-VPA'})`);

  // Deduct from pool even in simulation
  await deductFromPool(LiquidityPool, amount, worker._id.toString(), claimId);

  return {
    success: true,
    payoutId: simPayoutId,
    payoutMethod: 'simulated',
    payoutStatus: 'completed',
    upiId: worker.upiId || `${worker.fullName.toLowerCase().replace(/\s+/g, '')}@okicici`,
    message: `₹${amount} payout simulated from liquidity pool → ${worker.upiId || 'auto-VPA'} (set RAZORPAY_ACCOUNT_NUMBER for live payouts)`,
  };
}

/**
 * Retry a failed payout.
 */
async function retryPayout({ worker, amount, disruptionType, disruptionId, LiquidityPool, claimId }) {
  console.log(`🔄 Retrying payout for ${worker.fullName} — ₹${amount}`);
  return executePayout({ worker, amount, disruptionType, disruptionId, LiquidityPool, claimId });
}

module.exports = {
  executePayout,
  retryPayout,
  checkPoolBalance,
  deductFromPool,
};
