"""
AASARA ML Engine — Premium Pricing Model (Two-Tier Plans)
Gradient Boosted Decision Tree (scikit-learn) for dynamic premium calculation
based on multi-factor risk analysis.

Plan Tiers:
  - Basic Shield: ₹19-₹35/week (₹3-₹5/day) — Essential weather & flood coverage
  - Total Guard:  ₹39-₹59/week (₹6-₹9/day) — Full coverage with bonus perks
"""
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

# ============================================================
# PLAN TIER DEFINITIONS
# ============================================================

PLAN_TIERS = {
    'basic': {
        'name': 'Basic Shield',
        'emoji': '🛡️',
        'tagline': 'Essential protection for everyday rides',
        'base_premium_per_day': 4,    # ₹4/day base
        'min_daily': 3,               # ₹3/day minimum
        'max_daily': 5,               # ₹5/day maximum
        'coverage_hours': 8,          # 8h daily coverage
        'max_claim_payout': 500,      # ₹500 max per claim
        'claim_processing': '24 hours',
        'covers': ['Heavy Rain / Flood', 'Extreme Heat (>42°C)', 'Severe Pollution (AQI>300)'],
        'does_not_cover': ['Moderate Disruptions', 'Curfews', 'Strikes', 'Traffic Jams'],
        'zone_discount_eligible': False,
        'bonus_hours_eligible': False,
        'priority_support': False,
        'liquidity_pool_share': 0.6,  # 60% goes to pool
    },
    'premium': {
        'name': 'Total Guard',
        'emoji': '⚡',
        'tagline': 'Complete protection with AI-powered benefits',
        'base_premium_per_day': 7,    # ₹7/day base
        'min_daily': 6,               # ₹6/day minimum
        'max_daily': 9,               # ₹9/day maximum
        'coverage_hours': 16,         # 16h daily coverage
        'max_claim_payout': 1500,     # ₹1500 max per claim
        'claim_processing': 'Instant (< 2 min)',
        'covers': ['Heavy Rain / Flood', 'Extreme Heat (>42°C)', 'Severe Pollution',
                   'Curfews & Lockdowns', 'Strikes & Bandhs', 'Traffic Disruptions',
                   'Platform Outages'],
        'does_not_cover': [],
        'zone_discount_eligible': True,
        'bonus_hours_eligible': True,
        'priority_support': True,
        'liquidity_pool_share': 0.7,  # 70% goes to pool
    },
}


# ============================================================
# TRAINING DATA GENERATION
# ============================================================

def _generate_training_data(plan_type='basic'):
    """
    Generate synthetic training data based on actuarial domain knowledge.
    Separate models for each plan tier with appropriate premium ranges.
    """
    np.random.seed(42 if plan_type == 'basic' else 99)
    n_samples = 2000

    weather_risk = np.random.beta(2, 5, n_samples) * 100
    traffic_risk = np.random.beta(3, 4, n_samples) * 100
    disruption_prob = np.random.beta(1.5, 8, n_samples)
    zone_safety = np.random.beta(5, 2, n_samples) * 100
    seasonal_factor = np.random.choice([0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5], n_samples)
    historical_claims = np.random.beta(1.5, 10, n_samples)
    coverage_days = np.full(n_samples, 7)

    tier = PLAN_TIERS[plan_type]
    base = tier['base_premium_per_day']
    min_d = tier['min_daily']
    max_d = tier['max_daily']

    # Premium formula: base + risk adjustments, clamped to tier range
    premium = (
        base
        + weather_risk * 0.012           # Max +1.2 from weather
        + traffic_risk * 0.006           # Max +0.6 from traffic
        + disruption_prob * 2.0          # Max +2 from disruption
        + (100 - zone_safety) * 0.008    # Max +0.8 from unsafe zone
        + (seasonal_factor - 1.0) * 1.0  # ±0.5 from season
        + historical_claims * 1.0        # Max +1 from claims history
    )

    # Zone safety discount (only for premium plan)
    if plan_type == 'premium':
        safety_discount = np.where(zone_safety > 85, -1.0,
                          np.where(zone_safety > 75, -0.5,
                          np.where(zone_safety > 70, -0.3, 0)))
        premium += safety_discount

    premium = np.clip(premium, min_d, max_d)
    premium += np.random.normal(0, 0.1, n_samples)
    premium = np.clip(premium, min_d, max_d)

    X = np.column_stack([
        weather_risk, traffic_risk, disruption_prob, zone_safety,
        seasonal_factor, historical_claims, coverage_days
    ])

    return X, premium


class AasaraPremiumModel:
    """
    Dual Gradient Boosted Decision Tree models for two-tier pricing.
    """

    FEATURE_NAMES = [
        'weather_risk_score',
        'traffic_risk_score',
        'disruption_probability',
        'zone_safety_score',
        'seasonal_factor',
        'historical_claim_rate',
        'coverage_days',
    ]

    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.is_trained = False
        self._train()

    def _train(self):
        """Train separate models for each plan tier."""
        for plan_type in ['basic', 'premium']:
            print(f"[PremiumModel] Training {plan_type.upper()} tier model...")
            X, y = _generate_training_data(plan_type)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            model = GradientBoostingRegressor(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.1,
                min_samples_split=10,
                min_samples_leaf=5,
                subsample=0.8,
                random_state=42,
            )
            model.fit(X_scaled, y)

            self.models[plan_type] = model
            self.scalers[plan_type] = scaler

            score = model.score(X_scaled, y)
            print(f"[PremiumModel] ✅ {plan_type.upper()} model — R² score: {score:.4f}")

        self.is_trained = True
        print(f"[PremiumModel] Feature importances (basic): {dict(zip(self.FEATURE_NAMES, [round(f, 3) for f in self.models['basic'].feature_importances_]))}")

    def predict_premium(self, weather_risk, traffic_risk, disruption_prob,
                         zone_safety, seasonal_factor, historical_claims,
                         coverage_days=7, plan_type='basic'):
        """
        Predict daily premium for a specific plan tier.
        """
        if not self.is_trained:
            self._train()

        tier = PLAN_TIERS.get(plan_type, PLAN_TIERS['basic'])
        model = self.models.get(plan_type, self.models['basic'])
        scaler = self.scalers.get(plan_type, self.scalers['basic'])

        features = np.array([[
            weather_risk, traffic_risk, disruption_prob,
            zone_safety, seasonal_factor, historical_claims,
            coverage_days
        ]])

        features_scaled = scaler.transform(features)

        # Main prediction
        predicted_daily = float(model.predict(features_scaled)[0])
        predicted_daily = round(max(tier['min_daily'], min(tier['max_daily'], predicted_daily)), 2)

        # Confidence interval
        staged_predictions = list(model.staged_predict(features_scaled))
        if len(staged_predictions) > 10:
            recent_preds = [float(p[0]) for p in staged_predictions[-50:]]
            std_dev = float(np.std(recent_preds))
            confidence = max(0.6, min(0.98, 1.0 - std_dev / 5))
        else:
            confidence = 0.85
            std_dev = 0.3

        # Zone discount (premium plan only)
        zone_discount = 0
        if tier['zone_discount_eligible']:
            if zone_safety >= 85:
                zone_discount = 1.0  # ₹1/day
            elif zone_safety >= 75:
                zone_discount = 0.5
            elif zone_safety >= 70:
                zone_discount = 0.3

        # Feature contribution
        feature_importance = dict(zip(
            self.FEATURE_NAMES,
            [round(float(f), 4) for f in model.feature_importances_]
        ))

        weekly_premium = round(predicted_daily * coverage_days, 2)

        # Dynamic coverage hours (premium plan only)
        base_hours = tier['coverage_hours']
        bonus_hours = 0
        if tier['bonus_hours_eligible']:
            if weather_risk < 20 and zone_safety > 80:
                bonus_hours = 4
            elif weather_risk < 40 and zone_safety > 60:
                bonus_hours = 2
        total_coverage_hours = base_hours + bonus_hours

        # Liquidity pool calculation
        pool_contribution = round(weekly_premium * tier['liquidity_pool_share'], 2)

        return {
            'plan_type': plan_type,
            'plan_name': tier['name'],
            'plan_emoji': tier['emoji'],
            'plan_tagline': tier['tagline'],
            'daily_premium': predicted_daily,
            'weekly_premium': weekly_premium,
            'coverage_days': coverage_days,
            'confidence': round(confidence, 3),
            'confidence_interval': {
                'low': round(max(tier['min_daily'], predicted_daily - std_dev), 2),
                'high': round(min(tier['max_daily'], predicted_daily + std_dev), 2),
            },
            'zone_discount': {
                'amount_per_day': zone_discount,
                'amount_per_week': round(zone_discount * coverage_days, 2),
                'applied': zone_discount > 0,
                'reason': (
                    f"Safe zone (score {round(zone_safety)}/100) — ₹{zone_discount}/day discount!"
                    if zone_discount > 0
                    else ("Zone discount available on Total Guard plan" if plan_type == 'basic'
                          else "No zone discount (safety score below 70)")
                ),
            },
            'dynamic_coverage': {
                'base_hours': base_hours,
                'bonus_hours': bonus_hours,
                'total_hours': total_coverage_hours,
                'reason': (
                    f"Low risk — {bonus_hours} bonus hours!" if bonus_hours > 0
                    else ("Extended coverage available on Total Guard plan" if plan_type == 'basic'
                          else "Standard coverage hours")
                ),
            },
            'max_claim_payout': tier['max_claim_payout'],
            'claim_processing': tier['claim_processing'],
            'covers': tier['covers'],
            'does_not_cover': tier['does_not_cover'],
            'priority_support': tier['priority_support'],
            'liquidity_pool': {
                'your_contribution': pool_contribution,
                'pool_share': f"{int(tier['liquidity_pool_share'] * 100)}%",
                'message': f"₹{pool_contribution} of your premium goes to the community payout pool",
            },
            'feature_importance': feature_importance,
            'risk_tier': (
                '🔴 High Risk' if predicted_daily > (tier['max_daily'] * 0.85) else
                '🟠 Moderate-High' if predicted_daily > (tier['max_daily'] * 0.7) else
                '🟡 Moderate' if predicted_daily > (tier['max_daily'] * 0.5) else
                '🟢 Low Risk'
            ),
            'model_version': '2.0.0-dual-gbdt',
        }

    def predict_both_plans(self, weather_risk, traffic_risk, disruption_prob,
                            zone_safety, seasonal_factor, historical_claims,
                            coverage_days=7):
        """Predict premiums for BOTH plan tiers at once."""
        basic = self.predict_premium(
            weather_risk, traffic_risk, disruption_prob,
            zone_safety, seasonal_factor, historical_claims,
            coverage_days, plan_type='basic'
        )
        premium = self.predict_premium(
            weather_risk, traffic_risk, disruption_prob,
            zone_safety, seasonal_factor, historical_claims,
            coverage_days, plan_type='premium'
        )
        return {'basic': basic, 'premium': premium}


# Singleton
_model_instance = None

def get_model():
    global _model_instance
    if _model_instance is None:
        _model_instance = AasaraPremiumModel()
    return _model_instance
