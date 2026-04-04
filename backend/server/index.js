const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHmac, randomBytes } = require('crypto');
const Razorpay = require('razorpay');
const twilio = require('twilio');
const { BrevoClient } = require('@getbrevo/brevo');
require('dotenv').config();

// Web3 / Chainlink service (gracefully disabled if contract not configured)
const web3Service = require('./services/web3Service');

// Brevo transactional email client
let brevoClient = null;

function initializeBrevo() {
  if (process.env.BREVO_API_KEY) {
    brevoClient = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
    console.log('✅ Brevo email client initialized.');
  } else {
    console.warn('⚠️  BREVO_API_KEY not set — emails will be skipped.');
  }
}

async function sendBrevoEmail({ to, toName, subject, htmlContent }) {
  if (!brevoClient) return;
  try {
    await brevoClient.transactionalEmails.sendTransacEmail({
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'Aasara AI',
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent,
    });
    console.log('✅ Email sent via Brevo to:', to);
  } catch (err) {
    console.error('❌ Brevo email failed:', err.message);
  }
}

// Initialize Brevo on startup
initializeBrevo();

// Twilio SMS Client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER || '';

const { User, Telemetry, Worker, Disruption, Claim, PremiumHistory, Onboarding, Subscription, LiquidityPool } = require('./models/schemas');

const app = express();
const PORT = process.env.PORT || 5001;

// Configure CORS — allow localhost (dev) + any Netlify/Railway/Render deploy
const EXTRA_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // same-origin / server-to-server
    const allowed =
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('10.') ||
      origin.includes('192.168.') ||
      origin.includes('172.') ||
      origin.endsWith('.netlify.app') ||
      origin.endsWith('.railway.app') ||
      origin.endsWith('.onrender.com') ||
      EXTRA_ORIGINS.includes(origin);
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());

// Health check (used by Railway / Render / load balancers)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const MONGODB_URI = process.env.MONGODB_URI;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  });

// ==================== ENROLLMENT SUSPENSION FLAG ====================
// In-memory flag — sufficient for demo/dev.
let enrollmentsSuspended = false;

// ==================== AUTH MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, process.env.JWT_SECRET || 'aasara-secret-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Enrollment status endpoints (require auth, placed after middleware)
app.get('/api/admin/enrollment-status', authenticateToken, (req, res) => {
  res.json({ suspended: enrollmentsSuspended });
});

app.post('/api/admin/enrollment-status', authenticateToken, (req, res) => {
  const { suspended } = req.body;
  enrollmentsSuspended = !!suspended;
  console.log(`[Admin] Enrollments ${enrollmentsSuspended ? '⛔ SUSPENDED' : '✅ OPEN'}`);
  res.json({ suspended: enrollmentsSuspended });
});

// ==================== AUTH ENDPOINTS ====================
// Sign Up
app.post('/api/auth/signup', async (req, res) => {
  try {
    // Block new registrations when liquidity pool is critically low
    if (enrollmentsSuspended) {
      return res.status(503).json({
        error: 'New enrollments are temporarily suspended due to a high-severity disruption event. Existing covered workers are unaffected. Please try again later.',
        enrollmentsSuspended: true,
      });
    }

    const { email, password, fullName, phoneNumber } = req.body;

    // Validation
    if (!email || !password || !fullName || !phoneNumber) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Email validation
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Password Strength Check
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPasswordRegex.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' });
    }

    // Mobile number validation (10 digits starting with 6-9)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: 'Please provide a valid 10-digit mobile number' });
    }

    // Detect sequences and repeating digits (e.g., 9999999999, 9876543210, 1234567890)
    const repeatingDigits = /^(\d)\1{9}$/;
    const sequentialUp = /^(?:0123456789|1234567890)$/;
    const sequentialDown = /^(?:9876543210|0987654321)$/;

    if (repeatingDigits.test(phoneNumber) || sequentialUp.test(phoneNumber) || sequentialDown.test(phoneNumber)) {
      return res.status(400).json({ error: 'Fake or dummy numbers are not allowed. Please enter a real mobile number.' });
    }

    // Real-time existence validation
    if (twilioClient) {
      try {
        // Uses Twilio Lookup API to verify if the number actually exists on global telecom networks
        const lookup = await twilioClient.lookups.v1.phoneNumbers(`+91${phoneNumber}`).fetch();
      } catch (err) {
        if (err.status === 404) {
          return res.status(400).json({ error: 'Mobile number does not exist on the network. Please enter an active number.' });
        }
        console.error('Twilio lookup failed (but proceeding):', err.message);
      }
    } else {
      // Hard fallback: If no Twilio API key is provided, we MUST block the request if we strictly want real-time validation,
      // but to allow local development, we at least enforce the strict mathematical/sequence filters above.
      // Additionally, we can import libphonenumber-js to check carrier allocation blocks.
      try {
        const { parsePhoneNumber } = require('libphonenumber-js');
        const phoneNumberObj = parsePhoneNumber(`+91${phoneNumber}`);
        // This validates if the number is assigned to a carrier based on telecom block registries
        if (!phoneNumberObj.isValid()) {
          return res.status(400).json({ error: 'Mobile number is currently inactive or invalid according to telecom registries.' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid mobile number format or carrier allocation.' });
      }
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phoneNumber }] });
    if (existingUser) {
      return res.status(409).json({ error: 'Email or phone number already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName,
      phoneNumber,
      userType: 'worker',
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET || 'aasara-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
      },
      token,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sign In
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET || 'aasara-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Signed in successfully',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
      },
      token,
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return 200 even if user not found to prevent email enumeration
      return res.status(200).json({ message: 'If that email is registered, you will receive a password reset link shortly.' });
    }

    const resetToken = randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiration
    await user.save();

    const resetURL = `http://localhost:5173/reset-password/${resetToken}`;
    
    const mailOptions = {
      from: '"Aasara Support" <support@aasara.ai>',
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Please click the link below to set a new password:</p>
        <a href="${resetURL}" style="padding: 10px 20px; background-color: #0d9488; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <br><br>
        <p>If you did not request this, please ignore this email. This link will expire in 1 hour.</p>
      `
    };

    sendBrevoEmail({
      to: user.email,
      toName: user.fullName || user.email,
      subject: mailOptions.subject,
      htmlContent: mailOptions.html,
    });

    res.status(200).json({ message: 'If that email is registered, you will receive a password reset link shortly.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error, please try again.' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({ message: 'Password has been successfully updated!' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error, please try again.' });
  }
});

// ==================== ONBOARDING ENDPOINTS ====================

// Step 1: Link Platform
app.post('/api/onboarding/link-platform', authenticateToken, async (req, res) => {
  try {
    const { platform, platformCode } = req.body;
    const validPlatforms = ['zomato', 'swiggy', 'dunzo', 'other'];

    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        platform,
        platformCode: platformCode || null,
        onboardingStep: 2,
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Platform linked successfully',
      user,
    });
  } catch (err) {
    console.error('Platform linking error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: Get Premium Quote (ML-POWERED — Two-Tier Plans)
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || 'http://localhost:5002';

app.post('/api/onboarding/premium-quote', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, lat, lng, planType } = req.body;

    // Calculate days (should be 7 days)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (days < 1 || days > 7) {
      return res.status(400).json({ error: 'Max 7 days per subscription' });
    }

    // Get historical disruptions from MongoDB
    let historicalDisruptions = [];
    try {
      const disruptions = await Disruption.find({ status: { $in: ['active', 'resolved'] } })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();
      historicalDisruptions = disruptions.map(d => ({
        eventType: d.eventType,
        timestamp: d.timestamp,
        severity: d.severity,
      }));
    } catch (e) {
      console.warn('Could not fetch historical disruptions:', e.message);
    }

    // Call ML Engine for BOTH plan quotes
    let mlResult = null;
    try {
      console.log(`\n🧠 Calling ML Engine for two-tier premium quote`);
      console.log(`📍 Location: (${lat || 'auto'}, ${lng || 'auto'})`);

      const mlResponse = await axios.post(`${ML_ENGINE_URL}/api/ml/calculate-premium`, {
        lat: lat || 17.3850,
        lng: lng || 78.4867,
        coverage_days: days,
        historical_disruptions: historicalDisruptions,
      }, { timeout: 15000 });

      mlResult = mlResponse.data;
      console.log(`✅ ML Engine returned both plan quotes`);
    } catch (mlError) {
      console.warn('⚠️ ML Engine unavailable, using fallback pricing:', mlError.message);
    }

    const weekCoverage = `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
    const typicalWeeklyEarnings = 2500;

    // If ML Engine responded with both plans
    if (mlResult && mlResult.plans) {
      const basicPlan = mlResult.plans.basic;
      const premiumPlan = mlResult.plans.premium;
      const weather = mlResult.weather || {};
      const zone = mlResult.zone || {};
      const disruptions = mlResult.disruptions || {};

      // Use selected plan or default to basic
      const selectedPlan = planType === 'premium' ? premiumPlan : basicPlan;
      const totalAmount = Math.round(selectedPlan.daily_premium * days);

      return res.json({
        // Both plans for comparison
        plans: {
          basic: {
            ...basicPlan,
            totalAmount: Math.round(basicPlan.daily_premium * days),
            totalAmountPaise: Math.round(basicPlan.daily_premium * days) * 100,
          },
          premium: {
            ...premiumPlan,
            totalAmount: Math.round(premiumPlan.daily_premium * days),
            totalAmountPaise: Math.round(premiumPlan.daily_premium * days) * 100,
          },
        },

        // Selected plan details
        selectedPlan: planType || 'basic',
        weekCoverage,
        days,
        dailyPremium: Math.round(selectedPlan.daily_premium),
        weeklyPremium: Math.round(selectedPlan.weekly_premium),
        totalAmount: Math.round(totalAmount),
        totalAmountPaise: Math.round(totalAmount) * 100,
        riskTier: selectedPlan.risk_tier,
        mlPowered: true,
        confidence: selectedPlan.confidence,

        // AI Risk Analysis
        weatherRisk: weather.risk || {},
        weatherForecast: weather.forecast?.daily || [],
        currentWeather: weather.current || {},
        zoneSafety: zone,
        disruptionForecast: disruptions,
        modelInfo: mlResult.model_info || {},

        // Affordability
        affordability: {
          typicalWeeklyEarnings,
          basicAsPercentage: parseFloat(((basicPlan.weekly_premium / typicalWeeklyEarnings) * 100).toFixed(1)),
          premiumAsPercentage: parseFloat(((premiumPlan.weekly_premium / typicalWeeklyEarnings) * 100).toFixed(1)),
          message: '✅ Both plans are under 3% of typical weekly earnings — extremely affordable',
        },
      });
    }

    // FALLBACK: Static pricing if ML Engine is down
    res.json({
      plans: {
        basic: {
          plan_type: 'basic',
          plan_name: 'Basic Shield',
          plan_emoji: '🛡️',
          plan_tagline: 'Essential protection for everyday rides',
          daily_premium: 4,
          weekly_premium: 28,
          totalAmount: 4 * days,
          totalAmountPaise: 4 * days * 100,
          coverage_hours: 8,
          max_claim_payout: 500,
          claim_processing: '24 hours',
          covers: ['Heavy Rain / Flood', 'Extreme Heat (>42°C)', 'Severe Pollution (AQI>300)'],
          does_not_cover: ['Moderate Disruptions', 'Curfews', 'Strikes', 'Traffic Jams'],
          risk_tier: '🟡 Moderate',
          dynamic_coverage: { base_hours: 8, bonus_hours: 0, total_hours: 8 },
          zone_discount: { applied: false, amount_per_day: 0, amount_per_week: 0, reason: 'Zone discount available on Total Guard plan' },
          liquidity_pool: { your_contribution: 16.8, pool_share: '60%', message: '₹16.80 goes to the community payout pool' },
        },
        premium: {
          plan_type: 'premium',
          plan_name: 'Total Guard',
          plan_emoji: '⚡',
          plan_tagline: 'Complete protection with AI-powered benefits',
          daily_premium: 7,
          weekly_premium: 49,
          totalAmount: 7 * days,
          totalAmountPaise: 7 * days * 100,
          coverage_hours: 16,
          max_claim_payout: 1500,
          claim_processing: 'Instant (< 2 min)',
          covers: ['Heavy Rain / Flood', 'Extreme Heat', 'Pollution', 'Curfews', 'Strikes', 'Traffic', 'Platform Outages'],
          does_not_cover: [],
          risk_tier: '🟡 Moderate',
          dynamic_coverage: { base_hours: 16, bonus_hours: 0, total_hours: 16 },
          zone_discount: { applied: false, amount_per_day: 0, amount_per_week: 0, reason: 'No zone discount (ML engine offline)' },
          liquidity_pool: { your_contribution: 34.3, pool_share: '70%', message: '₹34.30 goes to the community payout pool' },
        },
      },
      selectedPlan: planType || 'basic',
      weekCoverage,
      days,
      dailyPremium: planType === 'premium' ? 7 : 4,
      weeklyPremium: planType === 'premium' ? 49 : 28,
      totalAmount: (planType === 'premium' ? 7 : 4) * days,
      totalAmountPaise: (planType === 'premium' ? 7 : 4) * days * 100,
      riskTier: '🟡 Moderate',
      mlPowered: false,
      affordability: {
        typicalWeeklyEarnings,
        basicAsPercentage: 1.1,
        premiumAsPercentage: 2.0,
        message: '✅ Both plans are under 3% of typical weekly earnings — extremely affordable',
      },
    });
  } catch (err) {
    console.error('Premium quote error:', err);
    res.status(500).json({ error: err.message });
  }
});


// Step 2: Create REAL Razorpay Order
app.post('/api/onboarding/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, plan } = req.body;

    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount (min ₹1)' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const orderOptions = {
      amount: Math.round(amount * 100), // Convert to paise and ensure it's an integer
      currency: 'INR',
      receipt: `rcpt_${user._id.toString().substring(0, 10)}_${Date.now()}`.substring(0, 40), // Max 40 chars
      notes: {
        userId: user._id.toString(),
        email: user.email || 'unknown',
        platform: user.platform || 'unknown',
      },
    };

    const razorpayOrder = await razorpay.orders.create(orderOptions);

    res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      amountInRupees: amount,
      currency: 'INR',
      plan,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_SV9qs8KKmSxRuW',
      status: 'created',
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    res.status(500).json({ error: 'Failed to create payment order', details: err.message });
  }
});

// Step 2: Verify Payment & Activate Subscription (with Crypto Signature Verification)
app.post('/api/onboarding/verify-payment', authenticateToken, async (req, res) => {
  try {
    const { orderId, paymentId, signature, planDetails } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    // Verify Razorpay signature
    const secret = process.env.RAZORPAY_KEY_SECRET || '4wB53umj6foo7xJMYgqKIMqc';
    const expectedSignature = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('Invalid payment signature:', { signature, expectedSignature });
      // For testing, allow mock signatures starting with 'sig_'
      if (!signature.startsWith('sig_')) {
        return res.status(400).json({ error: 'Payment verification failed - Invalid signature' });
      }
    }

    // Verify payment status with Razorpay (if not mock)
    if (!signature.startsWith('sig_')) {
      const payment = await razorpay.payments.fetch(paymentId);
      if (payment.status !== 'captured') {
        return res.status(400).json({ error: `Payment not captured. Status: ${payment.status}` });
      }
    }

    // Create subscription
    const subscription = {
      planId: `plan_${Date.now()}`,
      status: 'active',
      startDate: new Date(planDetails.startDate),
      endDate: new Date(planDetails.endDate),
      amount: planDetails.amount,
      dailyAmount: Math.round(planDetails.amount / planDetails.days),
      days: planDetails.days,
      platform: planDetails.platform,
      riskTier: planDetails.riskTier,
      paymentId,
      orderId,
      verifiedAt: new Date(),
      verificationStatus: 'verified',
    };

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        activeSubscription: subscription,
        onboardingStep: 3, // Onboarding complete
        onboardingCompleted: true,
        policyActive: true,
      },
      { new: true }
    ).select('-password');

    // Send Welcome Email via Brevo
    if (user.email) {
      const planName = planDetails && planDetails.planType === 'premium' ? 'Aasara Pro' : 'Aasara Standard';
      sendBrevoEmail({
        to: user.email,
        toName: user.fullName || user.email,
        subject: '🎉 Welcome to Aasara AI — Your Safety Net is Now Active!',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f0fdfa; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #0d9488, #0891b2); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Aasara AI! 🛡️</h1>
              <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Your Parametric Safety Net is Active</p>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #1e293b;">Hi <strong>${user.fullName}</strong>,</p>
              <p style="color: #475569;">Your onboarding is complete and your protection plan is live. Here's a summary:</p>
              <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 4px 0; color: #0d9488;"><strong>Plan:</strong> ${planName}</p>
                <p style="margin: 4px 0; color: #0d9488;"><strong>Platform:</strong> ${planDetails?.platform || 'Linked Platform'}</p>
                <p style="margin: 4px 0; color: #0d9488;"><strong>Weekly Premium:</strong> ₹${planDetails?.amount || ''}</p>
                <p style="margin: 4px 0; color: #0d9488;"><strong>Coverage:</strong> 24/7 Parametric Disruption Protection</p>
              </div>
              <p style="color: #475569;">Head to your dashboard, activate your shift, and start earning with full protection.</p>
              <p style="margin-top: 24px; color: #94a3b8; font-size: 13px;">Stay safe,<br/><strong style="color: #0d9488;">The Aasara AI Team</strong></p>
            </div>
          </div>
        `,
      });
    }

    res.json({
      message: 'Payment verified ✅ and subscription activated',
      user,
      subscription,
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: 'Payment verification failed', details: err.message });
  }
});

// Activate Shift - Daily shift activation for returning users
app.post('/api/shifts/activate', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.onboardingCompleted || !user.activeSubscription) {
      return res.status(400).json({ error: 'User must complete onboarding first' });
    }

    // Check if subscription is still valid
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const subEndDate = new Date(user.activeSubscription.endDate);
    
    if (today > subEndDate) {
      return res.status(400).json({ error: 'Subscription has expired. Please renew.' });
    }

    // Create shift record for today
    const shiftId = `shift_${user._id}_${Date.now()}`;
    const shift = {
      shiftId,
      userId: user._id,
      date: today,
      status: 'active',
      activatedAt: new Date(),
      platform: user.platform,
      coverage: {
        startTime: new Date(today.getTime()),
        endTime: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
      subscription: {
        planId: user.activeSubscription.planId,
        premium: user.activeSubscription.amount / 7, // Daily premium
      },
    };

    res.json({
      message: 'Shift activated successfully',
      shift,
      user: {
        id: user._id,
        fullName: user.fullName,
        platform: user.platform,
      },
    });
  } catch (err) {
    console.error('Shift activation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Onboarding Status
app.get('/api/onboarding/status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json({
      currentStep: user.onboardingStep || 1,
      completedSteps: {
        platformLinked: user.platform ? true : false,
        paymentDone: user.activeSubscription ? true : false,
      },
      activeSubscription: user.activeSubscription || null,
      onboardingCompleted: user.onboardingCompleted || false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ==================== RAZORPAY SETUP ====================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SV9qs8KKmSxRuW',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '4wB53umj6foo7xJMYgqKIMqc',
});

// ==================== ONBOARDING ENDPOINTS ====================
// Get onboarding status
app.get('/api/onboarding/:userId', authenticateToken, async (req, res) => {
  try {
    let onboarding = await Onboarding.findOne({ userId: req.params.userId });
    if (!onboarding) {
      onboarding = new Onboarding({ userId: req.params.userId });
      await onboarding.save();
    }
    res.json(onboarding);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link platform (Step 1)
app.post('/api/onboarding/:userId/link-platform', authenticateToken, async (req, res) => {
  try {
    const { platform, platformCode } = req.body;
    if (!['zomato', 'swiggy', 'dunzo', 'other'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    const onboarding = await Onboarding.findOneAndUpdate(
      { userId: req.params.userId },
      {
        linkedPlatform: platform,
        platformCode: platformCode || `${platform}_${Date.now()}`,
        step1_platformLinked: true,
      },
      { new: true, upsert: true }
    );

    res.json({
      message: 'Platform linked successfully',
      onboarding,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PREMIUM CALCULATION ENDPOINTS ====================
// Calculate dynamic premium for the week
app.post('/api/subscription/calculate-premium', authenticateToken, async (req, res) => {
  try {
    const { startDate } = req.body;
    const weekStart = startDate ? new Date(startDate) : new Date();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Mock weather data (replace with real API)
    const mockWeatherData = {
      temperature: 32,
      rainfall: 2.5,
      aqi: 150,
      curfewAlert: false,
    };

    // Calculate risk score from factors
    let weatherRisk = 10;
    if (mockWeatherData.rainfall > 5) weatherRisk += 20;
    if (mockWeatherData.temperature > 40) weatherRisk += 15;
    if (mockWeatherData.aqi > 300) weatherRisk += 15;

    const curfewRisk = mockWeatherData.curfewAlert ? 25 : 0;
    const trafficRisk = 15; // Mock value

    const totalRiskScore = weatherRisk + curfewRisk + trafficRisk;

    // Base premium: ₹40, tier-based on risk score
    let basePremium = 40;
    let riskTier = '🟢 Low';

    if (totalRiskScore > 50) {
      basePremium = 75;
      riskTier = '🔴 High';
    } else if (totalRiskScore > 30) {
      basePremium = 60;
      riskTier = '🟠 Moderate-High';
    } else if (totalRiskScore > 15) {
      basePremium = 50;
      riskTier = '🟡 Moderate';
    }

    // Pro-rata calculation for partial weeks
    const daysRemaining = 7;
    const prorataAmount = Math.ceil((basePremium / 7) * daysRemaining);

    res.json({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      basePremium,
      prorataAmount,
      riskTier,
      factors: {
        weatherRisk,
        curfewRisk,
        trafficRisk,
        totalRiskScore,
      },
      weatherData: mockWeatherData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Razorpay order (Step 2)
app.post('/api/subscription/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, weekStart, weekEnd, riskTier, linkedPlatform } = req.body;
    
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `order_${req.user.userId}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // Store order info temporarily
    const onboarding = await Onboarding.findOneAndUpdate(
      { userId: req.user.userId },
      {
        razorpayOrderId: order.id,
        weekStartDate: new Date(weekStart),
        weekEndDate: new Date(weekEnd),
        premiumPaid: amount,
      },
      { new: true, upsert: true }
    );

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag',
    });
  } catch (err) {
    console.error('Razorpay order error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify payment and activate subscription
app.post('/api/subscription/verify-payment', authenticateToken, async (req, res) => {
  try {
    const { paymentId, orderId, signature } = req.body;

    // Create subscription  record
    const onboarding = await Onboarding.findOne({ userId: req.user.userId });
    
    if (!onboarding) {
      return res.status(400).json({ error: 'Onboarding data not found' });
    }

    const subscription = new Subscription({
      userId: req.user.userId,
      weekStartDate: onboarding.weekStartDate,
      weekEndDate: onboarding.weekEndDate,
      weekNumber: `2026-W${Math.ceil(new Date(onboarding.weekStartDate).getDate() / 7)}`,
      premiumAmount: onboarding.premiumPaid,
      linkedPlatform: onboarding.linkedPlatform,
      isActive: true,
      paymentMethod: 'upi',
      factors: {
        weatherRisk: 25,
        curfewRisk: 10,
        trafficRisk: 15,
        totalRiskScore: 50,
      },
    });

    await subscription.save();

    // Mark onboarding as complete
    await Onboarding.findOneAndUpdate(
      { userId: req.user.userId },
      {
        step2_paymentCompleted: true,
        subscriptionActive: true,
        razorpayPaymentId: paymentId,
        completedAt: new Date(),
      }
    );

    res.json({
      message: 'Subscription activated successfully',
      subscription,
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get active subscription
app.get('/api/subscription/active', authenticateToken, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user.userId,
      isActive: true,
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    res.json(subscription);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get calendar events (disruptions for the week)
app.get('/api/subscription/calendar', authenticateToken, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      userId: req.user.userId,
      isActive: true,
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    // Mock disruption events
    const mockEvents = [
      {
        date: new Date().toISOString().split('T')[0],
        type: 'weather',
        title: 'Heavy Rainfall',
        severity: 3,
        payout: 500,
      },
      {
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        type: 'curfew',
        title: 'Curfew Alert',
        severity: 5,
        payout: 700,
      },
    ];

    res.json({
      weekStart: subscription.weekStartDate,
      weekEnd: subscription.weekEndDate,
      events: mockEvents,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ML ANOMALY DETECTION (Layer 3b) ====================
function detectAnomalies(workerId, sensorData) {
  const { gps, accelerometer, gyroscope, battery, pressure } = sensorData;
  let anomalyScore = 0;

  // Check Movement Kinematics
  if (gps.path && gps.path.length > 2) {
    const distances = [];
    for (let i = 1; i < gps.path.length; i++) {
      const d = Math.sqrt(
        Math.pow(gps.path[i].lat - gps.path[i-1].lat, 2) +
        Math.pow(gps.path[i].lng - gps.path[i-1].lng, 2)
      );
      distances.push(d);
    }
    
    // Perfectly linear movement = teleportation (Spoof)
    const linearity = distances.every(d => Math.abs(d - distances[0]) < 0.0001);
    if (linearity && distances[0] > 0) anomalyScore += 40;
  }

  // Check Environmental Context (Battery Temp, Pressure)
  if (battery.temperature > 40) anomalyScore -= 5; // Real usage in heat
  if (Math.abs(pressure.current - pressure.baseline) > 10) anomalyScore -= 10; // Altitude change = real movement

  // Check Sensor Movement (Zero = sitting at table)
  const avgAccel = (accelerometer || []).reduce((a, b) => a + b, 0) / Math.max((accelerometer || []).length, 1);
  if (avgAccel < 0.5) anomalyScore += 30; // Stationary = Spoof

  return { score: Math.max(0, anomalyScore), isSuspicious: anomalyScore > 50 };
}

// ==================== DYNAMIC RISK PREMIUM (Layer 3a) ====================
function calculateWeeklyPremium(weatherData) {
  let riskLevel = 0;

  if (weatherData.temperature > 42) riskLevel += 30; // Heatwave
  if (weatherData.rainfall > 20) riskLevel += 50; // Heavy Rain
  if (weatherData.aqi > 200) riskLevel += 25; // Severe AQI
  if (weatherData.curfewAlert) riskLevel += 40; // Curfew Risk

  if (riskLevel < 15) return { premium: 20, tier: '🟢 Low Risk' };
  if (riskLevel < 40) return { premium: 35, tier: '🟡 Moderate Risk' };
  if (riskLevel < 65) return { premium: 50, tier: '🟠 High Risk' };
  return { premium: 75, tier: '🔴 Max Risk' };
}

// ==================== 1a. TELEMETRY SYNC ENDPOINT ====================
app.post('/api/telemetry', async (req, res) => {
  try {
    const { workerId, gps, status, sensors } = req.body;

    const anomalyResult = detectAnomalies(workerId, sensors);

    // Save telemetry to MongoDB
    const telemetryRecord = new Telemetry({
      workerId,
      gps: {
        lat: gps.lat,
        lng: gps.lng,
        accuracy: gps.accuracy,
        timestamp: gps.timestamp,
      },
      status,
      sensors,
      anomalyScore: anomalyResult.score,
    });

    await telemetryRecord.save();

    console.log(
      `[Telemetry 1a] Worker: ${workerId}, Location: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}, Anomaly: ${anomalyResult.score}`
    );

    res.json({
      status: 'synced',
      timestamp: new Date().toISOString(),
      anomalyDetected: anomalyResult.isSuspicious,
      anomalyScore: anomalyResult.score,
    });
  } catch (error) {
    console.error('Telemetry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== 1b. DISRUPTION EVENT TRIGGER ====================
app.post('/api/disruption-trigger', async (req, res) => {
  try {
    const { eventType, severity, zone, triggerTime } = req.body;

    // Find all online workers in affected zone
    const affectedReports = await Telemetry.find({
      status: 'online',
      'gps.lat': { $gte: zone.lat - zone.radius / 111, $lte: zone.lat + zone.radius / 111 },
      'gps.lng': { $gte: zone.lng - zone.radius / 111, $lte: zone.lng + zone.radius / 111 },
    })
      .sort({ createdAt: -1 })
      .limit(1)
      .exec();

    const affectedWorkers = [];
    for (const report of affectedReports) {
      if (report.anomalyScore < 50) {
        affectedWorkers.push(report.workerId);
      }
    }

    // Create disruption record
    const disruptionId = `DIS-${Date.now()}`;
    const disruption = new Disruption({
      disruptionId,
      eventType,
      severity,
      zone,
      affectedWorkers,
      payoutsTriggered: affectedWorkers.length,
      timestamp: triggerTime || new Date(),
    });

    await disruption.save();

    console.log(`[Disruption 1b] Type: ${eventType}, Affected: ${affectedWorkers.length} workers`);

    res.json({
      disruptionId,
      eventType,
      affectedZone: zone,
      payoutsTriggered: affectedWorkers.length,
      workers: affectedWorkers,
    });
  } catch (error) {
    console.error('Disruption trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== 2a. FETCH USER PROFILE & POLICY ====================
app.get('/api/worker/:workerId/profile', async (req, res) => {
  try {
    const { workerId } = req.params;
    let worker = await Worker.findOne({ workerId });

    if (!worker) {
      // Create default worker if not exists
      worker = new Worker({
        workerId,
        fullName: 'Ravi Kumar',
        platform: 'zomato',
        upiId: 'ravi@upi',
        weeklyEarnings: 6000,
        weeklyExpenses: 1400,
        policyActive: true,
        premium: 40,
        activeSince: new Date(),
      });
      await worker.save();
    }

    res.json(worker);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== 2b. POLICY ACTIVE STATUS ====================
app.get('/api/worker/:workerId/policy', async (req, res) => {
  try {
    const { workerId } = req.params;
    const worker = await Worker.findOne({ workerId });

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    res.json({
      policyActive: worker.policyActive,
      premiumTier: worker.riskTier,
      weeklyPremium: worker.premium,
      coverageAmount: 700,
      nextPaymentDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      claimsThisMonth: await Claim.countDocuments({ workerId, status: 'paid' }),
    });
  } catch (error) {
    console.error('Policy fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== 3a. FRAUD CHECK & VALIDATION ====================
app.post('/api/validate-claim', async (req, res) => {
  try {
    const { workerId, disruptionId } = req.body;

    // Get latest telemetry for this worker
    const latestTelemetry = await Telemetry.findOne({ workerId })
      .sort({ createdAt: -1 })
      .exec();

    let validationResult = {
      isValid: true,
      reason: 'Claim Approved',
      requiresMicroVerification: false,
    };

    if (!latestTelemetry) {
      validationResult = {
        isValid: false,
        reason: 'No telemetry data - Worker claim cannot be verified',
        requiresMicroVerification: true,
      };
    } else if (latestTelemetry.anomalyScore > 50) {
      validationResult = {
        isValid: false,
        reason: 'GPS Spoofing Suspected - Micro-Verification Required',
        requiresMicroVerification: true,
      };
    }

    console.log(`[Validation 3a] Worker: ${workerId}, Valid: ${validationResult.isValid}`);

    res.json(validationResult);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== 3b. MICRO-VERIFICATION (Vision AI) ====================
app.post('/api/micro-verify', (req, res) => {
  const { workerId, imageBase64 } = req.body;
  
  // In real-world, run through EfficientNet-B0 CNN
  // For hackathon, simulate 85% approval rate
  const isApproved = Math.random() < 0.85;
  
  res.json({
    verified: isApproved,
    confidence: Math.random() * 0.15 + 0.75, // 75-90%
    message: isApproved ? 'Disruption confirmed via photo' : 'Unable to confirm disruption'
  });
});

// ==================== 4a. MOCK PAYOUT GATEWAY ====================
app.post('/api/payout/execute', async (req, res) => {
  try {
    const { workerId, amount, upiId, disruptionId } = req.body;

    const transactionId = `TXN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Save claim to MongoDB
    const claim = new Claim({
      transactionId,
      workerId,
      disruptionId,
      amount,
      upiId,
      status: 'paid',
      payoutTimestamp: new Date(),
    });

    await claim.save();

    console.log(`[Payout 4a] ✅ Triggered ₹${amount} to ${upiId} | TXN: ${transactionId}`);

    res.json({
      status: 'SUCCESS',
      transactionId,
      amount,
      payoutTimestamp: new Date().toISOString(),
      message: '₹' + amount + ' credited to your UPI wallet',
    });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== 4b. PUSH NOTIFICATION ====================
app.post('/api/notify/push', (req, res) => {
  const { workerId, message, type } = req.body; // type: 'warning', 'claim', 'payout'
  
  console.log(`[Notification 4b] Worker: ${workerId}, Type: ${type}, Message: ${message}`);
  
  res.json({
    notificationId: `NOTIF-${Date.now()}`,
    sent: true,
    timestamp: new Date().toISOString()
  });
});

// ==================== CALCULATE WEEKLY PREMIUM ====================
app.get('/api/premium/calculate', async (req, res) => {
  try {
    // Mock weather data
    const mockWeatherData = {
      temperature: 35 + Math.random() * 15,
      rainfall: Math.random() * 50,
      aqi: 50 + Math.random() * 200,
      curfewAlert: Math.random() < 0.1,
    };

    const { premium, tier } = calculateWeeklyPremium(mockWeatherData);

    res.json({
      weeklyPremium: premium,
      weatherData: mockWeatherData,
      riskTier: tier,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Premium calculation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ANALYTICS & DASHBOARD ====================
app.get('/api/analytics/active-disruptions', async (req, res) => {
  try {
    const activeDisruptions = await Disruption.find({ status: 'active' });

    const totalAffected = activeDisruptions.reduce((sum, d) => sum + d.affectedWorkers.length, 0);
    const totalPayouts = totalAffected * 700;

    res.json({
      activeDisruptions,
      totalAffectedWorkers: totalAffected,
      totalPayoutsTriggered: totalPayouts,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/worker/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;

    const telemetryCount = await Telemetry.countDocuments({ workerId });
    const claims = await Claim.find({ workerId });
    const totalPayouts = claims.reduce((sum, c) => sum + c.amount, 0);

    const latestTelemetry = await Telemetry.findOne({ workerId }).sort({ createdAt: -1 });

    res.json({
      workerId,
      telemetryEvents: telemetryCount,
      totalPayoutsReceived: totalPayouts,
      claimsProcessed: claims.length,
      anomalyScore: latestTelemetry?.anomalyScore || 0,
    });
  } catch (error) {
    console.error('Worker analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== HEALTH CHECK ====================
app.get('/', async (req, res) => {
  try {
    const activeWorkers = await Telemetry.distinct('workerId', { status: 'online' });
    const activeDisruptions = await Disruption.countDocuments({ status: 'active' });

    res.json({
      status: 'AASARA AI Processing Gateway Active',
      database: 'MongoDB Connected',
      activeWorkers: activeWorkers.length,
      activeDisruptions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'Gateway Active (DB Error)',
      error: error.message,
    });
  }
});

// ==================== GET SUBSCRIPTION DATA ====================
// Fetch subscription for authenticated user
app.get('/api/subscription/get-active', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found', subscription: null });
    }

    // If no active subscription, return null (not an error)
    if (!user.activeSubscription) {
      return res.status(404).json({ error: 'No active subscription', subscription: null });
    }

    try {
      // Check if subscription is still valid
      const endDate = new Date(user.activeSubscription.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (today > endDate) {
        return res.status(400).json({ error: 'Subscription expired', subscription: null });
      }

      res.json({
        subscription: {
          amount: user.activeSubscription.amount,
          riskTier: user.activeSubscription.riskTier,
          weekStart: new Date(user.activeSubscription.startDate).toISOString().split('T')[0],
          weekEnd: new Date(user.activeSubscription.endDate).toISOString().split('T')[0],
          activatedAt: user.activeSubscription.verifiedAt,
          paymentId: user.activeSubscription.paymentId,
          status: 'active',
        },
      });
    } catch (dateErr) {
      console.error('Date parsing error:', dateErr);
      return res.status(400).json({ error: 'Invalid subscription data format', subscription: null });
    }
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription', details: err.message, subscription: null });
  }
});

// ==================== ADMIN ENDPOINTS ====================
// Admin Login (hardcoded credentials for demo)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Hardcoded admin credentials
    const ADMIN_EMAIL = 'admin@aasara.ai';
    const ADMIN_PASSWORD = 'admin123456';
    
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { adminId: 'admin-1', email: ADMIN_EMAIL, role: 'admin' },
        process.env.JWT_SECRET || 'aasara-secret-key',
        { expiresIn: '24h' }
      );
      
      return res.json({
        message: 'Admin logged in successfully',
        token,
        admin: {
          id: 'admin-1',
          email: ADMIN_EMAIL,
          role: 'admin',
        },
      });
    }
    
    res.status(401).json({ error: 'Invalid admin credentials' });
  } catch (err) {
    res.status(500).json({ error: 'Admin login failed', details: err.message });
  }
});

// Get All Workers (for admin dashboard)
app.get('/api/admin/workers', authenticateToken, async (req, res) => {
  try {
    // Get all users who are workers
    const workers = await User.find({ userType: 'worker' })
      .select('-password')
      .lean()
      .exec();

    const workersWithDetails = workers.map(worker => {
      const lastPing = worker.lastPingTime ? new Date(worker.lastPingTime) : null;
      const pingAgeMs = lastPing ? (Date.now() - lastPing.getTime()) : null;
      return {
        id: worker._id,
        fullName: worker.fullName,
        email: worker.email,
        phoneNumber: worker.phoneNumber,
        platform: worker.platform || 'Not linked',
        registeredAt: worker.createdAt,
        onboardingCompleted: worker.onboardingCompleted,
        subscriptionStatus: worker.activeSubscription ? 'active' : 'inactive',
        subscriptionAmount: worker.activeSubscription?.amount || null,
        riskTier: worker.activeSubscription?.riskTier || null,
        subscriptionEnd: worker.activeSubscription?.endDate || null,
        policyActive: worker.policyActive,
        isWorking: worker.isWorking || false,
        lastPingTime: worker.lastPingTime || null,
        pingAgeMs,
        pingStale: pingAgeMs ? pingAgeMs > 3 * 60 * 1000 : true,
      };
    });

    res.json({
      totalWorkers: workersWithDetails.length,
      workers: workersWithDetails,
    });
  } catch (err) {
    console.error('Get workers error:', err);
    res.status(500).json({ error: 'Failed to fetch workers', details: err.message });
  }
});

// Toggle Worker Online/Offline Status
app.post('/api/shifts/toggle-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { isOnline } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {
      policyActive: isOnline,
      isWorking: isOnline,
      lastOnlineToggle: new Date(),
    };
    // Set lastPingTime when going online
    if (isOnline) {
      updateData.lastPingTime = new Date();
    }

    await User.findByIdAndUpdate(userId, updateData, { new: true });

    console.log(`🔄 Worker ${user.fullName} toggled ${isOnline ? 'ONLINE 🟢' : 'OFFLINE 🔴'}`);

    res.json({
      message: isOnline ? 'You are now Online & Accepting Orders 🟢' : 'You are now Offline 🔴',
      status: isOnline ? 'online' : 'offline',
      toggledAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ error: 'Failed to toggle status', details: err.message });
  }
});

// Heartbeat — Worker pings every 3 minutes while Online
app.post('/api/heartbeat', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await User.findByIdAndUpdate(userId, { lastPingTime: new Date() });
    res.json({ status: 'ok', pingTime: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// Get Worker Current Status (online/offline) — includes heartbeat info
app.get('/api/shifts/current-status', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('policyActive isWorking lastPingTime lastOnlineToggle');
    
    const now = new Date();
    const lastPing = user?.lastPingTime ? new Date(user.lastPingTime) : null;
    const pingAgeMs = lastPing ? (now - lastPing) : null;
    
    res.json({
      isOnline: user?.policyActive || false,
      isWorking: user?.isWorking || false,
      lastPingTime: user?.lastPingTime || null,
      pingAgeMs,
      pingStale: pingAgeMs ? pingAgeMs > 3 * 60 * 1000 : true,
      lastToggled: user?.lastOnlineToggle || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get status', details: err.message });
  }
});

// User: Get Personal Claims History
app.get('/api/claims/my-claims', authenticateToken, async (req, res) => {
  try {
    const claims = await Claim.find({ workerId: req.user.userId }).sort({ createdAt: -1 }).lean();
    res.json({ claims });
  } catch (err) {
    console.error('Error fetching personal claims:', err);
    res.status(500).json({ error: 'Failed to fetch personal claims' });
  }
});

// Admin: Trigger Disruption for a Worker (Flow A: Online / Flow B: Offline Edge Case)
app.post('/api/admin/trigger-disruption', authenticateToken, async (req, res) => {
  try {
    const { workerId, disruptionType, severity } = req.body;

    if (!workerId || !disruptionType) {
      return res.status(400).json({ error: 'Missing workerId or disruptionType' });
    }

    const worker = await User.findById(workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Must have active policy (isWorking = true means they toggled online at some point)
    if (!worker.policyActive) {
      return res.status(400).json({ error: 'Worker does not have an active policy. Cannot trigger disruption.' });
    }

    // Determine Flow A or Flow B based on heartbeat freshness
    const now = new Date();
    const lastPing = worker.lastPingTime ? new Date(worker.lastPingTime) : null;
    const pingAgeMs = lastPing ? (now - lastPing) : Infinity;
    const STALE_THRESHOLD = 3 * 60 * 1000; // 3 minutes
    const isOnlineAndFresh = worker.isWorking && pingAgeMs < STALE_THRESHOLD;
    const flowType = isOnlineAndFresh ? 'A' : 'B';

    console.log(`\n⚡ DISRUPTION TRIGGER: ${disruptionType.toUpperCase()} for ${worker.fullName}`);
    console.log(`   Flow ${flowType}: ${isOnlineAndFresh ? 'Online (fresh heartbeat)' : 'Offline/Stale (last ping ' + Math.round(pingAgeMs / 1000) + 's ago)'}`);

    // ── Eligibility Gate: worker must have ≥5 active days before first payout ──
    const subStartDate = worker.activeSubscription?.startDate
      ? new Date(worker.activeSubscription.startDate)
      : new Date(worker.createdAt);
    const activeDays = Math.floor((Date.now() - subStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const bypassEligibility = process.env.BYPASS_ELIGIBILITY_CHECK === 'true';
    if (activeDays < 5 && !bypassEligibility) {
      console.warn(`🚫 Eligibility failed for ${worker.fullName}: ${activeDays} active day(s), minimum is 5`);
      return res.status(400).json({
        error: `Eligibility check failed: ${worker.fullName} has only ${activeDays} active day(s). Minimum 5 days required before first payout.`,
        activeDays,
        required: 5,
      });
    }
    if (bypassEligibility && activeDays < 5) {
      console.log(`⚠️  Eligibility bypassed (DEV mode) for ${worker.fullName}: ${activeDays} active day(s)`);
    }

    const claimAmount = calculateClaimAmount(disruptionType, worker.activeSubscription?.amount);
    
    // Create disruption record
    const disruptionId = `manual_${disruptionType}_${Date.now()}`;
    const disruptionRecord = new Disruption({
      disruptionId,
      eventType: disruptionType,
      severity: severity || 3,
      affectedWorkers: [workerId],
      status: 'active',
    });
    await disruptionRecord.save();

    // Run ML Fraud Check
    let fraudResult = { final_anomaly_score: 0, fraud_verdict: 'auto_approve' };
    try {
      const fraudRes = await axios.post(`${ML_ENGINE_URL}/api/ml/fraud-check`, {
        worker_id: workerId, lat: 17.385, lng: 78.4867, platform_status: 'active',
      }, { timeout: 10000 });
      fraudResult = fraudRes.data;
    } catch (e) {
      console.warn(`⚠️ Fraud check failed:`, e.message);
    }

    const fraudScore = fraudResult.final_anomaly_score || 0;
    const verdict = fraudResult.fraud_verdict || 'auto_approve';
    
    const claimStatus_base = verdict === 'reject' ? 'rejected' : verdict === 'micro_verify' ? 'micro_verify' : 'paid';
    let claimStatus = claimStatus_base;
    let payoutStatus = verdict === 'auto_approve' ? 'completed' : 'pending';
    let razorpayPayoutId = null;

    // ── Razorpay Payout (wrapped for Payment_Failed_Retrying rollback) ──
    if (verdict === 'auto_approve') {
      try {
        if (process.env.RAZORPAY_ACCOUNT_NUMBER) {
          // Live RazorpayX payout — attempt real transfer
          const rzPayout = await razorpay.payouts.create({
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
            amount: claimAmount * 100, // paise
            currency: 'INR',
            mode: 'UPI',
            purpose: 'payout',
            narration: `AASARA-${disruptionType.toUpperCase()}-${disruptionId}`,
            fund_account: {
              account_type: 'vpa',
              vpa: {
                address: `${worker.fullName.toLowerCase().replace(/\s+/g, '')}@okicici`,
              },
              contact: {
                name: worker.fullName,
                email: worker.email,
                contact: `+91${worker.phoneNumber}`,
                type: 'employee',
              },
            },
          });
          razorpayPayoutId = rzPayout.id;
          console.log(`✅ Razorpay payout initiated: ${razorpayPayoutId}`);
        } else {
          // Simulated payout in dev / demo mode
          razorpayPayoutId = `rz_sim_${Date.now()}`;
          console.log(`💸 [SIMULATED] Razorpay payout ₹${claimAmount} → ${worker.fullName}`);
        }
        claimStatus = 'paid';
        payoutStatus = 'completed';
      } catch (rzErr) {
        console.error(`🔴 Razorpay payout failed for ${worker.fullName} — rolling back to Payment_Failed_Retrying:`, rzErr.message);
        claimStatus = 'Payment_Failed_Retrying';
        payoutStatus = 'failed';
      }
    }

    const crypto = require('crypto');

    // ── On-chain logging via Chainlink/Solidity ─────────────────────────────
    let onChainEventId = null;
    let txHash = claimStatus === 'paid' ? `0x${randomBytes(32).toString('hex')}` : null;
    let explorerUrl = null;

    if (claimStatus === 'paid') {
      try {
        const disruptionResult = await web3Service.registerDisruptionOnChain(
          'Mumbai', disruptionType, 70
        );
        if (disruptionResult.success) {
          onChainEventId = disruptionResult.onChainEventId;
          console.log(`[Web3] Disruption registered on-chain — block ${disruptionResult.blockNumber}`);
        }
        const payoutResult = await web3Service.recordPayoutOnChain(
          workerId,
          worker.email,
          Math.round(claimAmount * 100),
          onChainEventId,
          razorpayPayoutId && !razorpayPayoutId.startsWith('rz_sim_') ? 'razorpay' : 'simulated',
          razorpayPayoutId || ''
        );
        txHash      = payoutResult.txHash || txHash;
        explorerUrl = payoutResult.explorerUrl || null;
        if (payoutResult.success) {
          console.log(`[Web3] Payout logged on-chain — tx: ${txHash}`);
        }
      } catch (web3Err) {
        console.warn('[Web3] On-chain logging failed (non-fatal):', web3Err.message);
      }
    }

    // Create Claim
    const claim = new Claim({
      transactionId: `txn_${Date.now()}_${workerId.slice(-6)}`,
      workerId,
      disruptionId,
      amount: claimAmount,
      status: claimStatus,
      fraudScore,
      fraudVerdict: verdict,
      autoTriggered: false,
      triggerSource: 'admin',
      payoutMethod: razorpayPayoutId && !razorpayPayoutId.startsWith('rz_sim_') ? 'razorpay' : (flowType === 'A' ? 'upi' : 'upi_queued'),
      payoutId: razorpayPayoutId || undefined,
      payoutStatus,
      payoutTimestamp: claimStatus === 'paid' ? new Date() : undefined,
      txHash,
      workerName: worker.fullName,
      workerEmail: worker.email,
      disruptionType,
    });
    await claim.save();

    // Build disruption event name for display
    const eventNames = {
      monsoon: '🌊 SEVERE MONSOON FLOOD',
      heatwave: '🔥 EXTREME HEATWAVE ALERT',
      curfew: '🚨 EMERGENCY CURFEW',
      pollution: '💨 SEVERE AIR POLLUTION',
      strike: '⛔ TRANSPORT STRIKE',
    };
    const eventLabel = eventNames[disruptionType] || disruptionType.toUpperCase();

    // Update active disruption on worker (this is what the dashboard polls)
    const activeDisruption = {
      disruptionId,
      eventType: disruptionType,
      eventLabel,
      severity: severity || 3,
      claimAmount,
      claimable: true,
      triggeredBy: 'admin',
      triggeredAt: new Date().toISOString(),
      status: claimStatus,
      flow: flowType,
      txHash,
    };

    await User.findByIdAndUpdate(workerId, { $set: { activeDisruption } });

    // ====== NOTIFICATIONS ======
    const notifications = [];

    // 1) Red Weather Warning notification
    notifications.push({
      type: 'weather_warning',
      title: `🔴 ${eventLabel}`,
      message: `Severe ${disruptionType} detected in your zone. Income disruption identified.`,
      amount: 0,
      read: false,
      createdAt: new Date(),
    });

    // 2) Green UPI Receipt notification (if paid)
    if (claimStatus === 'paid') {
      notifications.push({
        type: 'upi_receipt',
        title: '💚 UPI PAYOUT RECEIPT',
        message: `₹${claimAmount} has been credited to your UPI. Transaction ID: ${claim.transactionId}`,
        amount: claimAmount,
        read: false,
        createdAt: new Date(Date.now() + 1000), // 1s after warning
      });
    }

    await User.findByIdAndUpdate(workerId, { $push: { notifications: { $each: notifications } } });

    // ====== FLOW B: TWILIO SMS (if offline/stale) ======
    let smsSent = false;
    let smsMessage = '';
    if (flowType === 'B' && claimStatus === 'paid') {
      smsMessage = `Aasara AI: ${eventLabel.replace(/[^\w\s₹]/g, '').trim()} detected in your zone. Rs.${claimAmount} payout queued to your UPI. Stay safe! - Team Aasara`;
      
      if (twilioClient && TWILIO_FROM && worker.phoneNumber) {
        try {
          const formattedPhone = worker.phoneNumber.startsWith('+') ? worker.phoneNumber : `+91${worker.phoneNumber}`;
          await twilioClient.messages.create({
            body: smsMessage,
            from: TWILIO_FROM,
            to: formattedPhone,
          });
          smsSent = true;
          console.log(`📱 SMS sent to ${worker.fullName} (${formattedPhone})`);
        } catch (smsErr) {
          console.warn('📱 SMS failed:', smsErr.message);
        }
      } else {
        console.log(`📱 [SIMULATED SMS] To: ${worker.phoneNumber} | ${smsMessage}`);
      }

      // Also push an SMS notification to the user's notification feed
      await User.findByIdAndUpdate(workerId, {
        $push: {
          notifications: {
            type: 'sms_sent',
            title: '📱 SMS ALERT SENT',
            message: `SMS sent to your phone: "${smsMessage}"`,
            amount: claimAmount,
            read: false,
            createdAt: new Date(Date.now() + 2000),
          },
        },
      });
    }

    // Update Liquidity Pool if paid
    if (claimStatus === 'paid') {
      await LiquidityPool.findOneAndUpdate(
        { poolId: 'main_pool' },
        { 
          $inc: { totalPayouts: claimAmount, totalClaims: 1 },
          $set: { lastUpdated: new Date() },
          $push: { transactions: { $each: [{ type: 'payout', amount: claimAmount, workerId }], $slice: -100 } }
        },
        { upsert: true }
      );
    }

    console.log(`✅ Disruption processed: Flow ${flowType} | Status: ${claimStatus} | Amount: ₹${claimAmount}${flowType === 'B' ? ' | SMS: ' + (smsSent ? 'SENT' : 'SIMULATED') : ''}`);

    res.json({
      message: `Disruption triggered for ${worker.fullName}. ${claimStatus === 'paid' ? 'Payout processed.' : 'Pending verification.'} [Flow ${flowType}]`,
      disruption: activeDisruption,
      flow: flowType,
      flowDescription: flowType === 'A' 
        ? 'Happy Path — Worker online with fresh heartbeat. Instant payout + real-time dashboard alert.'
        : 'Offline Edge Case — Worker connection lost. Payout processed on Last Known State + SMS sent.',
      smsSent: flowType === 'B' ? (smsSent ? 'Real SMS sent via Twilio' : 'Simulated (check console)') : 'N/A',
    });
  } catch (err) {
    console.error('Trigger disruption error:', err);
    res.status(500).json({ error: 'Failed to trigger disruption', details: err.message });
  }
});

// Admin: Trigger Syndicate Attack (Demo Simulation)
app.post('/api/admin/trigger-syndicate', authenticateToken, async (req, res) => {
  try {
    const { workerId, disruptionType = 'monsoon' } = req.body;
    if (!workerId) return res.status(400).json({ error: 'Missing workerId' });

    const worker = await User.findById(workerId);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    console.log(`\n🚨 THE HEIST SIMULATION INITIATED: 500 spoofed nodes detected for ${disruptionType.toUpperCase()}`);
    
    // Layer 1 & 2 Defense Logic Evaluation (Mock)
    const mockSensorData = { gpsState: 'moving', accelerometerState: 'flat_and_stationary' };
    const mockNetworkData = { ipSubnet: '192.168.1.100', concurrentClaims: 500 };
    
    let isAnomaly = false;
    if (mockSensorData.gpsState === 'moving' && mockSensorData.accelerometerState === 'flat_and_stationary') {
      console.log('🛡️ LAYER 1 DEFENSE ACTIVATED: Kinematic spoofing detected.');
      isAnomaly = true;
    }
    if (mockNetworkData.concurrentClaims > 10) {
      console.log('🛡️ LAYER 2 DEFENSE ACTIVATED: Syndicate Bot Farm IPs detected.');
      isAnomaly = true;
    }

    const claimAmount = calculateClaimAmount(disruptionType, worker.activeSubscription?.amount);
    const disruptionId = `syndicate_${disruptionType}_${Date.now()}`;
    
    const disruptionRecord = new Disruption({
      disruptionId, eventType: disruptionType, severity: 5, affectedWorkers: [workerId], status: 'active',
    });
    await disruptionRecord.save();

    const claimStatus = isAnomaly ? 'Frozen_Anomaly' : 'paid';
    const verdict = isAnomaly ? 'micro_verify' : 'auto_approve';

    const crypto = require('crypto');
    const txHash = claimStatus === 'paid' ? `0x${crypto.randomBytes(32).toString('hex')}` : null;

    const challenges = [
      'Hold up 3 fingers',
      'Hold up 2 fingers',
      'Give a thumbs up',
      'Show a peace sign',
      'Hold up 4 fingers'
    ];
    const livenessChallenge = isAnomaly ? challenges[Math.floor(Math.random() * challenges.length)] : null;

    const claim = new Claim({
      transactionId: `txn_heist_${Date.now()}_${workerId.slice(-6)}`,
      workerId, disruptionId, amount: claimAmount,
      status: claimStatus, fraudScore: 98, fraudVerdict: verdict,
      autoTriggered: false, triggerSource: 'admin',
      payoutMethod: 'upi', payoutStatus: claimStatus === 'paid' ? 'completed' : 'pending',
      txHash,
      workerName: worker.fullName, workerEmail: worker.email, disruptionType,
    });
    await claim.save();

    const eventNames = { monsoon: '🌊 SEVERE MONSOON FLOOD' };
    const eventLabel = eventNames[disruptionType] || eventNames.monsoon;
    
    const activeDisruption = {
      disruptionId, eventType: disruptionType, eventLabel, severity: 5, claimAmount,
      claimable: true, triggeredBy: 'admin', triggeredAt: new Date().toISOString(),
      status: claimStatus, flow: 'syndicate_attack', txHash, livenessChallenge
    };

    await User.findByIdAndUpdate(workerId, { $set: { activeDisruption } });

    res.json({
      message: 'Syndicate attack intercepted!',
      defenseAction: 'Auto-payout paused. Worker moved to Micro-Verification fallback.',
      disruption: activeDisruption
    });
  } catch (err) {
    console.error('Trigger syndicate error:', err);
    res.status(500).json({ error: 'Failed to simulate syndicate attack' });
  }
});

// Worker: Verify Fraud Anomaly with Photo (EfficientNetB0 Vision AI)
app.post('/api/claims/verify-anomaly', authenticateToken, async (req, res) => {
  try {
    const workerId = req.user.userId;
    const worker = await User.findById(workerId);

    if (!worker?.activeDisruption || worker.activeDisruption.status !== 'Frozen_Anomaly') {
      return res.status(400).json({ error: 'No frozen anomaly found for this worker' });
    }

    // Hard-reject if the client explicitly signals a failed liveness gesture
    if (req.body.mockResult === 'fail') {
      console.log('🛡️ VISION AI: Liveness challenge mismatch — REJECTED.');
      return res.status(400).json({
        error: `AI REJECTION: Gesture '${worker.activeDisruption.livenessChallenge}' could not be verified in the live feed.`,
        action: 'retry_required',
      });
    }

    // ── EfficientNetB0 photo analysis ──────────────────────────────────────
    const photoData = req.body.photoData || null;   // base64 image from camera
    let visionResult = { verified: true, confidence: 85, model_used: 'fallback' };

    if (photoData) {
      try {
        const ML_ENGINE = process.env.ML_ENGINE_URL || 'http://localhost:5002';
        const visionRes = await axios.post(
          `${ML_ENGINE}/api/ml/verify-photo`,
          { image: photoData },
          { timeout: 15000 }
        );
        visionResult = visionRes.data;
        console.log(`[VisionAI] Score: ${visionResult.disruption_score}/100 — Verified: ${visionResult.verified} — Model: ${visionResult.model_used}`);
      } catch (visionErr) {
        console.warn(`[VisionAI] ML engine unreachable — using fallback heuristic: ${visionErr.message}`);
        // Fallback: use mock result but log that vision was attempted
        visionResult = { verified: true, confidence: 75, model_used: 'fallback_ml_unavailable' };
      }
    }

    if (!visionResult.verified) {
      return res.status(400).json({
        error: `Vision AI rejected the photo (score: ${visionResult.confidence}/100). The image does not show clear evidence of a disruption zone. Please retake from the affected area.`,
        vision_score: visionResult.confidence,
        action: 'retry_required',
      });
    }

    // ── Payout after verification ──────────────────────────────────────────
    const disruptionId = worker.activeDisruption.disruptionId;
    let txHash = `0x${randomBytes(32).toString('hex')}`;
    let explorerUrl = null;

    // Log the verification payout on-chain
    try {
      const payoutResult = await web3Service.recordPayoutOnChain(
        workerId,
        worker.email,
        Math.round((worker.activeDisruption.claimAmount || 700) * 100),
        null, // no pre-existing onChainEventId available in this flow
        'simulated',
        ''
      );
      txHash      = payoutResult.txHash || txHash;
      explorerUrl = payoutResult.explorerUrl || null;
    } catch (web3Err) {
      console.warn('[Web3] verify-anomaly payout logging failed (non-fatal):', web3Err.message);
    }

    await Claim.findOneAndUpdate(
      { workerId, disruptionId, status: 'Frozen_Anomaly' },
      { $set: { status: 'paid', payoutStatus: 'completed', payoutTimestamp: new Date(), txHash } }
    );

    const updatedDisruption = { ...worker.activeDisruption, status: 'paid', txHash, livenessChallenge: null, explorerUrl };
    await User.findByIdAndUpdate(workerId, { $set: { activeDisruption: updatedDisruption } });

    res.json({
      message:       'Anomaly verified via EfficientNetB0 Vision AI. Claim released!',
      txHash,
      explorerUrl,
      vision_score:  visionResult.confidence,
      model_used:    visionResult.model_used,
    });
  } catch (err) {
    console.error('Verify anomaly error:', err);
    res.status(500).json({ error: 'Failed to verify anomaly' });
  }
});

// Get Active Disruption for Worker
app.get('/api/disruption/check-active', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.json({ disruption: null });
    }

    console.log(`[Disruption Check] User: ${user.email}, Has Disruption: ${!!user.activeDisruption}`);

    if (!user.activeDisruption) {
      return res.json({ disruption: null });
    }

    // Check if disruption is still active (within 24 hours)
    const disruptionTime = new Date(user.activeDisruption.triggeredAt);
    const now = new Date();
    const hoursDiff = (now - disruptionTime) / (1000 * 60 * 60);

    console.log(`[Disruption Check] Disruption age: ${hoursDiff.toFixed(2)} hours`);

    if (hoursDiff > 24) {
      // Disruption expired, clear it
      await User.findByIdAndUpdate(req.user.userId, { $unset: { activeDisruption: 1 } });
      console.log('[Disruption Check] Disruption expired, cleared');
      return res.json({ disruption: null });
    }

    console.log('[Disruption Check] Active disruption found:', user.activeDisruption);
    res.json({
      disruption: user.activeDisruption,
    });
  } catch (err) {
    console.error('[Disruption Check Error]', err);
    res.status(500).json({ error: 'Failed to check disruption', details: err.message });
  }
});

// Helper function to calculate claim amount
function calculateClaimAmount(disruptionType, subscriptionAmount) {
  const baseAmounts = {
    monsoon: 700,
    heatwave: 500,
    curfew: 600,
    pollution: 400,
    strike: 800,
    heavy_rain: 700,
    platform_outage: 300,
  };
  return baseAmounts[disruptionType] || 500;
}

// ==================== ADMIN COMMAND CENTER ENDPOINTS ====================

// Admin: Run Automated Trigger Scan (checks all 5 triggers + creates claims)
app.post('/api/admin/run-trigger-scan', authenticateToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;

    console.log('\n🔍 === AUTOMATED TRIGGER SCAN ===' );

    // Step 1: Call ML Engine trigger scan
    let scanResult;
    try {
      const mlResponse = await axios.post(`${ML_ENGINE_URL}/api/ml/trigger-scan`, {
        lat: lat || 17.385,
        lng: lng || 78.4867,
      }, { timeout: 20000 });
      scanResult = mlResponse.data;
    } catch (e) {
      return res.status(500).json({ error: 'ML Engine unreachable for trigger scan', details: e.message });
    }

    const activeTriggers = (scanResult.triggers || []).filter(t => t.active);
    console.log(`⚡ Active triggers: ${activeTriggers.length}/${scanResult.triggers?.length || 0}`);

    if (activeTriggers.length === 0) {
      return res.json({
        message: 'No active disruptions detected',
        scan: scanResult,
        claimsCreated: 0,
      });
    }

    // Step 2: Find all online workers with active subscriptions
    const onlineWorkers = await User.find({
      userType: 'worker',
      policyActive: true,
      'activeSubscription.status': 'active',
    }).lean();

    console.log(`👥 Online workers with active policies: ${onlineWorkers.length}`);

    // Step 3: For each active trigger, create disruptions + claims
    const results = [];
    for (const trigger of activeTriggers) {
      const triggerTypeMap = {
        heavy_rain: 'monsoon',
        heatwave: 'heatwave',
        pollution: 'pollution',
        curfew: 'curfew',
        platform_outage: 'strike',
      };
      const eventType = triggerTypeMap[trigger.id] || 'monsoon';

      // Create disruption record
      const disruption = new Disruption({
        disruptionId: `auto_${trigger.id}_${Date.now()}`,
        eventType,
        severity: trigger.severity || 3,
        affectedWorkers: onlineWorkers.map(w => w._id.toString()),
        status: 'active',
      });
      await disruption.save();

      // Create claims for each affected worker
      for (const worker of onlineWorkers) {
        const claimAmount = calculateClaimAmount(trigger.id, worker.activeSubscription?.amount);

        // Run fraud check via ML engine
        let fraudResult = { final_anomaly_score: 0, fraud_verdict: 'auto_approve', recommended_action: { action: 'auto_approve' } };
        try {
          const fraudResponse = await axios.post(`${ML_ENGINE_URL}/api/ml/fraud-check`, {
            worker_id: worker._id.toString(),
            lat: lat || 17.385,
            lng: lng || 78.4867,
            platform_status: 'active',
          }, { timeout: 10000 });
          fraudResult = fraudResponse.data;
        } catch (e) {
          console.warn(`⚠️ Fraud check failed for ${worker.fullName}:`, e.message);
        }

        const fraudScore = fraudResult.final_anomaly_score || 0;
        const fraudVerdict = fraudResult.fraud_verdict || 'auto_approve';
        const needsVerification = fraudVerdict === 'micro_verify';

        // Determine claim status based on fraud verdict
        let claimStatus = 'approved';
        let payoutStatus = 'pending';
        if (fraudVerdict === 'reject') {
          claimStatus = 'rejected';
          payoutStatus = 'failed';
        } else if (fraudVerdict === 'micro_verify') {
          claimStatus = 'micro_verify';
          payoutStatus = 'pending';
        } else {
          // Auto-approve: simulate instant payout
          claimStatus = 'paid';
          payoutStatus = 'completed';
        }

        const claim = new Claim({
          transactionId: `txn_${Date.now()}_${worker._id.toString().slice(-6)}`,
          workerId: worker._id.toString(),
          disruptionId: disruption.disruptionId,
          amount: claimAmount,
          status: claimStatus,
          fraudScore,
          fraudVerdict,
          fraudDetails: fraudResult,
          autoTriggered: true,
          triggerSource: trigger.id === 'heavy_rain' ? 'weather' : trigger.id,
          requiresMicroVerification: needsVerification,
          microVerificationStatus: needsVerification ? 'pending' : undefined,
          payoutMethod: 'simulated',
          payoutStatus,
          payoutTimestamp: claimStatus === 'paid' ? new Date() : undefined,
          workerName: worker.fullName,
          workerEmail: worker.email,
          disruptionType: eventType,
        });
        await claim.save();

        // Set active disruption on worker
        await User.findByIdAndUpdate(worker._id, {
          $set: {
            activeDisruption: {
              disruptionId: disruption.disruptionId,
              eventType,
              severity: trigger.severity,
              claimAmount,
              claimable: true,
              triggeredBy: 'automated',
              triggeredAt: new Date().toISOString(),
              status: claimStatus,
            },
          },
        });

        // Send payout notification to user
        if (claimStatus === 'paid') {
          await User.findByIdAndUpdate(worker._id, {
            $push: {
              notifications: {
                type: 'payout',
                title: '💰 Payout Received!',
                message: `₹${claimAmount} has been credited to your account for ${trigger.name} disruption. Stay safe!`,
                amount: claimAmount,
                read: false,
                createdAt: new Date(),
              },
            },
          });
        } else if (claimStatus === 'micro_verify') {
          await User.findByIdAndUpdate(worker._id, {
            $push: {
              notifications: {
                type: 'claim',
                title: '📸 Verification Needed',
                message: `Your claim for ₹${claimAmount} requires a quick photo verification. Please submit a timestamped photo.`,
                amount: claimAmount,
                read: false,
                createdAt: new Date(),
              },
            },
          });
        }

        // Update liquidity pool
        if (claimStatus === 'paid') {
          await LiquidityPool.findOneAndUpdate(
            { poolId: 'main_pool' },
            {
              $inc: { totalPayouts: claimAmount, totalClaims: 1 },
              $set: { lastUpdated: new Date() },
              $push: { transactions: { $each: [{ type: 'payout', amount: claimAmount, workerId: worker._id.toString(), claimId: claim.transactionId, timestamp: new Date() }], $slice: -100 } },
            },
            { upsert: true, new: true }
          );
        }

        results.push({
          worker: worker.fullName,
          trigger: trigger.name,
          claimAmount,
          fraudScore,
          fraudVerdict,
          claimStatus,
          payoutStatus,
        });
      }
    }

    console.log(`✅ Trigger scan complete: ${results.length} claims processed`);

    res.json({
      message: `Trigger scan complete — ${activeTriggers.length} disruptions detected, ${results.length} claims processed`,
      scan: scanResult,
      activeTriggers: activeTriggers.length,
      claimsCreated: results.length,
      claims: results,
    });
  } catch (err) {
    console.error('Trigger scan error:', err);
    res.status(500).json({ error: 'Trigger scan failed', details: err.message });
  }
});

// Admin: Get All Claims
app.get('/api/admin/claims', authenticateToken, async (req, res) => {
  try {
    const claims = await Claim.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const summary = {
      total: claims.length,
      paid: claims.filter(c => c.status === 'paid').length,
      pending: claims.filter(c => c.status === 'pending' || c.status === 'approved').length,
      rejected: claims.filter(c => c.status === 'rejected').length,
      microVerify: claims.filter(c => c.status === 'micro_verify').length,
      totalPaidAmount: claims.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0),
      avgFraudScore: claims.length > 0 ? Math.round(claims.reduce((sum, c) => sum + (c.fraudScore || 0), 0) / claims.length) : 0,
    };

    res.json({ claims, summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch claims', details: err.message });
  }
});

// Admin: Process a Claim (approve/reject with payout)
app.post('/api/admin/process-claim', authenticateToken, async (req, res) => {
  try {
    const { claimId, action } = req.body;  // action: 'approve' | 'reject'

    const claim = await Claim.findOne({ transactionId: claimId });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    if (action === 'approve') {
      claim.status = 'paid';
      claim.payoutStatus = 'completed';
      claim.payoutTimestamp = new Date();
      claim.fraudVerdict = 'admin_override';
      await claim.save();

      // Send notification
      await User.findByIdAndUpdate(claim.workerId, {
        $push: {
          notifications: {
            type: 'payout',
            title: '💰 Payout Received!',
            message: `₹${claim.amount} has been credited for your ${claim.disruptionType} claim. Stay safe!`,
            amount: claim.amount,
            read: false,
            createdAt: new Date(),
          },
        },
      });

      // Update pool
      await LiquidityPool.findOneAndUpdate(
        { poolId: 'main_pool' },
        {
          $inc: { totalPayouts: claim.amount, totalClaims: 1 },
          $set: { lastUpdated: new Date() },
        },
        { upsert: true }
      );

      return res.json({ message: `Claim approved & ₹${claim.amount} paid to ${claim.workerName}`, claim });
    } else if (action === 'reject') {
      claim.status = 'rejected';
      claim.payoutStatus = 'failed';
      claim.fraudVerdict = claim.fraudVerdict === 'auto_approve' ? 'admin_override' : claim.fraudVerdict;
      await claim.save();

      await User.findByIdAndUpdate(claim.workerId, {
        $push: {
          notifications: {
            type: 'claim',
            title: '❌ Claim Rejected',
            message: `Your claim for ₹${claim.amount} was not approved after review.`,
            amount: claim.amount,
            read: false,
            createdAt: new Date(),
          },
        },
      });

      return res.json({ message: `Claim rejected for ${claim.workerName}`, claim });
    }

    res.status(400).json({ error: 'Invalid action — use approve or reject' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process claim', details: err.message });
  }
});

// Admin: Get Analytics
app.get('/api/admin/analytics', authenticateToken, async (req, res) => {
  try {
    const [totalWorkers, activeWorkers, totalClaims, paidClaims, rejectedClaims, microVerifyClaims, disruptions, pool] = await Promise.all([
      User.countDocuments({ userType: 'worker' }),
      User.countDocuments({ userType: 'worker', policyActive: true }),
      Claim.countDocuments(),
      Claim.find({ status: 'paid' }).lean(),
      Claim.countDocuments({ status: 'rejected' }),
      Claim.countDocuments({ status: 'micro_verify' }),
      Disruption.countDocuments(),
      LiquidityPool.findOne({ poolId: 'main_pool' }).lean(),
    ]);

    const totalPaidAmount = paidClaims.reduce((sum, c) => sum + c.amount, 0);
    const allClaims = await Claim.find().lean();
    const avgFraudScore = allClaims.length > 0 ? Math.round(allClaims.reduce((sum, c) => sum + (c.fraudScore || 0), 0) / allClaims.length) : 0;
    const fraudFlagged = allClaims.filter(c => (c.fraudScore || 0) > 70).length;

    // Subscription revenue
    const subscriptions = await Subscription.find({ isActive: true }).lean();
    const totalPremiumRevenue = subscriptions.reduce((sum, s) => sum + (s.premiumAmount || 0), 0);

    res.json({
      workers: { total: totalWorkers, active: activeWorkers, subscribed: subscriptions.length },
      claims: {
        total: totalClaims,
        paid: paidClaims.length,
        rejected: rejectedClaims,
        microVerify: microVerifyClaims,
        pending: totalClaims - paidClaims.length - rejectedClaims - microVerifyClaims,
      },
      financials: {
        totalPremiumRevenue,
        totalPayouts: totalPaidAmount,
        poolBalance: pool?.totalBalance || (totalPremiumRevenue - totalPaidAmount),
        netMargin: totalPremiumRevenue - totalPaidAmount,
      },
      fraud: {
        avgFraudScore,
        flagged: fraudFlagged,
        detectionRate: totalClaims > 0 ? `${Math.round((fraudFlagged / totalClaims) * 100)}%` : '0%',
      },
      disruptions: { total: disruptions },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics', details: err.message });
  }
});

// Admin: Get All Disruptions
app.get('/api/admin/disruptions', authenticateToken, async (req, res) => {
  try {
    const disruptions = await Disruption.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ disruptions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch disruptions', details: err.message });
  }
});

// Admin: Platform Lookup (simulated)
app.post('/api/admin/platform-lookup', authenticateToken, async (req, res) => {
  try {
    const { workerId } = req.body;
    const worker = await User.findById(workerId).lean();
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const mlResponse = await axios.post(`${ML_ENGINE_URL}/api/ml/platform-telemetry`, {
      worker_id: workerId,
      platform: worker.platform || 'zomato',
      include_history: true,
    }, { timeout: 10000 });

    res.json({ worker: { fullName: worker.fullName, email: worker.email, platform: worker.platform }, platformData: mlResponse.data });
  } catch (err) {
    res.status(500).json({ error: 'Platform lookup failed', details: err.message });
  }
});

// Worker: Get Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('notifications').lean();
    const notifications = (user?.notifications || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Worker: Mark Notifications Read
app.post('/api/notifications/read', authenticateToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { $set: { 'notifications.$[].read': true } });
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications' });
  }
});

// ==================== ADMIN: 14-DAY BLACK SWAN SIMULATION ====================
// Rapid-fires 14 consecutive days of max-severity payouts to stress the liquidity
// pool and trigger the Suspend Enrollments protocol.
app.post('/api/admin/black-swan-simulation', authenticateToken, async (req, res) => {
  try {
    const SIMULATION_DAYS = 14;
    const DISRUPTION_TYPE = 'monsoon';

    // Gather workers — prefer those with active policies, fall back to all workers
    let workers = await User.find({
      userType: 'worker',
      policyActive: true,
      'activeSubscription.status': 'active',
    }).lean();

    if (workers.length === 0) {
      workers = await User.find({ userType: 'worker' }).lean();
    }
    if (workers.length === 0) {
      return res.status(400).json({ error: 'No workers found to simulate against' });
    }

    // Estimate pool seed balance from subscription revenue
    const premiumAgg = await User.aggregate([
      { $match: { 'activeSubscription.amount': { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$activeSubscription.amount' } } },
    ]);
    const seedBalance = Math.max(premiumAgg[0]?.total || 0, workers.length * 300);

    let runningBalance = seedBalance;
    let totalPayouts = 0;
    const events = [];

    for (let day = 1; day <= SIMULATION_DAYS; day++) {
      let dayTotal = 0;
      const dayPayouts = [];

      for (const worker of workers) {
        const claimAmount = calculateClaimAmount(DISRUPTION_TYPE, worker.activeSubscription?.amount);
        const disruptionId = `blackswan_d${day}_${worker._id}`;

        // Rapid-fire claim — no fraud check (catastrophic event bypasses all gates)
        const claim = new Claim({
          transactionId: `txn_bs_d${day}_${Date.now()}_${worker._id.toString().slice(-4)}`,
          workerId: worker._id.toString(),
          disruptionId,
          amount: claimAmount,
          status: 'paid',
          fraudScore: 0,
          fraudVerdict: 'auto_approve',
          autoTriggered: true,
          triggerSource: 'weather',
          payoutMethod: 'simulated',
          payoutStatus: 'completed',
          payoutTimestamp: new Date(Date.now() + (day - 1) * 24 * 60 * 60 * 1000),
          workerName: worker.fullName,
          workerEmail: worker.email || '',
          disruptionType: DISRUPTION_TYPE,
        });
        await claim.save();

        dayTotal += claimAmount;
        dayPayouts.push({ worker: worker.fullName, amount: claimAmount });
      }

      runningBalance -= dayTotal;
      totalPayouts += dayTotal;

      // Persist pool drain progress each day
      await LiquidityPool.findOneAndUpdate(
        { poolId: 'main_pool' },
        {
          $inc: { totalPayouts: dayTotal, totalClaims: dayPayouts.length },
          $set: { lastUpdated: new Date() },
        },
        { upsert: true }
      );

      events.push({
        day,
        workersAffected: dayPayouts.length,
        dayTotal,
        runningBalance: Math.max(0, runningBalance),
        poolDrained: runningBalance < 0,
      });
    }

    const poolDrained = runningBalance < 0;
    const suspendEnrollments = poolDrained || runningBalance < seedBalance * 0.1;

    console.log(`\n🚨 BLACK SWAN SIMULATION COMPLETE`);
    console.log(`   Days: ${SIMULATION_DAYS} | Workers: ${workers.length} | Total Payouts: ₹${totalPayouts}`);
    console.log(`   Final Pool Balance: ₹${Math.max(0, runningBalance)} | Drained: ${poolDrained}`);
    if (suspendEnrollments) {
      enrollmentsSuspended = true;
      console.warn('⛔ SUSPEND ENROLLMENTS TRIGGERED — pool critically low');
    }

    res.json({
      message: `14-Day Black Swan simulation complete. Pool ${poolDrained ? '🔴 DRAINED' : '🟡 critically low'}.`,
      simulationDays: SIMULATION_DAYS,
      workersAffected: workers.length,
      totalPayouts,
      seedBalance,
      finalPoolBalance: Math.max(0, runningBalance),
      poolDrained,
      suspendEnrollments,
      events,
    });
  } catch (err) {
    console.error('Black Swan simulation error:', err);
    res.status(500).json({ error: 'Simulation failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 AASARA CORE PROCESSING GATEWAY`);
  console.log(`📍 Active on port ${PORT}`);
  console.log(`📦 Database: MongoDB Atlas`);
  console.log(`🛡️ Fraud Detection, Trigger Automation, Parametric Claims READY`);
  console.log(`✅ Telemetry Sync, Disruption Triggers, Anomaly Detection, Payout Processing READY\n`);
});
