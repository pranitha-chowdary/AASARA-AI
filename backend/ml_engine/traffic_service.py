"""
AASARA ML Engine — Traffic & Zone Safety Service
Analyzes hyper-local zone safety based on waterlogging history,
traffic patterns, and known high-risk zones in Indian cities.
"""
import math
import random
from datetime import datetime

# ============================================================
# KNOWN HIGH-RISK ZONES DATABASE
# Based on published data for Indian metro cities
# ============================================================

WATERLOGGING_ZONES = {
    # Mumbai — notorious waterlogging hotspots
    'mumbai': [
        {'name': 'Hindmata Junction', 'lat': 19.0100, 'lng': 72.8421, 'severity': 5, 'frequency': 0.9},
        {'name': 'King Circle', 'lat': 19.0176, 'lng': 72.8562, 'severity': 4, 'frequency': 0.8},
        {'name': 'Sion', 'lat': 19.0400, 'lng': 72.8600, 'severity': 5, 'frequency': 0.85},
        {'name': 'Andheri Subway', 'lat': 19.1197, 'lng': 72.8464, 'severity': 4, 'frequency': 0.75},
        {'name': 'Milan Subway', 'lat': 19.1012, 'lng': 72.8370, 'severity': 4, 'frequency': 0.7},
        {'name': 'Dadar TT', 'lat': 19.0178, 'lng': 72.8478, 'severity': 3, 'frequency': 0.65},
    ],
    # Hyderabad — flood-prone areas
    'hyderabad': [
        {'name': 'Falaknuma', 'lat': 17.3326, 'lng': 78.4642, 'severity': 5, 'frequency': 0.8},
        {'name': 'Tolichowki', 'lat': 17.3949, 'lng': 78.4215, 'severity': 4, 'frequency': 0.7},
        {'name': 'Balapur', 'lat': 17.3200, 'lng': 78.5044, 'severity': 4, 'frequency': 0.65},
        {'name': 'Hafiz Baba Nagar', 'lat': 17.3450, 'lng': 78.5200, 'severity': 3, 'frequency': 0.6},
        {'name': 'Chandrayangutta', 'lat': 17.3265, 'lng': 78.4911, 'severity': 4, 'frequency': 0.7},
        {'name': 'Malakpet', 'lat': 17.3700, 'lng': 78.4950, 'severity': 3, 'frequency': 0.55},
    ],
    # Bangalore
    'bangalore': [
        {'name': 'Silk Board Junction', 'lat': 12.9173, 'lng': 77.6230, 'severity': 5, 'frequency': 0.85},
        {'name': 'Outer Ring Road - Bellandur', 'lat': 12.9250, 'lng': 77.6780, 'severity': 4, 'frequency': 0.75},
        {'name': 'Koramangala', 'lat': 12.9352, 'lng': 77.6245, 'severity': 3, 'frequency': 0.6},
        {'name': 'Yeswanthpur', 'lat': 13.0220, 'lng': 77.5440, 'severity': 3, 'frequency': 0.55},
    ],
    # Chennai
    'chennai': [
        {'name': 'T. Nagar', 'lat': 13.0418, 'lng': 80.2341, 'severity': 4, 'frequency': 0.75},
        {'name': 'Velachery', 'lat': 12.9815, 'lng': 80.2180, 'severity': 5, 'frequency': 0.85},
        {'name': 'Perungudi', 'lat': 12.9612, 'lng': 80.2430, 'severity': 4, 'frequency': 0.7},
    ],
    # Delhi NCR
    'delhi': [
        {'name': 'Minto Bridge', 'lat': 28.6248, 'lng': 77.2232, 'severity': 5, 'frequency': 0.9},
        {'name': 'ITO', 'lat': 28.6295, 'lng': 77.2400, 'severity': 4, 'frequency': 0.7},
        {'name': 'Pragati Maidan', 'lat': 28.6186, 'lng': 77.2493, 'severity': 4, 'frequency': 0.65},
        {'name': 'Pul Prahladpur', 'lat': 28.5168, 'lng': 77.2800, 'severity': 3, 'frequency': 0.6},
    ],
}

# Flatten all zones for proximity search
ALL_RISK_ZONES = []
for city, zones in WATERLOGGING_ZONES.items():
    for zone in zones:
        zone['city'] = city
        ALL_RISK_ZONES.append(zone)

# ============================================================
# TRAFFIC CONGESTION PATTERNS (peak hours, day-of-week)
# ============================================================
PEAK_HOURS = {
    'morning': (8, 11),   # 8 AM - 11 AM
    'evening': (17, 21),  # 5 PM - 9 PM (delivery surge)
}


def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points in km."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng/2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


def get_zone_safety_score(lat, lng):
    """
    Calculate zone safety score (0-100) for a given location.
    Higher score = SAFER zone = lower premium.
    
    Factors:
    1. Proximity to known waterlogging zones
    2. Traffic congestion patterns
    3. Historical incident density
    """
    # --- Factor 1: Waterlogging proximity (0-50 points deducted) ---
    waterlog_risk = 0
    nearest_zones = []

    for zone in ALL_RISK_ZONES:
        dist = haversine_distance(lat, lng, zone['lat'], zone['lng'])
        if dist < 5:  # Within 5 km
            # Risk decreases with distance
            proximity_factor = max(0, 1 - (dist / 5))
            zone_risk = zone['severity'] * zone['frequency'] * proximity_factor * 10
            waterlog_risk += zone_risk
            nearest_zones.append({
                'name': zone['name'],
                'city': zone['city'],
                'distance_km': round(dist, 2),
                'risk_contribution': round(zone_risk, 1),
            })

    waterlog_risk = min(50, waterlog_risk)

    # --- Factor 2: Traffic congestion (0-20 points deducted) ---
    hour = datetime.now().hour
    is_peak = (PEAK_HOURS['morning'][0] <= hour <= PEAK_HOURS['morning'][1] or
               PEAK_HOURS['evening'][0] <= hour <= PEAK_HOURS['evening'][1])
    
    # Cities with higher traffic base risk
    traffic_base = _estimate_city_traffic(lat, lng)
    traffic_risk = traffic_base + (10 if is_peak else 0)
    traffic_risk = min(20, traffic_risk)

    # --- Factor 3: Construction / Road quality (0-15 points deducted) ---
    # Simulated based on zone infrastructure
    infra_risk = _estimate_infrastructure_risk(lat, lng)
    infra_risk = min(15, infra_risk)

    # --- Factor 4: Emergency service access (0-15 points deducted) ---
    # Urban areas have better emergency response
    emergency_risk = _estimate_emergency_access(lat, lng)
    emergency_risk = min(15, emergency_risk)

    # Calculate final safety score
    total_deductions = waterlog_risk + traffic_risk + infra_risk + emergency_risk
    safety_score = max(0, round(100 - total_deductions))

    # Determine city
    detected_city = _detect_city(lat, lng)

    return {
        'safety_score': safety_score,
        'location': {'lat': lat, 'lng': lng},
        'detected_city': detected_city,
        'is_safe_zone': safety_score >= 70,
        'risk_breakdown': {
            'waterlogging': {
                'risk': round(waterlog_risk, 1),
                'nearby_zones': sorted(nearest_zones, key=lambda x: x['distance_km'])[:3],
                'label': 'High Flood Risk' if waterlog_risk > 25 else ('Moderate' if waterlog_risk > 10 else 'Low Risk')
            },
            'traffic': {
                'risk': round(traffic_risk, 1),
                'is_peak_hour': is_peak,
                'label': 'Heavy Traffic' if traffic_risk > 12 else ('Moderate' if traffic_risk > 6 else 'Smooth')
            },
            'infrastructure': {
                'risk': round(infra_risk, 1),
                'label': 'Poor Roads' if infra_risk > 10 else ('Average' if infra_risk > 5 else 'Good')
            },
            'emergency_access': {
                'risk': round(emergency_risk, 1),
                'label': 'Limited' if emergency_risk > 10 else ('Moderate' if emergency_risk > 5 else 'Good')
            }
        },
        'discount_eligible': safety_score >= 70,
        'discount_amount': _calculate_safety_discount(safety_score),
    }


def _detect_city(lat, lng):
    """Detect which city the coordinates are in."""
    city_centers = {
        'Mumbai': (19.0760, 72.8777),
        'Hyderabad': (17.3850, 78.4867),
        'Bangalore': (12.9716, 77.5946),
        'Chennai': (13.0827, 80.2707),
        'Delhi': (28.6139, 77.2090),
        'Pune': (18.5204, 73.8567),
        'Kolkata': (22.5726, 88.3639),
    }
    
    min_dist = float('inf')
    closest_city = 'Unknown'
    for city, (clat, clng) in city_centers.items():
        dist = haversine_distance(lat, lng, clat, clng)
        if dist < min_dist:
            min_dist = dist
            closest_city = city

    return closest_city if min_dist < 50 else 'Other'


def _estimate_city_traffic(lat, lng):
    """Estimate base traffic risk for the detected city."""
    city = _detect_city(lat, lng)
    base_traffic = {
        'Mumbai': 12, 'Bangalore': 14, 'Delhi': 11,
        'Hyderabad': 8, 'Chennai': 9, 'Pune': 7,
        'Kolkata': 10,
    }
    return base_traffic.get(city, 5)


def _estimate_infrastructure_risk(lat, lng):
    """Estimate road infrastructure risk."""
    city = _detect_city(lat, lng)
    # Metro cities have slightly better infra
    base_infra = {
        'Mumbai': 6, 'Bangalore': 7, 'Delhi': 5,
        'Hyderabad': 6, 'Chennai': 7, 'Pune': 5,
        'Kolkata': 8,
    }
    return base_infra.get(city, 8) + random.uniform(-2, 2)


def _estimate_emergency_access(lat, lng):
    """Estimate emergency service accessibility."""
    city = _detect_city(lat, lng)
    # Urban centers have better emergency access
    if city in ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune']:
        return 3 + random.uniform(0, 3)
    return 8 + random.uniform(0, 5)


def _calculate_safety_discount(safety_score):
    """Calculate daily premium discount based on safety score."""
    if safety_score >= 85:
        return 5  # ₹5/day discount for very safe zones
    elif safety_score >= 75:
        return 3  # ₹3/day discount
    elif safety_score >= 70:
        return 2  # ₹2/day discount
    return 0  # No discount
