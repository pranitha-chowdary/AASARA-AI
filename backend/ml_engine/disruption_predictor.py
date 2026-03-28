"""
AASARA ML Engine — Disruption Predictor
Analyzes historical disruption patterns and seasonal data
to predict disruption probability for the upcoming week.
"""
from datetime import datetime, timedelta
import math
import random

# ============================================================
# SEASONAL DISRUPTION PATTERNS FOR INDIA
# Based on historical data from NDMA, IMD, and news sources
# ============================================================

SEASONAL_PATTERNS = {
    # Month -> {disruption_type: probability}
    1: {'monsoon': 0.02, 'heatwave': 0.0, 'curfew': 0.05, 'pollution': 0.3, 'strike': 0.1},   # January
    2: {'monsoon': 0.02, 'heatwave': 0.05, 'curfew': 0.05, 'pollution': 0.15, 'strike': 0.08},
    3: {'monsoon': 0.03, 'heatwave': 0.15, 'curfew': 0.05, 'pollution': 0.1, 'strike': 0.1},    # March - heat starts
    4: {'monsoon': 0.05, 'heatwave': 0.35, 'curfew': 0.05, 'pollution': 0.05, 'strike': 0.1},
    5: {'monsoon': 0.08, 'heatwave': 0.50, 'curfew': 0.05, 'pollution': 0.03, 'strike': 0.12},  # May - peak heat
    6: {'monsoon': 0.45, 'heatwave': 0.20, 'curfew': 0.05, 'pollution': 0.02, 'strike': 0.08},  # June - monsoon arrives
    7: {'monsoon': 0.70, 'heatwave': 0.05, 'curfew': 0.05, 'pollution': 0.02, 'strike': 0.07},  # July - peak monsoon
    8: {'monsoon': 0.65, 'heatwave': 0.05, 'curfew': 0.05, 'pollution': 0.02, 'strike': 0.08},
    9: {'monsoon': 0.40, 'heatwave': 0.08, 'curfew': 0.05, 'pollution': 0.05, 'strike': 0.1},   # Sept - monsoon retreat
    10: {'monsoon': 0.15, 'heatwave': 0.05, 'curfew': 0.05, 'pollution': 0.15, 'strike': 0.1},
    11: {'monsoon': 0.05, 'heatwave': 0.02, 'curfew': 0.05, 'pollution': 0.40, 'strike': 0.1},  # Nov - pollution spike
    12: {'monsoon': 0.03, 'heatwave': 0.0, 'curfew': 0.08, 'pollution': 0.35, 'strike': 0.12},
}

# Day-of-week patterns (strikes/protests more common on certain days)
DAY_PATTERNS = {
    0: {'strike_multiplier': 1.5, 'curfew_multiplier': 1.0},  # Monday - Bandh day
    1: {'strike_multiplier': 1.0, 'curfew_multiplier': 1.0},
    2: {'strike_multiplier': 0.8, 'curfew_multiplier': 1.0},
    3: {'strike_multiplier': 0.8, 'curfew_multiplier': 1.0},
    4: {'strike_multiplier': 1.2, 'curfew_multiplier': 1.0},  # Friday
    5: {'strike_multiplier': 0.5, 'curfew_multiplier': 1.2},  # Saturday
    6: {'strike_multiplier': 0.3, 'curfew_multiplier': 1.3},  # Sunday
}

# City-specific risk modifiers
CITY_RISK_MODIFIERS = {
    'Mumbai': {'monsoon': 1.5, 'heatwave': 0.8, 'pollution': 0.6, 'strike': 1.2, 'curfew': 0.8},
    'Delhi': {'monsoon': 0.8, 'heatwave': 1.3, 'pollution': 1.8, 'strike': 1.3, 'curfew': 1.0},
    'Bangalore': {'monsoon': 1.2, 'heatwave': 0.5, 'pollution': 0.4, 'strike': 0.8, 'curfew': 0.7},
    'Hyderabad': {'monsoon': 1.3, 'heatwave': 1.2, 'pollution': 0.5, 'strike': 0.9, 'curfew': 0.8},
    'Chennai': {'monsoon': 1.4, 'heatwave': 1.0, 'pollution': 0.3, 'strike': 1.0, 'curfew': 0.7},
    'Pune': {'monsoon': 1.1, 'heatwave': 0.9, 'pollution': 0.5, 'strike': 0.7, 'curfew': 0.6},
    'Kolkata': {'monsoon': 1.3, 'heatwave': 1.1, 'pollution': 0.8, 'strike': 1.5, 'curfew': 0.9},
}


def predict_weekly_disruptions(city='Unknown', weather_risk_score=0, zone_safety_score=100,
                                historical_disruptions=None):
    """
    Predict disruption probabilities for the upcoming 7 days.
    
    Args:
        city: Detected city name
        weather_risk_score: 0-100 from weather service
        zone_safety_score: 0-100 from traffic service
        historical_disruptions: List of past disruption records from MongoDB
    
    Returns:
        Daily disruption probabilities and aggregate risk
    """
    today = datetime.now()
    daily_predictions = []
    
    # Get city-specific modifiers
    city_mod = CITY_RISK_MODIFIERS.get(city, {
        'monsoon': 1.0, 'heatwave': 1.0, 'pollution': 1.0, 'strike': 1.0, 'curfew': 1.0
    })

    # Process historical disruptions for pattern learning
    historical_weight = _analyze_historical_patterns(historical_disruptions or [])

    total_disruption_prob = 0

    for day_offset in range(7):
        date = today + timedelta(days=day_offset)
        month = date.month
        day_of_week = date.weekday()

        seasonal = SEASONAL_PATTERNS.get(month, SEASONAL_PATTERNS[1])
        day_mod = DAY_PATTERNS.get(day_of_week, DAY_PATTERNS[1])

        # Calculate per-type disruption probability
        type_probs = {}
        for dtype in ['monsoon', 'heatwave', 'curfew', 'pollution', 'strike']:
            base_prob = seasonal.get(dtype, 0.05)
            
            # Apply city modifier
            city_factor = city_mod.get(dtype, 1.0)
            
            # Apply day-of-week modifier
            if dtype == 'strike':
                day_factor = day_mod.get('strike_multiplier', 1.0)
            elif dtype == 'curfew':
                day_factor = day_mod.get('curfew_multiplier', 1.0)
            else:
                day_factor = 1.0

            # Weather amplification: if weather risk is high, monsoon/heatwave probs increase
            weather_factor = 1.0
            if dtype in ['monsoon'] and weather_risk_score > 50:
                weather_factor = 1.0 + (weather_risk_score - 50) / 100
            elif dtype in ['heatwave'] and weather_risk_score > 40:
                weather_factor = 1.0 + (weather_risk_score - 40) / 150

            # Zone safety modifier: unsafe zones have higher disruption exposure
            zone_factor = 1.0 + (100 - zone_safety_score) / 200

            # Historical pattern weight
            hist_factor = historical_weight.get(dtype, 1.0)

            final_prob = min(0.95, base_prob * city_factor * day_factor * 
                           weather_factor * zone_factor * hist_factor)
            type_probs[dtype] = round(final_prob, 3)

        # Aggregate: probability of ANY disruption on this day
        no_disruption_prob = 1.0
        for prob in type_probs.values():
            no_disruption_prob *= (1 - prob)
        any_disruption_prob = round(1 - no_disruption_prob, 3)
        total_disruption_prob += any_disruption_prob

        # Determine dominant risk
        dominant_risk = max(type_probs, key=type_probs.get)
        dominant_prob = type_probs[dominant_risk]

        daily_predictions.append({
            'date': date.strftime('%Y-%m-%d'),
            'day_name': date.strftime('%A'),
            'disruption_probability': any_disruption_prob,
            'risk_level': (
                'Critical' if any_disruption_prob > 0.6 else
                'High' if any_disruption_prob > 0.4 else
                'Moderate' if any_disruption_prob > 0.2 else
                'Low'
            ),
            'type_probabilities': type_probs,
            'dominant_risk': dominant_risk,
            'dominant_probability': dominant_prob,
        })

    # Overall week disruption metrics
    avg_disruption_prob = total_disruption_prob / 7
    high_risk_days = sum(1 for d in daily_predictions if d['disruption_probability'] > 0.3)

    return {
        'daily': daily_predictions,
        'weekly_summary': {
            'avg_disruption_probability': round(avg_disruption_prob, 3),
            'high_risk_days': high_risk_days,
            'total_risk_score': round(avg_disruption_prob * 100, 1),
            'risk_level': (
                'Critical' if avg_disruption_prob > 0.5 else
                'High' if avg_disruption_prob > 0.3 else
                'Moderate' if avg_disruption_prob > 0.15 else
                'Low'
            ),
        },
        'city': city,
    }


def _analyze_historical_patterns(disruptions):
    """
    Learn from historical disruption records to weight predictions.
    More past events of a type -> higher future probability.
    """
    if not disruptions:
        return {'monsoon': 1.0, 'heatwave': 1.0, 'curfew': 1.0, 'pollution': 1.0, 'strike': 1.0}

    # Count disruptions by type in last 30 days
    type_counts = {'monsoon': 0, 'heatwave': 0, 'curfew': 0, 'pollution': 0, 'strike': 0}
    cutoff = datetime.now() - timedelta(days=30)

    for d in disruptions:
        event_type = d.get('eventType', '')
        timestamp = d.get('timestamp')
        if timestamp and isinstance(timestamp, str):
            try:
                ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                if ts.replace(tzinfo=None) > cutoff:
                    if event_type in type_counts:
                        type_counts[event_type] += 1
            except:
                pass

    # Convert counts to multipliers (more events = higher weight)
    weights = {}
    for dtype, count in type_counts.items():
        if count == 0:
            weights[dtype] = 0.9  # Slightly reduce base if no history
        elif count <= 2:
            weights[dtype] = 1.1
        elif count <= 5:
            weights[dtype] = 1.3
        else:
            weights[dtype] = 1.5  # Frequent disruptions in this zone

    return weights
