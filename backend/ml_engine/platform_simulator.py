"""
AASARA Platform Simulator — Simulated Zomato/Swiggy/Dunzo APIs
Generates realistic order data, delivery status, and earnings history
for fraud cross-verification and admin lookups.
"""
import random
import hashlib
from datetime import datetime, timedelta


# ==============================================================================
# SIMULATED ORDER DATA
# ==============================================================================

FOOD_ITEMS = [
    'Butter Chicken + Naan', 'Biryani (Chicken)', 'Paneer Tikka Masala',
    'Dosa + Sambar', 'Chole Bhature', 'Veg Thali', 'Pav Bhaji',
    'Fried Rice + Manchurian', 'Pizza (Large)', 'Burger + Fries',
    'Shawarma Roll', 'Idli + Chutney', 'Pasta Alfredo', 'Momos (Steamed)',
    'Fish Curry + Rice', 'Samosa (4pc)', 'Chai + Biscuits',
]

RESTAURANT_NAMES = [
    'Paradise Biryani', 'Meghana Foods', 'Barbeque Nation', 'Dominos',
    'A2B (Adyar Ananda Bhavan)', 'Haldiram\'s', 'KFC', 'Subway',
    'Behrouz Biryani', 'Chai Point', 'The Bowl Company', 'Faasos',
    'Mojo Pizza', 'EatFit', 'Burger King', 'Pizza Hut',
]

CITY_AREAS = {
    'Hyderabad': ['Madhapur', 'Gachibowli', 'Kondapur', 'Jubilee Hills', 'Banjara Hills',
                  'Ameerpet', 'Secunderabad', 'ECIL', 'Kukatpally', 'Dilsukhnagar'],
    'Mumbai': ['Andheri', 'Bandra', 'Powai', 'Dadar', 'Goregaon',
               'Malad', 'Thane', 'Navi Mumbai', 'Borivali', 'Churchgate'],
    'Bangalore': ['Koramangala', 'HSR Layout', 'Indiranagar', 'Whitefield', 'Electronic City',
                  'JP Nagar', 'Malleshwaram', 'Jayanagar', 'BTM Layout', 'Marathahalli'],
    'Delhi': ['Connaught Place', 'Karol Bagh', 'Saket', 'Dwarka', 'Rohini',
              'Lajpat Nagar', 'Rajouri Garden', 'Janakpuri', 'Vasant Kunj', 'Hauz Khas'],
}


def get_platform_status(worker_id, platform='zomato'):
    """
    Get simulated real-time platform status for a worker.
    Deterministic based on worker_id for consistency.
    """
    seed = int(hashlib.md5(str(worker_id).encode()).hexdigest()[:8], 16)
    random.seed(seed + datetime.now().hour)

    # Determine worker's current status
    hour = datetime.now().hour
    is_peak = hour in [11, 12, 13, 18, 19, 20, 21]

    # Workers more likely active during peak hours
    active_prob = 0.8 if is_peak else 0.4
    is_active = random.random() < active_prob

    status = 'delivering' if is_active and random.random() < 0.6 else \
             'idle' if is_active else 'offline'

    # City detection
    city = random.choice(list(CITY_AREAS.keys()))
    areas = CITY_AREAS[city]

    result = {
        'worker_id': str(worker_id),
        'platform': platform,
        'status': status,
        'is_active': is_active,
        'city': city,
        'current_zone': random.choice(areas),
        'login_time': (datetime.now() - timedelta(hours=random.randint(1, 6))).isoformat(),
        'last_order_time': (datetime.now() - timedelta(minutes=random.randint(5, 120))).isoformat(),
        'timestamp': datetime.now().isoformat(),
    }

    # If delivering, add current order
    if status == 'delivering':
        pickup_area = random.choice(areas)
        drop_area = random.choice([a for a in areas if a != pickup_area])
        result['current_order'] = {
            'order_id': f"ORD-{random.randint(100000, 999999)}",
            'restaurant': random.choice(RESTAURANT_NAMES),
            'items': random.sample(FOOD_ITEMS, random.randint(1, 3)),
            'order_value': round(random.uniform(120, 650), 0),
            'pickup_area': pickup_area,
            'drop_area': drop_area,
            'estimated_delivery': (datetime.now() + timedelta(minutes=random.randint(5, 25))).strftime('%H:%M'),
            'distance_km': round(random.uniform(1.5, 8.0), 1),
        }

    # Add today's stats
    orders_today = random.randint(3, 18) if is_active else random.randint(0, 5)
    result['today_stats'] = {
        'orders_completed': orders_today,
        'total_distance_km': round(orders_today * random.uniform(2.5, 5.0), 1),
        'earnings': round(orders_today * random.uniform(35, 65), 0),
        'online_hours': round(random.uniform(2, 10), 1),
        'avg_delivery_time_min': round(random.uniform(18, 35), 0),
        'rating': round(random.uniform(4.0, 5.0), 1),
    }

    return result


def get_worker_earnings_history(worker_id, platform='zomato', days=7):
    """Get simulated earnings history for last N days."""
    seed = int(hashlib.md5(str(worker_id).encode()).hexdigest()[:8], 16)
    random.seed(seed)

    history = []
    for i in range(days):
        date = datetime.now() - timedelta(days=i)
        day_name = date.strftime('%A')
        is_weekend = day_name in ['Saturday', 'Sunday']

        orders = random.randint(8, 22) if is_weekend else random.randint(5, 16)
        earnings = round(orders * random.uniform(35, 60), 0)

        history.append({
            'date': date.strftime('%Y-%m-%d'),
            'day': day_name,
            'orders': orders,
            'earnings': earnings,
            'online_hours': round(random.uniform(6, 12), 1),
            'tips': round(random.uniform(0, 80), 0),
            'distance_km': round(orders * random.uniform(2.5, 4.5), 1),
        })

    weekly_earnings = sum(d['earnings'] for d in history)
    weekly_orders = sum(d['orders'] for d in history)

    return {
        'worker_id': str(worker_id),
        'platform': platform,
        'history': history,
        'summary': {
            'weekly_earnings': weekly_earnings,
            'weekly_orders': weekly_orders,
            'avg_daily_earnings': round(weekly_earnings / days, 0),
            'avg_daily_orders': round(weekly_orders / days, 1),
            'best_day': max(history, key=lambda d: d['earnings'])['date'],
            'worst_day': min(history, key=lambda d: d['earnings'])['date'],
        },
    }


def get_active_orders_in_zone(zone_name, platform='zomato', count=5):
    """Get simulated active orders in a zone (for disruption impact analysis)."""
    random.seed(hash(zone_name + str(datetime.now().hour)))

    orders = []
    for i in range(count):
        orders.append({
            'order_id': f"ORD-{random.randint(100000, 999999)}",
            'restaurant': random.choice(RESTAURANT_NAMES),
            'items': random.sample(FOOD_ITEMS, random.randint(1, 2)),
            'order_value': round(random.uniform(150, 500), 0),
            'status': random.choice(['preparing', 'ready_for_pickup', 'on_the_way']),
            'assigned_worker': f"WKR-{random.randint(1000, 9999)}",
            'estimated_delivery': (datetime.now() + timedelta(minutes=random.randint(10, 40))).strftime('%H:%M'),
        })

    return {
        'zone': zone_name,
        'platform': platform,
        'active_orders': len(orders),
        'orders': orders,
        'timestamp': datetime.now().isoformat(),
    }
