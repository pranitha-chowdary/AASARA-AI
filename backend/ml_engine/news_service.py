"""
AASARA News Service -- Live Social Disruption Trigger Detection
==============================================================
Fetches real-time news from NewsData.io to detect:
   Curfew / Section 144 orders
   Bharat Bandh / transport strikes
   Government flood / cyclone red alerts

API docs: https://newsdata.io/documentation
Free tier: 200 credits/day -- queries are cached 15 min to minimize usage.

Environment variable
--------------------
  NEWSDATA_API_KEY=<your key>   (set in backend/server/.env)

When the key is absent, the service falls back to a deterministic simulation
seeded by city + current hour -- results are stable within a 1-hour window.
"""

import os
import hashlib
import random
import requests
from datetime import datetime, timedelta

#  Configuration 
NEWSDATA_API_KEY  = os.getenv('NEWSDATA_API_KEY', '')
NEWSDATA_ENDPOINT = 'https://newsdata.io/api/1/latest'
CACHE_TTL_MINUTES = 15          # re-use results for 15 minutes

#  In-memory cache 
_news_cache: dict = {}

#  Search queries per disruption type 
_QUERIES = {
    'curfew': [
        'section 144 india',
        'curfew india alert',
        'emergency curfew india',
    ],
    'strike': [
        'bharat bandh india',
        'transport strike india',
        'auto bandh india',
        'delivery workers strike india',
    ],
    'flood_alert': [
        'IMD red alert flood india',
        'flood warning india',
        'waterlogging severe india',
    ],
    'cyclone': [
        'cyclone warning india',
        'cyclone landfall IMD',
    ],
}

#  City name aliases for news text matching 
_CITY_ALIASES: dict[str, list[str]] = {
    'Mumbai':    ['mumbai', 'bombay', 'thane', 'navi mumbai', 'bandra', 'dharavi', 'vasai'],
    'Delhi':     ['delhi', 'new delhi', 'ncr', 'gurugram', 'gurgaon', 'noida', 'faridabad', 'ghaziabad'],
    'Bangalore': ['bangalore', 'bengaluru', 'btm layout', 'koramangala', 'whitefield'],
    'Hyderabad': ['hyderabad', 'secunderabad', 'cyberabad', 'kondapur', 'hitech city'],
    'Chennai':   ['chennai', 'madras', 'tambaram', 'velachery', 'anna nagar'],
    'Pune':      ['pune', 'pcmc', 'pimpri', 'chinchwad', 'hinjewadi'],
    'Kolkata':   ['kolkata', 'calcutta', 'howrah', 'salt lake', 'new town'],
}


#  Helpers 

def _cache_valid(entry: dict) -> bool:
    if not entry:
        return False
    age = (datetime.now() - entry['cached_at']).total_seconds()
    return age < CACHE_TTL_MINUTES * 60


def _fetch_articles(query: str) -> list:
    """
    Fetch up to 10 articles from NewsData.io for the given query.
    Results are cached for CACHE_TTL_MINUTES.
    Returns [] on any error.
    """
    if not NEWSDATA_API_KEY:
        return []

    cache_key = f"{query}_{datetime.now().strftime('%Y%m%d%H%M')[:12]}"
    if cache_key in _news_cache and _cache_valid(_news_cache[cache_key]):
        return _news_cache[cache_key]['data']

    try:
        resp = requests.get(
            NEWSDATA_ENDPOINT,
            params={
                'apikey':   NEWSDATA_API_KEY,
                'q':        query,
                'country':  'in',
                'language': 'en',
                'size':     10,
            },
            timeout=5,
        )
        resp.raise_for_status()
        articles = resp.json().get('results', [])
        _news_cache[cache_key] = {'data': articles, 'cached_at': datetime.now()}
        return articles
    except Exception as exc:
        print(f"[NewsData] API error for '{query}': {exc}")
        return []


def _city_relevant(article: dict, city: str) -> bool:
    """Return True if the article text mentions the given city."""
    aliases = _CITY_ALIASES.get(city, [city.lower()])
    text = ' '.join([
        (article.get('title')       or ''),
        (article.get('description') or ''),
        (article.get('content')     or ''),
    ]).lower()
    return any(alias in text for alias in aliases)


def _is_recent(article: dict, max_hours: int = 6) -> bool:
    """Return True if the article was published within max_hours."""
    pub = article.get('pubDate', '')
    if not pub:
        return True
    try:
        pub_dt = datetime.strptime(pub[:19], '%Y-%m-%d %H:%M:%S')
        return (datetime.utcnow() - pub_dt).total_seconds() < max_hours * 3600
    except Exception:
        return True


def _summarise(articles: list[dict], max_items: int = 3) -> list[dict]:
    return [
        {
            'title':     a.get('title', ''),
            'url':       a.get('link', ''),
            'published': a.get('pubDate', ''),
        }
        for a in articles[:max_items]
    ]


#  Public interface 

def scan_social_triggers(city: str = 'Mumbai') -> dict:
    """
    Scan NewsData.io for active social disruption triggers relevant to *city*.

    Returns
    -------
    {
      'curfew':       { active, confidence, articles, source },
      'strike':       { active, confidence, articles, source },
      'flood_alert':  { active, confidence, articles, source },
    }

    When NEWSDATA_API_KEY is not set, returns a deterministic simulation.
    The source field indicates whether data is live or simulated.
    """
    if not NEWSDATA_API_KEY:
        return _simulate(city)

    results = {}

    #  Curfew 
    raw = []
    for q in _QUERIES['curfew']:
        raw += [a for a in _fetch_articles(q) if _is_recent(a, max_hours=6)]
    city_hits = [a for a in raw if _city_relevant(a, city)]

    results['curfew'] = {
        'active':     bool(city_hits),
        'confidence': min(95, 50 + len(city_hits) * 15) if city_hits else 0,
        'articles':   _summarise(city_hits),
        'source':     'NewsData.io (live)',
    }

    #  Strike / Bandh 
    raw = []
    for q in _QUERIES['strike']:
        raw += [a for a in _fetch_articles(q) if _is_recent(a, max_hours=12)]
    city_hits = [a for a in raw if _city_relevant(a, city)]

    results['strike'] = {
        'active':     bool(city_hits),
        'confidence': min(95, 50 + len(city_hits) * 15) if city_hits else 0,
        'articles':   _summarise(city_hits),
        'source':     'NewsData.io (live)',
    }

    #  Government flood alert 
    raw = []
    for q in _QUERIES['flood_alert']:
        raw += [a for a in _fetch_articles(q) if _is_recent(a, max_hours=3)]
    for q in _QUERIES['cyclone']:
        raw += [a for a in _fetch_articles(q) if _is_recent(a, max_hours=3)]
    city_hits = [a for a in raw if _city_relevant(a, city)]

    results['flood_alert'] = {
        'active':     bool(city_hits),
        'confidence': min(95, 60 + len(city_hits) * 10) if city_hits else 0,
        'articles':   _summarise(city_hits),
        'source':     'NewsData.io (live)',
    }

    return results


def _simulate(city: str) -> dict:
    """
    Deterministic simulation when NEWSDATA_API_KEY is absent.
    Seeded by city + current hour for reproducible results in demos.
    """
    seed = int(hashlib.md5(
        f"{city}{datetime.now().strftime('%Y%m%d%H')}".encode()
    ).hexdigest()[:8], 16)
    rng = random.Random(seed)

    month = datetime.now().month
    # Seasonal probabilities -- mirrors SEASONAL_PATTERNS in disruption_predictor.py
    curfew_p     = 0.04
    strike_p     = 0.10 if month in [1, 3, 5, 9, 11] else 0.05
    flood_alert_p = 0.15 if month in [6, 7, 8, 9] else 0.02

    curfew_active     = rng.random() < curfew_p
    strike_active     = rng.random() < strike_p
    flood_alert_active = rng.random() < flood_alert_p

    now_str = datetime.now().isoformat(timespec='seconds')

    return {
        'curfew': {
            'active':     curfew_active,
            'confidence': rng.randint(60, 85) if curfew_active else 0,
            'articles': [
                {
                    'title':     f'Section 144 imposed in parts of {city}',
                    'url':       '',
                    'published': now_str,
                }
            ] if curfew_active else [],
            'source': 'Simulated (set NEWSDATA_API_KEY for live data)',
        },
        'strike': {
            'active':     strike_active,
            'confidence': rng.randint(55, 80) if strike_active else 0,
            'articles': [
                {
                    'title':     f'{city} auto-taxi union calls bharat bandh',
                    'url':       '',
                    'published': now_str,
                }
            ] if strike_active else [],
            'source': 'Simulated (set NEWSDATA_API_KEY for live data)',
        },
        'flood_alert': {
            'active':     flood_alert_active,
            'confidence': rng.randint(65, 90) if flood_alert_active else 0,
            'articles': [
                {
                    'title':     f'IMD issues Red Alert for {city} -- severe flooding expected',
                    'url':       '',
                    'published': now_str,
                }
            ] if flood_alert_active else [],
            'source': 'Simulated (set NEWSDATA_API_KEY for live data)',
        },
    }
