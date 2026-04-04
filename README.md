# AASARA AI: The Safety Net for India's Gig Economy 

### 🎥 2-Minute Pitch & Prototype Demonstration

<p align="center">
  <a href="https://youtu.be/RLQhFWRIxZ0">
    <img src="https://drive.google.com/uc?export=view&id=1YjdBzP-IvrxDjsd15-YtSjw4O8Bp8tCl" width="600">
  </a>
</p>

*(Click the image above to watch our full presentation)*
## 🔐 Live Demo and Credentials
To evaluate the platform, please use the following mock accounts on our live  deployment. 

**Admin Dashboard (Trigger Disruptions):**
* **URL:** [ AASARA AI Prototype](https://aasarai.netlify.app/)
* **Email:** `admin@aasara.ai`
* **Password:** `admin@123456` 

##  1. The Problem Statement
India's platform-based delivery partners are the driving force of the fast-paced digital economy. However, their livelihoods are incredibly vulnerable. External disruptions such as extreme weather conditions, pollution, and sudden social curfews cause these workers to lose 20-30% of their monthly earnings. 

Currently, gig workers bear this full financial loss with zero safety net. **AASARA AI** is built to solve this.

* **Our Scope:** We exclusively insure **Loss of Income** caused by external disruptions.
* **Strict Exclusions:** We strictly exclude coverage for health, life, accidents, or vehicle repairs.

---

##  2. Persona Focus & Scenario
**Chosen Persona:** Platform-based Food Delivery Partners (Zomato, Swiggy).

### The Scenario: Ravi's Lost Hours
* **The Disruption:** Ravi is a Zomato delivery partner in Mumbai. A severe, unpredicted monsoon flood hits his operating zone, forcing him to stop riding for 4 hours. 
* **The Impact:** He loses his base pay for those 4 hours and misses his mandatory daily delivery target, costing him his daily incentive bonus. He loses ₹800 in a single day.
* **The AASARA Solution:** Ravi pays a micro-premium of ₹40/week. When the flood hits, our platform detects the disruption via weather APIs. Our AI validates his location and automatically triggers a parametric payout of ₹700 (covering ~85% of his lost wages) directly to his UPI wallet.
### Financial Impact Analysis: Ravi's Disaster Week
To demonstrate the economic necessity and viability of our platform, here is the financial breakdown of a single "disaster week" (2 days of severe flooding) with and without AASARA AI:

| Financial Metric | BEFORE (No Safety Net) | AFTER (AASARA Protected) |
| :--- | :--- | :--- |
| **Gross Weekly Potential** | ₹6,000 | ₹6,000 |
| **Operational Expenses (Fuel/Data)** | - ₹1,400 | - ₹1,400 |
| **Income Loss (2-Day Flood + Missed Bonus)** | - ₹2,100 | - ₹2,100 |
| **AASARA Weekly Premium** | ₹0 | **- ₹40** |
| **AASARA Parametric Payout** | ₹0 | **+ ₹1,800** |
| **Total Net Take-Home Pay** | **₹2,500** | **₹4,260** |
| **Daily Average Income** | **₹357/day** | **₹608/day** |
| **Status / Savings**| **₹0 (Financial Crisis)** | **₹1,760 (Stable & Secure)** |

**The Unicorn Metric:** For less than 1% of his potential weekly income (a ₹40 micro-premium), Ravi increases his disaster-week take-home pay by **70%**, completely eliminating his financial ruin.

---
## ⚙️ 3. End-to-End Application Workflow

<table align="center">
  <tr>
    <td align="center"><b>AASARA User Flow</b></td>
    <td align="center"><b>System Architecture</b></td>
  </tr>
  <tr>
    <td width="30%"><img src="/docs/workflow.png" alt="User Flow"></td>
    <td width="30%"><img src="/docs/Architecture.png" alt="System Architecture"></td>
  </tr>
</table>

To clearly illustrate how **AASARA AI** functions, we have broken down our workflow into two parts: our core real-world vision, and how we are simulating this ecosystem for the hackathon demonstration.

### Part A: The Core Idea (Real-World Operation)
In a fully deployed real-world scenario, AASARA operates as an invisible, automated safety net that integrates directly with the delivery partner's daily routine:

1. **Account Linking:** The delivery partner downloads AASARA AI and links it to their primary work platform (e.g., Zomato or Swiggy).
2. **Weekly Activation:** The driver pays the AI-calculated micro-premium (e.g., ₹40) to activate coverage for the upcoming week.
3. **Active Monitoring:** While the driver works, AASARA runs quietly in the background. It monitors two things simultaneously: 
    * The driver's live GPS location.
    * External Data APIs (Weather and Local News/Gov alerts).
4. **The Disruption Trigger:** An external event occurs—for example, a weather API reports severe waterlogging (>20mm rain) in the driver's current operating zone.
5. **AI Validation & Payout:** AASARA AI instantly cross-references the weather alert with the driver's status. It confirms the driver was "Online" and stuck in the affected zone. A parametric claim is automatically approved, and the payout is sent instantly to the driver's UPI wallet.

6. **The "Store & Forward":** Offline Fallback: Severe weather often destroys local cell towers. If a worker's internet drops, AASARA AI relies on their "Last Known State." Our backend processes the smart-contract payout server-side and triggers a Twilio SMS Gateway. Even if the local tower is down, telecom carriers queue this SMS, ensuring the worker receives a text confirmation of their financial safety the exact second they regain a single bar of signal.

### Part B: The Hackathon Demonstration (The Mock Data Layer)
Because we are a third-party startup, we do not have access to Zomato or Swiggy's private internal databases or live rider GPS data. To prove our core idea works for the DEVTrails hackathon, we built a **Mock Data Layer** purely for demonstration purposes.

* **What it is:** A simulated environment that generates dummy data. It pretends to be a working delivery driver, outputting fake GPS coordinates and an "Online/Offline" status.
* **How it proves our concept:** Our AASARA app connects to this Mock Layer exactly as it would a real delivery platform. During our final demo, we will simulate a "Heavy Rain Alert." The judges will see AASARA successfully read the mock GPS data, validate that the "simulated driver" was working in the rain, and successfully trigger the automated payout.

---

##  4. Dynamic Weekly Premium Structure & Triggers
Gig workers operate on week-to-week cash flows, making annual policies unviable. Therefore, our financial model is strictly structured on a **Weekly Pricing Basis**. 

To keep the platform affordable while remaining profitable, our AI Risk Engine calculates the premium every Sunday based on hyper-local forecasts. 

###  The AI-Priced Premium Tiers
Here is our dynamic pricing model for a standard food delivery partner based in a metro city:

| Risk Level & Status | Predicted Conditions (Triggers) | Claim Probability | Weekly Premium |
| :--- | :--- | :--- | :--- |
| 🟢 **Tier 1: Low Risk** | Clear skies, normal AQI, no social alerts | < 5% | **₹20 / week** |
| 🟡 **Tier 2: Mod. Risk** | Moderate rain expected, high heat (38°C) | 15% - 30% | **₹35 / week** |
| 🟠 **Tier 3: High Risk** | Monsoon season active, heatwave (>42°C) | 40% - 60% | **₹50 / week** |
| 🔴 **Tier 4: Max Risk** | Gov Red Alerts, Cyclone, Active Curfews | > 75% | **₹75 / week** |

**How the AI adjusts this:** If Ravi is in Tier 1 (🟢) for three weeks, he pays just ₹20. If a sudden cyclone warning hits for week 4, the AI shifts his zone to Tier 4 (🔴), and his premium for that specific week becomes ₹75 to account for the massive likelihood of a payout.

### 🌩️ Our Core Parametric Triggers
Payouts are instantly activated without human intervention when these thresholds are breached:
* **Environmental:** Heatwave (>42°C for 3+ hours), Heavy Rain (>20mm/hr), Severe AQI.
* **Social:** Unplanned Section 144 curfews, documented local transport strikes.
* **Hyper-Local Ward-Level Precision:** We do not use "City-Average" weather data, as it is highly inaccurate for gig workers. Our triggers are tied to hyper-local API resolution (e.g., triggering a flood specifically in Ward K/E - Andheri East, not just "Mumbai").

The 7-Day Underwriting Rule: To prevent workers from subscribing only when a storm is forecasted, our system cross-references platform telemetry. A worker must have a minimum of 7 active delivery days in the past 30 days for their cover to be valid.

### Actuarial Solvency & The 14-Day Stress Test
 To ensure our Liquidity Pool survives catastrophic "Black Swan" events without bankrupting the protocol, we built strict actuarial logic into our backend:

Burning Cost Rate (BCR) & Loss Ratio: We continuously monitor our pool health using the formula: Loss Ratio = (Total Claims Paid) / (Total Premiums Collected).

The Circuit Breaker: If a severe, continuous disaster (e.g., a 14-day monsoon) causes our Loss Ratio to breach the 85% threshold, our smart contracts automatically trigger a "Rollback and Suspend" protocol. New enrollments are instantly halted to prevent adverse selection, ensuring we maintain enough liquidity to pay the workers already trapped in the disaster zone.

---

##  5. Deployment Strategy: Why Mobile?
We are deploying AASARA AI as a **Cross-Platform Mobile Application** with the following technical justifications:
* **Background Telemetry:** Mobile native APIs provide the continuous background GPS tracking required to validate that a worker was actively working in a disrupted zone.
* **Fraud Prevention:** Native device security (biometrics, secure enclaves) makes GPS spoofing significantly harder compared to web browsers.
* **Zero-Touch UX:** Push notifications allow us to instantly alert drivers of impending weather risks and confirm automatic payouts without requiring them to open a browser window while on their bikes.

---

##   6. Smart Premium Calculation & Fraud Detection
We are integrating Machine Learning to ensure our platform remains both affordable for drivers and profitable for the insurer.

* **Dynamic Pricing (Smart Premium):** Using predictive risk modeling, the AI analyzes hyper-local historical weather and traffic data to adjust the weekly premium. High-risk monsoon weeks will carry a slightly higher premium than stable weeks.
* **Automated Fraud Detection:** Our AI anomaly detection engine prevents duplicate claims and analyzes location patterns to flag GPS spoofing or "rain-chasing" (e.g., logging in *after* a storm starts just to claim the payout).
### 🧠 ML Model Architecture & Data Flow
Our AI engine utilizes a **Multi-Model Pipeline** approach, selecting the optimal algorithm for each specific task in the parametric loop. We do not rely on a single "black box" model.

| Task | Primary ML Model | Data Inputs | Output |
| :--- | :--- | :--- | :--- |
| **Dynamic Weekly Premium** | **XGBoost (Regressor)** | Hyper-local historical weather data (10 years), traffic patterns, seasonal trends. | An optimized micro-premium (₹20-₹75) for the upcoming week. |
| **Anomaly & Spoof Detection** | **Isolation Forest (Unsupervised)** | Real-time device telemetry (GPS, Accelerometer, Gyroscope) via Sensor Fusion. | An "Anomaly Score." Scores >Threshold freeze automatic payouts for the Adversarial Defense layer. |
| **Micro-Verification (fallback)** | **EfficientNet-B0 (CNN)** | Live, user-uploaded photo of the disrupted zone. | Binary classification: [Disruption Reality Confirmed / Denied]. |
---

##   7. Adversarial Defense & Anti-Spoofing Strategy
Threat Model: Coordinated syndicates (500+ nodes) utilizing advanced GPS-spoofing to simulate presence in high-risk zones and trigger fraudulent parametric payouts.

To protect the liquidity pool, Asara AI implements a zero-trust verification architecture that renders simple GPS spoofing obsolete. Our defense mechanism operates on three distinct layers:

**1. The Differentiation: Sensor Fusion & Kinematic AI**
We do not trust the OS-level GPS coordinates alone. To differentiate a genuinely stranded delivery partner from a bad actor resting at home, our AI analyzes Device-Level Sensor Fusion:

Movement Kinematics: GPS spoofers often "teleport" or exhibit perfectly linear, robotic movement paths. Our ML models analyze accelerometer and gyroscope data. A real worker navigating a flooded street exhibits erratic, stop-and-go micro-movements. A spoofer’s phone sitting flat on a table registers zero kinetic struggle.

Environmental Context: We cross-reference battery temperature and barometric pressure sensors (available on most modern smartphones). A worker in a severe storm will show different thermal and pressure signatures compared to a phone operating in a climate-controlled room.

**2. The Data: Detecting the Coordinated Syndicate**
A single spoofer is an anomaly; 500 is a network. To catch a fraud ring, our backend analyzes clustering and API telemetry:

Temporal & Spatial Teleportation: If 500 nodes suddenly register in a red-alert zone within seconds of the weather API triggering the threshold, the system flags a "Syndicate Event." Real workers are distributed; they don't simultaneously enter the exact same geofence at the exact same millisecond.

Platform Telemetry Cross-Check: We verify against the Swiggy/Zomato API webhooks. If the user's GPS claims they are in a flooded zone, but the platform API shows they haven't been assigned an active order in the last 2 hours, the claim is instantly flagged.

IP & Network Analysis: Fraud rings often operate via shared VPNs, emulators, or localized Wi-Fi networks. We analyze IP subnet clustering and device metadata to identify orchestrated, multi-device farming from a single physical location.

**Data Integrity via Decentralized Oracles (DON):** While our sensor fusion verifies the worker's reality, our Chainlink DON secures the environmental reality. By utilizing a decentralized oracle network to fetch OpenWeather and Gov APIs, we mathematically guarantee that a syndicate cannot compromise a single centralized server to artificially trigger a "Red Alert" status to match their spoofed locations.

**3. The UX Balance: Protecting the Honest Worker**
Network degradation is a reality during severe monsoons. If an honest worker's GPS drops, their behavior might mimic an anomaly. We ensure they are not unfairly penalized through Graceful Degradation & Asynchronous Proof:

The "Micro-Verification" Fallback: If a worker's data is flagged by our anomaly engine, their account is not banned. Instead, the instant automatic payout is paused, and the app prompts a "Micro-Verification." The worker is asked to take a live, time-stamped photo of the flooded street or their wet vehicle.

Vision AI Resolution: This photo is processed via a lightweight Vision AI model to confirm the environmental reality. Once verified, the funds are released. This introduces slight friction for flagged accounts but guarantees honest workers still get paid, while mathematically destroying the ROI for automated fraud rings.
---

## 🛠️ 7. Tech Stack & Phased Development Plan

**Core Tech Stack:**
* **Frontend:** ![React Native](https://img.shields.io/badge/react_native-%2361DAFB.svg?style=for-the-badge&logo=react&logoColor=black)
* **Backend:** ![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white) ![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
* **Database:** ![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
* **AI/ML Engine:** ![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54) ![Scikit-Learn](https://img.shields.io/badge/scikit--learn-%23F7931E.svg?style=for-the-badge&logo=scikit-learn&logoColor=white) ![TensorFlow](https://img.shields.io/badge/TensorFlow-%23FF6F00.svg?style=for-the-badge&logo=TensorFlow&logoColor=white)
* **Web3 & Automation:** ![Solidity](https://img.shields.io/badge/Solidity-%23363636.svg?style=for-the-badge&logo=solidity&logoColor=white) ![Chainlink](https://img.shields.io/badge/Chainlink-375BD2?style=for-the-badge&logo=Chainlink&logoColor=white)
* **Payments:** ![Razorpay](https://img.shields.io/badge/Razorpay-%230072C6.svg?style=for-the-badge&logo=razorpay&logoColor=white)

* **Communication APIs:** ![Twilio](https://img.shields.io/badge/Twilio-F22F46?style=for-the-badge&logo=twilio&logoColor=white)
* **External APIs:** OpenWeatherMap API (Environmental Triggers), NewsData API (Social Triggers), Mock Payment Gateway (UPI/Stripe).

**Development Roadmap:**
* **Phase 1 (Weeks 1-2):** Foundation. Finalize persona, define weekly pricing model, design architecture, and establish the GitHub repository.
* **Phase 2 (Weeks 3-4):** Automation. Develop the AASARA App Simulator, implement the smart premium calculation engine, and integrate 3-5 parametric API triggers.
* **Phase 3 (Weeks 5-6):** Scale. Deploy the automated AI fraud detection models, finalize the simulated instant payout system, and build the analytics dashboard.
