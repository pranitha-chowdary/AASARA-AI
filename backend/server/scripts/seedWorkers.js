/**
 * AASARA AI — Demo Worker Seeder
 * Seeds 40 realistic Indian gig workers with:
 *   - Full onboarding (platform linked, subscription active)
 *   - Backdated join dates (2–45 days ago) so eligibility passes
 *   - Realistic claim histories showing liquidity pool drawdown
 *   - Liquidity pool seeded with ₹85,000 balance
 *
 * Run: node scripts/seedWorkers.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const {
  User, Onboarding, Subscription, Claim, LiquidityPool,
} = require('../models/schemas');

// ─── Config ────────────────────────────────────────────────────────────────
const SEED_POOL_BALANCE  = 85000;   // ₹85,000 starting pool
const WORKER_PASSWORD    = 'Demo@1234';
const BASE_DATE          = new Date('2026-04-04T00:00:00Z');

// ─── Indian gig worker data ─────────────────────────────────────────────────
const WORKERS = [
  // Mumbai
  { name: 'Ravi Kumar',       email: 'ravi.kumar@gmail.com',        phone: '9876543210', city: 'Mumbai',    platform: 'zomato',  plan: 'basic',   daysAgo: 42, premium: 350 },
  { name: 'Priya Sharma',     email: 'priya.sharma@gmail.com',      phone: '9876543211', city: 'Mumbai',    platform: 'swiggy',  plan: 'premium', daysAgo: 38, premium: 490 },
  { name: 'Mohammed Salim',   email: 'salim.delivery@gmail.com',    phone: '9876543212', city: 'Mumbai',    platform: 'zomato',  plan: 'basic',   daysAgo: 31, premium: 385 },
  { name: 'Sunita Patil',     email: 'sunita.patil@gmail.com',      phone: '9876543213', city: 'Mumbai',    platform: 'swiggy',  plan: 'premium', daysAgo: 27, premium: 525 },
  { name: 'Arjun Nair',       email: 'arjun.nair@gmail.com',        phone: '9876543214', city: 'Mumbai',    platform: 'dunzo',   plan: 'basic',   daysAgo: 19, premium: 315 },
  { name: 'Fatima Shaikh',    email: 'fatima.shaikh@gmail.com',     phone: '9876543215', city: 'Mumbai',    platform: 'zomato',  plan: 'premium', daysAgo: 14, premium: 455 },
  { name: 'Rajesh Yadav',     email: 'rajesh.yadav@gmail.com',      phone: '9876543216', city: 'Mumbai',    platform: 'swiggy',  plan: 'basic',   daysAgo: 10, premium: 340 },
  { name: 'Meena Gupta',      email: 'meena.gupta@gmail.com',       phone: '9876543217', city: 'Mumbai',    platform: 'zomato',  plan: 'basic',   daysAgo: 8,  premium: 370 },

  // Delhi
  { name: 'Aakash Singh',     email: 'aakash.singh@gmail.com',      phone: '9876543218', city: 'Delhi',     platform: 'zomato',  plan: 'premium', daysAgo: 44, premium: 560 },
  { name: 'Pooja Verma',      email: 'pooja.verma@gmail.com',       phone: '9876543219', city: 'Delhi',     platform: 'swiggy',  plan: 'basic',   daysAgo: 36, premium: 310 },
  { name: 'Deepak Chauhan',   email: 'deepak.chauhan@gmail.com',    phone: '9876543220', city: 'Delhi',     platform: 'dunzo',   plan: 'premium', daysAgo: 30, premium: 480 },
  { name: 'Kavita Mishra',    email: 'kavita.mishra@gmail.com',     phone: '9876543221', city: 'Delhi',     platform: 'zomato',  plan: 'basic',   daysAgo: 22, premium: 325 },
  { name: 'Sanjay Rawat',     email: 'sanjay.rawat@gmail.com',      phone: '9876543222', city: 'Delhi',     platform: 'swiggy',  plan: 'premium', daysAgo: 16, premium: 510 },
  { name: 'Anita Joshi',      email: 'anita.joshi@gmail.com',       phone: '9876543223', city: 'Delhi',     platform: 'zomato',  plan: 'basic',   daysAgo: 11, premium: 350 },
  { name: 'Vikram Thakur',    email: 'vikram.thakur@gmail.com',     phone: '9876543224', city: 'Delhi',     platform: 'swiggy',  plan: 'basic',   daysAgo: 7,  premium: 295 },

  // Bangalore
  { name: 'Suresh Reddy',     email: 'suresh.reddy@gmail.com',      phone: '9876543225', city: 'Bangalore', platform: 'zomato',  plan: 'premium', daysAgo: 45, premium: 575 },
  { name: 'Lakshmi Devi',     email: 'lakshmi.devi@gmail.com',      phone: '9876543226', city: 'Bangalore', platform: 'swiggy',  plan: 'basic',   daysAgo: 39, premium: 330 },
  { name: 'Kiran Gowda',      email: 'kiran.gowda@gmail.com',       phone: '9876543227', city: 'Bangalore', platform: 'dunzo',   plan: 'premium', daysAgo: 32, premium: 495 },
  { name: 'Nandini Rao',      email: 'nandini.rao@gmail.com',       phone: '9876543228', city: 'Bangalore', platform: 'zomato',  plan: 'basic',   daysAgo: 24, premium: 355 },
  { name: 'Prasad Hegde',     email: 'prasad.hegde@gmail.com',      phone: '9876543229', city: 'Bangalore', platform: 'swiggy',  plan: 'premium', daysAgo: 18, premium: 520 },
  { name: 'Shruthi Murthy',   email: 'shruthi.murthy@gmail.com',    phone: '9876543230', city: 'Bangalore', platform: 'zomato',  plan: 'basic',   daysAgo: 12, premium: 340 },
  { name: 'Harish Kumar',     email: 'harish.kumar.blr@gmail.com',  phone: '9876543231', city: 'Bangalore', platform: 'swiggy',  plan: 'basic',   daysAgo: 6,  premium: 305 },

  // Hyderabad
  { name: 'Ramesh Babu',      email: 'ramesh.babu@gmail.com',       phone: '9876543232', city: 'Hyderabad', platform: 'zomato',  plan: 'premium', daysAgo: 40, premium: 545 },
  { name: 'Swaroopa Rani',    email: 'swaroopa.rani@gmail.com',     phone: '9876543233', city: 'Hyderabad', platform: 'swiggy',  plan: 'basic',   daysAgo: 34, premium: 320 },
  { name: 'Naresh Yadav',     email: 'naresh.yadav.hyd@gmail.com',  phone: '9876543234', city: 'Hyderabad', platform: 'dunzo',   plan: 'premium', daysAgo: 28, premium: 465 },
  { name: 'Padmaja Reddy',    email: 'padmaja.reddy@gmail.com',     phone: '9876543235', city: 'Hyderabad', platform: 'zomato',  plan: 'basic',   daysAgo: 20, premium: 335 },
  { name: 'Srikanth Rao',     email: 'srikanth.rao@gmail.com',      phone: '9876543236', city: 'Hyderabad', platform: 'swiggy',  plan: 'premium', daysAgo: 13, premium: 500 },

  // Chennai
  { name: 'Murugan Selvam',   email: 'murugan.selvam@gmail.com',    phone: '9876543237', city: 'Chennai',   platform: 'zomato',  plan: 'basic',   daysAgo: 43, premium: 345 },
  { name: 'Kavitha Rajan',    email: 'kavitha.rajan@gmail.com',     phone: '9876543238', city: 'Chennai',   platform: 'swiggy',  plan: 'premium', daysAgo: 37, premium: 487 },
  { name: 'Senthil Kumar',    email: 'senthil.kumar@gmail.com',     phone: '9876543239', city: 'Chennai',   platform: 'dunzo',   plan: 'basic',   daysAgo: 29, premium: 360 },
  { name: 'Anbu Selvi',       email: 'anbu.selvi@gmail.com',        phone: '9876543240', city: 'Chennai',   platform: 'zomato',  plan: 'premium', daysAgo: 21, premium: 515 },
  { name: 'Dinesh Babu',      email: 'dinesh.babu.chn@gmail.com',   phone: '9876543241', city: 'Chennai',   platform: 'swiggy',  plan: 'basic',   daysAgo: 9,  premium: 330 },

  // Pune
  { name: 'Amol Pawar',       email: 'amol.pawar@gmail.com',        phone: '9876543242', city: 'Pune',      platform: 'zomato',  plan: 'premium', daysAgo: 41, premium: 555 },
  { name: 'Sneha Kulkarni',   email: 'sneha.kulkarni@gmail.com',    phone: '9876543243', city: 'Pune',      platform: 'swiggy',  plan: 'basic',   daysAgo: 35, premium: 315 },
  { name: 'Sachin More',      email: 'sachin.more.pune@gmail.com',  phone: '9876543244', city: 'Pune',      platform: 'dunzo',   plan: 'premium', daysAgo: 26, premium: 475 },
  { name: 'Rupali Jadhav',    email: 'rupali.jadhav@gmail.com',     phone: '9876543245', city: 'Pune',      platform: 'zomato',  plan: 'basic',   daysAgo: 17, premium: 325 },
  { name: 'Ganesh Shinde',    email: 'ganesh.shinde@gmail.com',     phone: '9876543246', city: 'Pune',      platform: 'swiggy',  plan: 'premium', daysAgo: 9,  premium: 490 },

  // Kolkata
  { name: 'Sourav Ghosh',     email: 'sourav.ghosh@gmail.com',      phone: '9876543247', city: 'Kolkata',   platform: 'zomato',  plan: 'basic',   daysAgo: 33, premium: 300 },
  { name: 'Mousumi Das',      email: 'mousumi.das@gmail.com',       phone: '9876543248', city: 'Kolkata',   platform: 'swiggy',  plan: 'premium', daysAgo: 25, premium: 470 },
  { name: 'Subhash Mondal',   email: 'subhash.mondal@gmail.com',    phone: '9876543249', city: 'Kolkata',   platform: 'dunzo',   plan: 'basic',   daysAgo: 15, premium: 285 },
  { name: 'Rina Chatterjee',  email: 'rina.chatterjee@gmail.com',   phone: '9876543250', city: 'Kolkata',   platform: 'zomato',  plan: 'premium', daysAgo: 7,  premium: 505 },
];

// ─── Past disruption events (for claims history) ────────────────────────────
const DISRUPTION_EVENTS = [
  { type: 'monsoon',          city: 'Mumbai',    daysAgo: 25, amount: 350, workers: [0, 1, 2, 3] },
  { type: 'curfew',           city: 'Delhi',     daysAgo: 20, amount: 420, workers: [8, 9, 10] },
  { type: 'heatwave',         city: 'Hyderabad', daysAgo: 18, amount: 380, workers: [22, 23, 24] },
  { type: 'heavy_rain',       city: 'Bangalore', daysAgo: 15, amount: 390, workers: [15, 16, 17] },
  { type: 'strike',           city: 'Chennai',   daysAgo: 12, amount: 400, workers: [27, 28, 29] },
  { type: 'monsoon',          city: 'Mumbai',    daysAgo: 10, amount: 350, workers: [4, 5, 6] },
  { type: 'platform_outage',  city: 'Bangalore', daysAgo: 8,  amount: 310, workers: [18, 19, 20] },
  { type: 'heatwave',         city: 'Delhi',     daysAgo: 6,  amount: 420, workers: [11, 12, 13] },
  { type: 'heavy_rain',       city: 'Pune',      daysAgo: 4,  amount: 375, workers: [31, 32, 33] },
  { type: 'monsoon',          city: 'Kolkata',   daysAgo: 2,  amount: 395, workers: [36, 37, 38] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function daysBack(n) {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() - n);
  return d;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const hashedPassword = await bcrypt.hash(WORKER_PASSWORD, 10);
  const createdUsers   = [];

  let totalContributions = 0;
  let totalPayouts       = 0;
  const poolTransactions = [];

  // ── 1. Seed workers ──────────────────────────────────────────────────────
  console.log(`Seeding ${WORKERS.length} workers...`);
  for (const w of WORKERS) {
    try {
      const joinDate    = daysBack(w.daysAgo);
      const startDate   = new Date(joinDate);
      const endDate     = new Date(joinDate);
      endDate.setDate(endDate.getDate() + 7);

      // Upsert user
      const user = await User.findOneAndUpdate(
        { email: w.email },
        {
          $setOnInsert: {
            email:       w.email,
            password:    hashedPassword,
            fullName:    w.name,
            phoneNumber: w.phone,
            city:        w.city,
            platform:    w.platform,
            userType:   'worker',
            isActive:   true,
            onboardingCompleted: true,
            onboardingStep: 3,
            policyActive: true,
            createdAt:   joinDate,
            activeSubscription: {
              planId:    w.plan === 'premium' ? 'total_guard' : 'basic_shield',
              status:    'active',
              startDate: startDate,
              endDate:   endDate,
              amount:    w.premium,
              riskTier:  w.premium > 450 ? 'High' : w.premium > 370 ? 'Moderate' : 'Low',
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      createdUsers.push({ user, workerData: w });

      // Upsert onboarding record
      await Onboarding.findOneAndUpdate(
        { userId: user._id },
        {
          $setOnInsert: {
            userId:                user._id,
            step1_platformLinked:  true,
            linkedPlatform:        w.platform,
            platformCode:          `${w.platform.toUpperCase()}-${rand(1000, 9999)}`,
            step2_paymentCompleted: true,
            premiumPaid:           w.premium,
            weekStartDate:         startDate,
            weekEndDate:           endDate,
            subscriptionActive:    true,
            completedAt:           new Date(joinDate.getTime() + 1800000),
            createdAt:             joinDate,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Upsert subscription
      await Subscription.findOneAndUpdate(
        { userId: user._id },
        {
          $setOnInsert: {
            userId:         user._id,
            weekStartDate:  startDate,
            weekEndDate:    endDate,
            premiumAmount:  w.premium,
            riskTier:       w.premium > 450 ? '🔴 High' : w.premium > 370 ? '🟡 Moderate' : '🟢 Low',
            linkedPlatform: w.platform,
            isActive:       true,
            paymentMethod:  'upi',
            createdAt:      joinDate,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Track premium contribution to pool
      totalContributions += w.premium;
      poolTransactions.push({
        type:      'contribution',
        amount:    w.premium,
        workerId:  user._id.toString(),
        timestamp: joinDate,
      });

      process.stdout.write('.');
    } catch (err) {
      console.error(`\n  ⚠️  Skipped ${w.email}: ${err.message.slice(0, 60)}`);
    }
  }
  console.log(`\n✅ Workers seeded: ${createdUsers.length}\n`);

  // ── 2. Seed past claims ───────────────────────────────────────────────────
  console.log('Seeding historical claims...');
  let claimCount = 0;
  for (const event of DISRUPTION_EVENTS) {
    const eventDate    = daysBack(event.daysAgo);
    const disruptionId = `hist_${event.type}_${event.daysAgo}d`;

    for (const wIdx of event.workers) {
      if (wIdx >= createdUsers.length) continue;
      const { user } = createdUsers[wIdx];
      const txId      = `claim_${crypto.randomBytes(6).toString('hex')}`;

      try {
        await Claim.findOneAndUpdate(
          { transactionId: txId },
          {
            $setOnInsert: {
              transactionId:  txId,
              workerId:       user._id.toString(),
              disruptionId,
              amount:         event.amount,
              upiId:          `${user.phoneNumber}@upi`,
              status:         'paid',
              fraudScore:     rand(5, 22),
              fraudVerdict:   'auto_approve',
              payoutMethod:   'simulated',
              payoutStatus:   'completed',
              payoutTimestamp: new Date(eventDate.getTime() + rand(300000, 7200000)),
              txHash:         `0x${crypto.randomBytes(32).toString('hex')}`,
              autoTriggered:  true,
              triggerSource:  event.type === 'curfew' ? 'curfew' :
                              event.type === 'platform_outage' ? 'platform_outage' : 'weather',
              workerName:     user.fullName,
              workerEmail:    user.email,
              disruptionType: event.type,
              createdAt:      eventDate,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        totalPayouts += event.amount;
        poolTransactions.push({
          type:      'payout',
          amount:    event.amount,
          workerId:  user._id.toString(),
          claimId:   txId,
          timestamp: eventDate,
        });
        claimCount++;
      } catch (err) {
        // duplicate key — skip silently
      }
    }
    process.stdout.write('.');
  }
  console.log(`\n✅ Claims seeded: ${claimCount}\n`);

  // ── 3. Seed liquidity pool ────────────────────────────────────────────────
  console.log('Seeding liquidity pool...');
  const finalBalance = SEED_POOL_BALANCE + totalContributions - totalPayouts;

  await LiquidityPool.findOneAndUpdate(
    { poolId: 'main_pool' },
    {
      $set: {
        totalBalance:       finalBalance,
        totalContributions: SEED_POOL_BALANCE + totalContributions,
        totalPayouts,
        totalClaims:        claimCount,
        totalWorkers:       createdUsers.length,
        lastUpdated:        new Date(),
      },
      $push: {
        transactions: { $each: poolTransactions },
      },
    },
    { upsert: true, new: true }
  );

  console.log(`✅ Liquidity pool updated`);
  console.log(`   Seed capital:    ₹${SEED_POOL_BALANCE.toLocaleString()}`);
  console.log(`   Worker premiums: ₹${totalContributions.toLocaleString()}`);
  console.log(`   Total payouts:   ₹${totalPayouts.toLocaleString()}`);
  console.log(`   Final balance:   ₹${finalBalance.toLocaleString()}\n`);

  console.log('🎉 Demo seed complete!');
  console.log(`   Workers:  ${createdUsers.length}`);
  console.log(`   Claims:   ${claimCount}`);
  console.log(`   Password: ${WORKER_PASSWORD}  (all demo workers)\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
