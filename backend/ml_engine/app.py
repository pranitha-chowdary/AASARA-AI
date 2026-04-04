"""
AASARA ML Engine  Flask API Server (Two-Tier Plans)
Serves dynamic premium pricing via ML model with weather,
traffic, and disruption risk analysis.

Run: python app.py (starts on port 5002)
"""
import os
import sys
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load env from server directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'server', '.env'))

from weather_service import get_current_weather, get_5day_forecast, compute_weather_risk_score
from traffic_service import get_zone_safety_score
from disruption_predictor import predict_weekly_disruptions
from premium_model import get_model
from fraud_engine import get_fraud_engine
from platform_simulator import get_platform_status, get_worker_earnings_history, get_active_orders_in_zone
from vision_service import analyze_disruption_photo
from news_service import scan_social_triggers

app = Flask(__name__)
CORS(app)

# Pre-train the ML models on startup
print("\n AASARA ML ENGINE  Initializing (Two-Tier Plans + Fraud Engine)...")
model = get_model()
fraud_engine = get_fraud_engine()
print("Dual ML Models + 3-Layer Fraud Engine loaded\n")


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok'})


@app.route('/', methods=['GET'])
def health():
    return jsonify({
        'service': 'AASARA ML Engine',
        'status': 'active',
        'model_version': '2.0.0-dual-gbdt',
        'plans': ['basic', 'premium'],
        'endpoints': [
            'POST /api/ml/calculate-premium',
            'POST /api/ml/risk-analysis',
            'POST /api/ml/zone-safety',
            'POST /api/ml/weather-forecast',
            'POST /api/ml/fraud-check',
            'POST /api/ml/verify-photo',
            'POST /api/ml/trigger-scan',
            'POST /api/ml/platform-telemetry',
        ]
    })


def _compute_risk_factors(lat, lng, historical_disruptions=None):
    """Shared risk computation used by multiple endpoints."""
    forecast = get_5day_forecast(lat, lng)
    weather_risk = compute_weather_risk_score(forecast)
    current_weather = get_current_weather(lat, lng)
    zone_safety = get_zone_safety_score(lat, lng)
    disruption_pred = predict_weekly_disruptions(
        city=zone_safety['detected_city'],
        weather_risk_score=weather_risk['score'],
        zone_safety_score=zone_safety['safety_score'],
        historical_disruptions=historical_disruptions or [],
    )
    disruption_prob = disruption_pred['weekly_summary']['avg_disruption_probability']

    month = datetime.now().month
    seasonal_factors = {
        1: 0.9, 2: 0.9, 3: 1.0, 4: 1.1, 5: 1.2,
        6: 1.4, 7: 1.5, 8: 1.4, 9: 1.2, 10: 1.0,
        11: 1.1, 12: 0.9
    }
    seasonal_factor = seasonal_factors.get(month, 1.0)
    historical_claims = min(0.5, len(historical_disruptions or []) * 0.05)

    return {
        'forecast': forecast,
        'weather_risk': weather_risk,
        'current_weather': current_weather,
        'zone_safety': zone_safety,
        'disruption_pred': disruption_pred,
        'disruption_prob': disruption_prob,
        'seasonal_factor': seasonal_factor,
        'historical_claims': historical_claims,
    }


@app.route('/api/ml/calculate-premium', methods=['POST'])
def calculate_premium():
    """
    Main endpoint: Calculate dynamic premium for BOTH plan tiers.

    Input: { lat, lng, coverage_days?, historical_disruptions?, plan_type? }
    Output: Both plan quotes + risk analysis
    """
    try:
        data = request.json or {}
        lat = data.get('lat', 17.3850)
        lng = data.get('lng', 78.4867)
        coverage_days = data.get('coverage_days', 7)
        historical_disruptions = data.get('historical_disruptions', [])

        print(f"\n Two-tier premium calculation for ({lat}, {lng})")

        # Compute risk factors (shared between both plans)
        risk = _compute_risk_factors(lat, lng, historical_disruptions)

        print(f"Weather risk: {risk['weather_risk']['score']}/100")
        print(f" Zone safety: {risk['zone_safety']['safety_score']}/100")
        print(f" Disruption: {risk['disruption_prob']:.1%}")

        # ML Model prediction for BOTH plans
        both_plans = model.predict_both_plans(
            weather_risk=risk['weather_risk']['score'],
            traffic_risk=100 - risk['zone_safety']['safety_score'],
            disruption_prob=risk['disruption_prob'],
            zone_safety=risk['zone_safety']['safety_score'],
            seasonal_factor=risk['seasonal_factor'],
            historical_claims=risk['historical_claims'],
            coverage_days=coverage_days,
        )

        basic = both_plans['basic']
        premium = both_plans['premium']

        print(f" Basic Shield: {basic['daily_premium']}/day = {basic['weekly_premium']}/week")
        print(f" Total Guard: {premium['daily_premium']}/day = {premium['weekly_premium']}/week")

        response = {
            'plans': both_plans,
            'weather': {
                'current': risk['current_weather'],
                'forecast': risk['forecast'],
                'risk': risk['weather_risk'],
            },
            'zone': risk['zone_safety'],
            'disruptions': risk['disruption_pred'],
            'seasonal_factor': risk['seasonal_factor'],
            'model_info': {
                'type': 'DualGradientBoostingRegressor',
                'version': '2.0.0',
                'features_used': model.FEATURE_NAMES,
            },
        }

        return jsonify(response)

    except Exception as e:
        print(f" Premium calculation error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/risk-analysis', methods=['POST'])
def risk_analysis():
    """Full risk analysis without premium calculation."""
    try:
        data = request.json or {}
        lat = data.get('lat', 17.3850)
        lng = data.get('lng', 78.4867)
        risk = _compute_risk_factors(lat, lng)
        return jsonify({
            'weather': {
                'current': risk['current_weather'],
                'forecast': risk['forecast'],
                'risk': risk['weather_risk'],
            },
            'zone': risk['zone_safety'],
            'disruptions': risk['disruption_pred'],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/zone-safety', methods=['POST'])
def zone_safety():
    """Get zone safety score for a location."""
    try:
        data = request.json or {}
        lat = data.get('lat', 17.3850)
        lng = data.get('lng', 78.4867)
        result = get_zone_safety_score(lat, lng)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/weather-forecast', methods=['POST'])
def weather_forecast():
    """Get weather forecast for a location."""
    try:
        data = request.json or {}
        lat = data.get('lat', 17.3850)
        lng = data.get('lng', 78.4867)
        forecast = get_5day_forecast(lat, lng)
        risk = compute_weather_risk_score(forecast)
        current = get_current_weather(lat, lng)
        return jsonify({
            'current': current,
            'forecast': forecast,
            'risk': risk,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==============================================================================
# FRAUD DETECTION ENDPOINTS
# ==============================================================================

@app.route('/api/ml/fraud-check', methods=['POST'])
def fraud_check():
    """Run full 3-layer fraud analysis on a claim."""
    try:
        data = request.json or {}
        worker_id = data.get('worker_id', 'unknown')
        lat = data.get('lat', 17.385)
        lng = data.get('lng', 78.4867)
        platform_status = data.get('platform_status', 'active')

        # If full telemetry provided, run full check
        if data.get('path_points'):
            result = fraud_engine.run_full_check(data)
        else:
            # Quick check with simulated sensors
            result = fraud_engine.quick_check(lat, lng, worker_id, platform_status)

        print(f" Fraud check for {worker_id}: score={result['final_anomaly_score']}, verdict={result['fraud_verdict']}")
        return jsonify(result)
    except Exception as e:
        print(f" Fraud check error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/platform-telemetry', methods=['POST'])
def platform_telemetry():
    """Get simulated platform data for a worker."""
    try:
        data = request.json or {}
        worker_id = data.get('worker_id', 'unknown')
        platform = data.get('platform', 'zomato')
        include_history = data.get('include_history', False)

        status = get_platform_status(worker_id, platform)

        if include_history:
            history = get_worker_earnings_history(worker_id, platform)
            status['earnings_history'] = history

        return jsonify(status)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/trigger-scan', methods=['POST'])
def trigger_scan():
    """
    Automated Trigger Scan  Check all 5 disruption triggers.
    Returns which triggers are active and affected zones.
    """
    try:
        data = request.json or {}
        lat = data.get('lat', 17.385)
        lng = data.get('lng', 78.4867)

        triggers = []

        # Trigger 1: Heavy Rain / Flood (OpenWeatherMap  REAL)
        try:
            current = get_current_weather(lat, lng)
            forecast = get_5day_forecast(lat, lng)
            weather_risk = compute_weather_risk_score(forecast)

            rain_3h = current.get('rain_3h', 0)
            weather_desc = current.get('weather_description', '')

            is_rain_trigger = rain_3h > 20 or 'rain' in weather_desc.lower() or 'storm' in weather_desc.lower()
            triggers.append({
                'id': 'heavy_rain',
                'name': ' Heavy Rain / Flood',
                'source': 'OpenWeatherMap (Real-time)',
                'active': is_rain_trigger,
                'severity': min(5, int(rain_3h / 10) + 1) if is_rain_trigger else 0,
                'data': {
                    'rainfall_mm': rain_3h,
                    'weather': weather_desc,
                    'temperature': current.get('temperature', 0),
                    'risk_score': weather_risk.get('score', 0),
                },
            })
        except Exception as e:
            triggers.append({'id': 'heavy_rain', 'name': ' Heavy Rain', 'active': False, 'error': str(e)})

        # Trigger 2: Heatwave (OpenWeatherMap  REAL)
        try:
            temp = current.get('temperature', 30)
            is_heat_trigger = temp > 42
            triggers.append({
                'id': 'heatwave',
                'name': ' Heatwave',
                'source': 'OpenWeatherMap (Real-time)',
                'active': is_heat_trigger,
                'severity': min(5, int((temp - 42) / 2) + 3) if is_heat_trigger else 0,
                'data': {'temperature': temp, 'feels_like': current.get('feels_like', temp)},
            })
        except:
            triggers.append({'id': 'heatwave', 'name': ' Heatwave', 'active': False, 'error': 'No data'})

        # Trigger 3: Severe Pollution (Simulated AQI)
        import random, hashlib
        random.seed(int(hashlib.md5(f"{lat}{lng}{datetime.now().hour}".encode()).hexdigest()[:8], 16))
        aqi = random.randint(50, 180)  # Simulate  occasionally dangerous
        if datetime.now().month in [10, 11, 12, 1]:  # Winter = worse AQI
            aqi += random.randint(50, 150)
        is_pollution_trigger = aqi > 300
        triggers.append({
            'id': 'pollution',
            'name': ' Severe Pollution',
            'source': 'AQI Monitor (Simulated)',
            'active': is_pollution_trigger,
            'severity': min(5, int((aqi - 300) / 50) + 3) if is_pollution_trigger else 0,
            'data': {'aqi': aqi, 'level': 'Hazardous' if aqi > 300 else 'Unhealthy' if aqi > 150 else 'Moderate'},
        })

        # Trigger 4: Curfew / Bandh  NewsData.io (REAL)
        try:
            city_name = zone.get('detected_city', 'Mumbai') if 'zone' in dir() else 'Mumbai'
            news = scan_social_triggers(city_name)

            curfew_data  = news.get('curfew', {})
            strike_data  = news.get('strike', {})
            flood_alert  = news.get('flood_alert', {})

            is_curfew = curfew_data.get('active', False)
            triggers.append({
                'id': 'curfew',
                'name': ' Curfew / Bandh',
                'source': curfew_data.get('source', 'NewsData.io'),
                'active': is_curfew,
                'severity': 4 if is_curfew else 0,
                'data': {
                    'reason':     'Section 144 / Emergency Curfew' if is_curfew else 'No active curfew',
                    'confidence': curfew_data.get('confidence', 0),
                    'articles':   curfew_data.get('articles', []),
                },
            })

            is_strike = strike_data.get('active', False)
            triggers.append({
                'id': 'transport_strike',
                'name': ' Transport Strike / Bandh',
                'source': strike_data.get('source', 'NewsData.io'),
                'active': is_strike,
                'severity': 3 if is_strike else 0,
                'data': {
                    'reason':     'Active transport strike / bharat bandh' if is_strike else 'No active strike',
                    'confidence': strike_data.get('confidence', 0),
                    'articles':   strike_data.get('articles', []),
                },
            })

            # Supplement Trigger 1 (heavy rain) with government flood alert
            if flood_alert.get('active') and not is_rain_trigger:
                # Upgrade the rain trigger if gov alert fired even without live rain data
                triggers[-3 if len(triggers) >= 3 else 0]['data']['gov_flood_alert'] = flood_alert

        except Exception as news_err:
            print(f'[Trigger Scan] NewsData error: {news_err}')
            # Fallback to simulation if news fetch fails
            is_curfew = random.random() < 0.05
            triggers.append({
                'id': 'curfew',
                'name': ' Curfew / Bandh',
                'source': 'Government API (Fallback  NewsData unavailable)',
                'active': is_curfew,
                'severity': 4 if is_curfew else 0,
                'data': {'reason': 'Section 144 imposed' if is_curfew else 'No active curfew'},
            })
            is_strike = random.random() < 0.04
            triggers.append({
                'id': 'transport_strike',
                'name': ' Transport Strike / Bandh',
                'source': 'NewsData fallback (Simulated)',
                'active': is_strike,
                'severity': 3 if is_strike else 0,
                'data': {'reason': 'Active strike' if is_strike else 'No active strike'},
            })

        active_triggers = [t for t in triggers if t.get('active')]
        zone = get_zone_safety_score(lat, lng)

        print(f"\n Trigger Scan: {len(active_triggers)}/{len(triggers)} active")
        for t in active_triggers:
            print(f"   {t['name']} (severity: {t.get('severity', 0)})")

        return jsonify({
            'scan_time': datetime.now().isoformat(),
            'location': {'lat': lat, 'lng': lng},
            'city': zone.get('detected_city', 'Unknown'),
            'triggers': triggers,
            'active_count': len(active_triggers),
            'total_triggers': len(triggers),
            'zone_safety': zone,
        })
    except Exception as e:
        print(f" Trigger scan error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ==============================================================================
# VISION AI ENDPOINT
# ==============================================================================

@app.route('/api/ml/verify-photo', methods=['POST'])
def verify_photo():
    """
    Analyze a worker-submitted photo to confirm a disruption event.

    Input:
      { image: <base64 string>  }   required

    Output:
      { verified, confidence, disruption_score, analysis, model_used, top_predictions }
    """
    try:
        data = request.json or {}
        image_data = data.get('image')

        if not image_data:
            return jsonify({'error': 'No image data provided. Send { image: "<base64>" }'}), 400

        print(f'\n[VisionAI] Analyzing photo for disruption verification...')
        result = analyze_disruption_photo(image_data)
        print(f'[VisionAI] Score: {result["disruption_score"]}/100  Verified: {result["verified"]}')
        return jsonify(result)

    except Exception as exc:
        print(f'[VisionAI] Error: {exc}')
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(exc)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', os.getenv('ML_ENGINE_PORT', 5002)))
    print(f"\n AASARA ML Engine starting on port {port}")
    print(f" OpenWeatherMap API: {'Configured' if os.getenv('OPENWEATHERMAP_API_KEY') else 'Using default key'}")
    print(f" Model: Dual GBDT v2.0 + Fraud Engine v1.0")
    print(f" Plans: Basic Shield (3-5/day) | Total Guard (6-9/day)")
    print(f" Fraud: 3-Layer Zero-Trust Verification\n")
    app.run(host='0.0.0.0', port=port, debug=False)
