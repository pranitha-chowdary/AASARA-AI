"""
AASARA ML Engine — Weather Service
Fetches 7-day weather forecast from OpenWeatherMap API
and computes risk scores for dynamic premium pricing.
"""
import os
import time
import requests
import math

OPENWEATHERMAP_API_KEY = os.getenv('OPENWEATHERMAP_API_KEY', '')
BASE_URL = 'https://api.openweathermap.org/data/2.5'

# Cache forecasts to avoid API rate limits (1-hour TTL)
_forecast_cache = {}
_CACHE_TTL = 3600  # seconds


def get_current_weather(lat, lng):
    """Fetch current weather conditions for a location."""
    cache_key = f"current_{round(lat,2)}_{round(lng,2)}"
    if cache_key in _forecast_cache:
        cached = _forecast_cache[cache_key]
        if time.time() - cached['timestamp'] < _CACHE_TTL:
            return cached['data']

    try:
        url = f"{BASE_URL}/weather"
        params = {
            'lat': lat,
            'lon': lng,
            'appid': OPENWEATHERMAP_API_KEY,
            'units': 'metric'
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        result = {
            'temperature': data['main']['temp'],
            'feels_like': data['main']['feels_like'],
            'humidity': data['main']['humidity'],
            'pressure': data['main']['pressure'],
            'wind_speed': data['wind']['speed'],
            'weather_main': data['weather'][0]['main'],
            'weather_description': data['weather'][0]['description'],
            'clouds': data.get('clouds', {}).get('all', 0),
            'rain_1h': data.get('rain', {}).get('1h', 0),
            'visibility': data.get('visibility', 10000),
            'city': data.get('name', 'Unknown'),
        }

        _forecast_cache[cache_key] = {'data': result, 'timestamp': time.time()}
        return result
    except Exception as e:
        print(f"[WeatherService] Current weather error: {e}")
        return _generate_mock_current(lat, lng)


def get_5day_forecast(lat, lng):
    """Fetch 5-day/3-hour forecast from OpenWeatherMap (free tier)."""
    cache_key = f"forecast_{round(lat,2)}_{round(lng,2)}"
    if cache_key in _forecast_cache:
        cached = _forecast_cache[cache_key]
        if time.time() - cached['timestamp'] < _CACHE_TTL:
            return cached['data']

    try:
        url = f"{BASE_URL}/forecast"
        params = {
            'lat': lat,
            'lon': lng,
            'appid': OPENWEATHERMAP_API_KEY,
            'units': 'metric'
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        # Process 3-hour intervals into daily summaries
        daily_forecasts = _aggregate_to_daily(data['list'])

        result = {
            'city': data.get('city', {}).get('name', 'Unknown'),
            'country': data.get('city', {}).get('country', ''),
            'daily': daily_forecasts,
            'source': 'openweathermap_live'
        }

        _forecast_cache[cache_key] = {'data': result, 'timestamp': time.time()}
        return result
    except Exception as e:
        print(f"[WeatherService] Forecast error: {e}")
        return _generate_mock_forecast(lat, lng)


def _aggregate_to_daily(forecast_list):
    """Aggregate 3-hour forecasts into daily summaries."""
    from collections import defaultdict
    from datetime import datetime

    daily = defaultdict(lambda: {
        'temps': [], 'humidity': [], 'wind': [], 'rain': 0,
        'weather_types': [], 'clouds': [], 'pressure': []
    })

    for entry in forecast_list:
        date_str = entry['dt_txt'].split(' ')[0]
        main = entry['main']
        daily[date_str]['temps'].append(main['temp'])
        daily[date_str]['humidity'].append(main['humidity'])
        daily[date_str]['pressure'].append(main['pressure'])
        daily[date_str]['wind'].append(entry['wind']['speed'])
        daily[date_str]['clouds'].append(entry.get('clouds', {}).get('all', 0))
        daily[date_str]['weather_types'].append(entry['weather'][0]['main'])

        # Accumulate rain
        rain = entry.get('rain', {}).get('3h', 0)
        daily[date_str]['rain'] += rain

    result = []
    for date_str in sorted(daily.keys())[:7]:  # Max 7 days
        d = daily[date_str]
        temps = d['temps']
        weather_types = d['weather_types']

        # Determine dominant weather
        from collections import Counter
        weather_counter = Counter(weather_types)
        dominant_weather = weather_counter.most_common(1)[0][0] if weather_counter else 'Clear'

        result.append({
            'date': date_str,
            'temp_min': round(min(temps), 1),
            'temp_max': round(max(temps), 1),
            'temp_avg': round(sum(temps) / len(temps), 1),
            'humidity_avg': round(sum(d['humidity']) / len(d['humidity']), 1),
            'wind_avg': round(sum(d['wind']) / len(d['wind']), 1),
            'rain_total_mm': round(d['rain'], 1),
            'cloud_avg': round(sum(d['clouds']) / len(d['clouds']), 1),
            'pressure_avg': round(sum(d['pressure']) / len(d['pressure']), 1),
            'dominant_weather': dominant_weather,
            'rain_probability': min(100, round((d['rain'] / max(len(temps), 1)) * 100, 1)),
        })

    return result


def compute_weather_risk_score(forecast_data):
    """
    Compute a weather risk score (0-100) from forecast data.
    Higher score = higher risk = higher premium.
    """
    if not forecast_data or not forecast_data.get('daily'):
        return {'score': 25, 'factors': {}, 'details': 'No forecast data available'}

    daily = forecast_data['daily']
    total_risk = 0
    factors = {}

    # --- Factor 1: Rainfall Risk (0-35 points) ---
    total_rain = sum(d['rain_total_mm'] for d in daily)
    rain_days = sum(1 for d in daily if d['rain_total_mm'] > 2)
    heavy_rain_days = sum(1 for d in daily if d['rain_total_mm'] > 20)

    rain_risk = min(35, (total_rain * 0.5) + (rain_days * 3) + (heavy_rain_days * 8))
    factors['rainfall'] = {
        'score': round(rain_risk, 1),
        'total_mm': round(total_rain, 1),
        'rain_days': rain_days,
        'heavy_rain_days': heavy_rain_days,
        'label': 'Heavy Rain' if heavy_rain_days > 0 else ('Moderate Rain' if rain_days > 2 else 'Low Rain')
    }
    total_risk += rain_risk

    # --- Factor 2: Temperature Extremes (0-25 points) ---
    max_temps = [d['temp_max'] for d in daily]
    avg_max = sum(max_temps) / len(max_temps)
    heatwave_days = sum(1 for t in max_temps if t > 40)
    extreme_heat_days = sum(1 for t in max_temps if t > 42)

    temp_risk = 0
    if avg_max > 42:
        temp_risk = 25
    elif avg_max > 40:
        temp_risk = 20
    elif avg_max > 38:
        temp_risk = 12
    elif avg_max > 35:
        temp_risk = 6
    temp_risk += extreme_heat_days * 5

    temp_risk = min(25, temp_risk)
    factors['temperature'] = {
        'score': round(temp_risk, 1),
        'avg_max': round(avg_max, 1),
        'heatwave_days': heatwave_days,
        'label': 'Heatwave' if heatwave_days > 0 else ('Hot' if avg_max > 35 else 'Normal')
    }
    total_risk += temp_risk

    # --- Factor 3: Wind Risk (0-15 points) ---
    avg_wind = sum(d['wind_avg'] for d in daily) / len(daily)
    high_wind_days = sum(1 for d in daily if d['wind_avg'] > 10)

    wind_risk = min(15, (avg_wind * 0.8) + (high_wind_days * 3))
    factors['wind'] = {
        'score': round(wind_risk, 1),
        'avg_speed': round(avg_wind, 1),
        'high_wind_days': high_wind_days,
        'label': 'Strong Winds' if avg_wind > 10 else ('Moderate' if avg_wind > 5 else 'Calm')
    }
    total_risk += wind_risk

    # --- Factor 4: Humidity & Comfort (0-10 points) ---
    avg_humidity = sum(d['humidity_avg'] for d in daily) / len(daily)
    humidity_risk = 0
    if avg_humidity > 85:
        humidity_risk = 10
    elif avg_humidity > 75:
        humidity_risk = 6
    elif avg_humidity > 65:
        humidity_risk = 3

    factors['humidity'] = {
        'score': round(humidity_risk, 1),
        'avg': round(avg_humidity, 1),
        'label': 'Very Humid' if avg_humidity > 80 else ('Humid' if avg_humidity > 65 else 'Comfortable')
    }
    total_risk += humidity_risk

    # --- Factor 5: Visibility / Fog Risk (0-10 points) ---
    cloudy_days = sum(1 for d in daily if d['cloud_avg'] > 80)
    fog_risk = min(10, cloudy_days * 2.5)
    factors['visibility'] = {
        'score': round(fog_risk, 1),
        'cloudy_days': cloudy_days,
        'label': 'Poor Visibility' if cloudy_days > 3 else 'Good'
    }
    total_risk += fog_risk

    # --- Factor 6: Seasonal Monsoon (0-5 bonus) ---
    from datetime import datetime
    month = datetime.now().month
    if month in [6, 7, 8, 9]:  # Monsoon season
        seasonal_bonus = 5
        factors['seasonal'] = {'score': 5, 'label': 'Monsoon Season Active'}
    elif month in [3, 4, 5]:  # Summer
        seasonal_bonus = 3
        factors['seasonal'] = {'score': 3, 'label': 'Summer Heat Season'}
    else:
        seasonal_bonus = 0
        factors['seasonal'] = {'score': 0, 'label': 'Normal Season'}
    total_risk += seasonal_bonus

    total_risk = min(100, round(total_risk, 1))

    return {
        'score': total_risk,
        'factors': factors,
        'risk_level': (
            'Critical' if total_risk > 70 else
            'High' if total_risk > 50 else
            'Moderate' if total_risk > 30 else
            'Low'
        ),
        'details': f"Weather risk: {total_risk}/100 based on {len(daily)}-day forecast"
    }


def _generate_mock_current(lat, lng):
    """Fallback mock current weather when API fails."""
    import random
    return {
        'temperature': 30 + random.uniform(-5, 10),
        'feels_like': 32 + random.uniform(-3, 8),
        'humidity': 60 + random.uniform(-20, 30),
        'pressure': 1010 + random.uniform(-5, 5),
        'wind_speed': 3 + random.uniform(0, 8),
        'weather_main': random.choice(['Clear', 'Clouds', 'Rain', 'Haze']),
        'weather_description': 'mock data',
        'clouds': random.randint(10, 90),
        'rain_1h': random.uniform(0, 5),
        'visibility': 8000 + random.randint(0, 2000),
        'city': 'Unknown (Mock)',
    }


def _generate_mock_forecast(lat, lng):
    """Fallback mock 7-day forecast when API fails."""
    import random
    from datetime import datetime, timedelta

    daily = []
    for i in range(7):
        date = datetime.now() + timedelta(days=i)
        base_temp = 30 + random.uniform(-5, 10)
        daily.append({
            'date': date.strftime('%Y-%m-%d'),
            'temp_min': round(base_temp - 3, 1),
            'temp_max': round(base_temp + 5, 1),
            'temp_avg': round(base_temp + 1, 1),
            'humidity_avg': round(60 + random.uniform(-15, 25), 1),
            'wind_avg': round(3 + random.uniform(0, 7), 1),
            'rain_total_mm': round(random.uniform(0, 15), 1),
            'cloud_avg': round(random.uniform(10, 80), 1),
            'pressure_avg': round(1010 + random.uniform(-5, 5), 1),
            'dominant_weather': random.choice(['Clear', 'Clouds', 'Rain']),
            'rain_probability': round(random.uniform(0, 60), 1),
        })

    return {
        'city': 'Unknown (Mock)',
        'country': 'IN',
        'daily': daily,
        'source': 'mock_fallback'
    }
