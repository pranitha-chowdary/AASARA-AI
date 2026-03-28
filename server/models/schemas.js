const mongoose = require('mongoose');

// Telemetry Schema - Stores GPS & sensor data from workers
const telemetrySchema = new mongoose.Schema(
  {
    workerId: { type: String, required: true, index: true },
    gps: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      accuracy: Number,
      timestamp: Date,
    },
    status: { type: String, enum: ['online', 'offline'], default: 'offline' },
    sensors: {
      accelerometer: [Number],
      gyroscope: [Number],
      battery: {
        level: Number,
        temperature: Number,
        isCharging: Boolean,
      },
      pressure: {
        current: Number,
        baseline: Number,
      },
      path: [
        {
          lat: Number,
          lng: Number,
          timestamp: Date,
        },
      ],
    },
    anomalyScore: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Worker Schema - Stores worker profiles & policy info
const workerSchema = new mongoose.Schema(
  {
    workerId: { type: String, required: true, unique: true, index: true },
    fullName: String,
    platform: { type: String, enum: ['zomato', 'swiggy', 'dunzo', 'other'] },
    upiId: String,
    weeklyEarnings: Number,
    weeklyExpenses: Number,
    policyActive: { type: Boolean, default: false },
    premium: { type: Number, default: 40 },
    riskTier: { type: String, default: '🟡 Moderate' },
    activeSince: Date,
    lastUpdated: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Disruption Schema - Tracks environmental/social disruptions
const disruptionSchema = new mongoose.Schema(
  {
    disruptionId: { type: String, required: true, unique: true, index: true },
    eventType: {
      type: String,
      enum: ['monsoon', 'heatwave', 'curfew', 'pollution', 'strike'],
      required: true,
    },
    severity: { type: Number, min: 1, max: 5 },
    zone: {
      lat: Number,
      lng: Number,
      radius: Number, // in km
    },
    affectedWorkers: [String], // Array of worker IDs
    payoutsTriggered: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    timestamp: { type: Date, default: Date.now, index: true },
    resolvedAt: Date,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Claim Schema - Stores payout claims
const claimSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    workerId: { type: String, required: true, index: true },
    disruptionId: { type: String, required: true },
    amount: { type: Number, required: true },
    upiId: String,
    status: {
      type: String,
      enum: ['pending', 'validated', 'approved', 'paid', 'rejected'],
      default: 'pending',
    },
    anomalyScore: Number,
    requiresMicroVerification: Boolean,
    microVerificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
    payoutTimestamp: Date,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Premium History Schema - Tracks weekly premium changes
const premiumHistorySchema = new mongoose.Schema(
  {
    workerId: { type: String, required: true, index: true },
    weekYear: { type: String, required: true }, // Format: "2026-W12"
    premium: { type: Number, required: true },
    riskTier: String,
    weatherData: {
      temperature: Number,
      rainfall: Number,
      aqi: Number,
      curfewAlert: Boolean,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// User Schema - Stores authentication & user profile
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true, index: true },
    userType: { type: String, enum: ['worker', 'admin'], default: 'worker' },
    isActive: { type: Boolean, default: true },
    
    // Onboarding fields
    onboardingStep: { type: Number, default: 1 }, // 1: Platform linking, 2: Payment, 3: Complete
    onboardingCompleted: { type: Boolean, default: false },
    platform: { 
      type: String, 
      enum: ['zomato', 'swiggy', 'dunzo', 'other'],
      default: undefined,
      sparse: true,
      select: true
    },
    platformCode: { type: String, default: null },
    
    // Subscription fields
    activeSubscription: {
      planId: String,
      status: { type: String, enum: ['active', 'expired', 'paused'], default: 'active' },
      startDate: Date,
      endDate: Date,
      amount: Number,
      riskTier: String,
      paymentId: String,
      orderId: String,
      verifiedAt: Date,
    },
    policyActive: { type: Boolean, default: false },
    
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Onboarding Schema - Tracks user's completion of setup steps
const onboardingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true, ref: 'User' },
    step1_platformLinked: { type: Boolean, default: false },
    linkedPlatform: { type: String, enum: ['zomato', 'swiggy', 'dunzo', 'other'], default: null },
    platformCode: { type: String, default: null },
    step2_paymentCompleted: { type: Boolean, default: false },
    weekStartDate: Date,
    weekEndDate: Date,
    premiumPaid: { type: Number, default: 0 },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    subscriptionActive: { type: Boolean, default: false },
    completedAt: Date,
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Subscription Schema - Tracks active subscription and premium details
const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true, ref: 'User' },
    weekStartDate: { type: Date, required: true, index: true },
    weekEndDate: { type: Date, required: true },
    weekNumber: String, // Format: "2026-W12"
    premiumAmount: { type: Number, required: true },
    riskTier: { type: String, default: '🟡 Moderate' },
    linkedPlatform: String,
    isActive: { type: Boolean, default: true },
    paymentMethod: { type: String, enum: ['upi', 'card'], default: 'upi' },
    factors: {
      weatherRisk: Number,
      curfewRisk: Number,
      trafficRisk: Number,
      totalRiskScore: Number,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Export models
module.exports = {
  User: mongoose.model('User', userSchema),
  Onboarding: mongoose.model('Onboarding', onboardingSchema),
  Subscription: mongoose.model('Subscription', subscriptionSchema),
  Telemetry: mongoose.model('Telemetry', telemetrySchema),
  Worker: mongoose.model('Worker', workerSchema),
  Disruption: mongoose.model('Disruption', disruptionSchema),
  Claim: mongoose.model('Claim', claimSchema),
  PremiumHistory: mongoose.model('PremiumHistory', premiumHistorySchema),
};
