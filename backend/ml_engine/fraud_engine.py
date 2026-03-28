"""
AASARA Fraud Detection Engine — 3-Layer Zero-Trust Verification
Layer 1: Sensor Fusion & Kinematic AI
Layer 2: Syndicate Detection (Coordinated Fraud)
Layer 3: Graceful Degradation & Honest Worker Protection
"""
import numpy as np
from datetime import datetime, timedelta
import hashlib
import json


# ==============================================================================
# LAYER 1: SENSOR FUSION & KINEMATIC AI
# ==============================================================================

class KinematicAnalyzer:
    """Analyzes GPS, accelerometer, gyroscope data to detect spoofing."""

    @staticmethod
    def detect_gps_teleportation(path_points):
        """
        Detect impossible GPS jumps (teleportation).
        A real worker can't move >500m in <5 seconds.
        """
        if not path_points or len(path_points) < 2:
            return {'score': 0, 'teleportations': 0, 'details': 'Insufficient path data'}

        teleportations = []
        for i in range(1, len(path_points)):
            prev = path_points[i - 1]
            curr = path_points[i]

            # Haversine distance
            dist_km = _haversine(prev['lat'], prev['lng'], curr['lat'], curr['lng'])
            dist_m = dist_km * 1000

            # Time delta
            t1 = _parse_time(prev.get('timestamp'))
            t2 = _parse_time(curr.get('timestamp'))
            dt_seconds = max(1, (t2 - t1).total_seconds())

            speed_ms = dist_m / dt_seconds  # m/s

            # Max realistic speed: 90 km/h = 25 m/s (bike in city)
            if speed_ms > 25:
                teleportations.append({
                    'from': [prev['lat'], prev['lng']],
                    'to': [curr['lat'], curr['lng']],
                    'distance_m': round(dist_m),
                    'time_delta_s': round(dt_seconds),
                    'speed_ms': round(speed_ms, 1),
                })

        score = min(100, len(teleportations) * 35)
        return {
            'score': score,
            'teleportations': len(teleportations),
            'details': teleportations[:3] if teleportations else 'No teleportation detected',
        }

    @staticmethod
    def detect_linear_path(path_points):
        """
        Real workers exhibit erratic stop-and-go patterns.
        Spoofers often produce perfectly linear or robotic paths.
        """
        if not path_points or len(path_points) < 5:
            return {'score': 0, 'linearity': 0, 'details': 'Insufficient path data'}

        # Calculate heading changes
        headings = []
        for i in range(1, len(path_points)):
            dy = path_points[i]['lat'] - path_points[i - 1]['lat']
            dx = path_points[i]['lng'] - path_points[i - 1]['lng']
            heading = np.arctan2(dy, dx)
            headings.append(heading)

        if len(headings) < 2:
            return {'score': 0, 'linearity': 0, 'details': 'Not enough heading data'}

        # Heading variance — low variance = suspiciously straight line
        heading_changes = [abs(headings[i] - headings[i - 1]) for i in range(1, len(headings))]
        avg_change = np.mean(heading_changes) if heading_changes else 0

        # Near-zero heading change = robotic path
        linearity = max(0, 1 - (avg_change / 0.5))  # 0.5 rad = natural variation
        score = int(linearity * 60)

        return {
            'score': score,
            'linearity': round(linearity, 3),
            'avg_heading_change': round(float(avg_change), 4),
            'details': 'Suspiciously linear path' if score > 30 else 'Natural movement pattern',
        }

    @staticmethod
    def detect_stillness(accelerometer_data, gyroscope_data):
        """
        A phone on a table has near-zero accelerometer/gyroscope variance.
        A real worker in a storm has erratic sensor readings.
        """
        if not accelerometer_data and not gyroscope_data:
            return {'score': 10, 'details': 'No sensor data available — mild flag'}

        accel_var = 0
        gyro_var = 0

        if accelerometer_data and len(accelerometer_data) >= 3:
            accel_var = float(np.var(accelerometer_data))

        if gyroscope_data and len(gyroscope_data) >= 3:
            gyro_var = float(np.var(gyroscope_data))

        # Very low variance = phone stationary (likely spoofing)
        is_still = accel_var < 0.01 and gyro_var < 0.005
        score = 50 if is_still else max(0, int(30 - accel_var * 100))

        return {
            'score': max(0, score),
            'accelerometer_variance': round(accel_var, 5),
            'gyroscope_variance': round(gyro_var, 5),
            'is_stationary': is_still,
            'details': 'Phone appears stationary — possible spoofing' if is_still else 'Active movement detected',
        }

    @staticmethod
    def check_environmental_sensors(battery_temp, barometric_pressure, weather_condition):
        """
        Cross-reference device sensors with reported weather.
        Storm → expect low pressure, higher battery temp from screen-on usage.
        Climate-controlled room → stable pressure, normal temp.
        """
        score = 0
        flags = []

        if weather_condition in ['Rain', 'Thunderstorm', 'Heavy Rain']:
            # During storms: barometric < 1005 hPa typical
            if barometric_pressure and barometric_pressure > 1015:
                score += 25
                flags.append('Barometric pressure too high for reported storm')

            # Battery temp should be slightly elevated from active use
            if battery_temp and battery_temp < 25:
                score += 15
                flags.append('Battery too cool — phone may not be exposed to elements')

        return {
            'score': min(score, 50),
            'battery_temp': battery_temp,
            'barometric_pressure': barometric_pressure,
            'flags': flags if flags else ['Sensors consistent with conditions'],
        }


# ==============================================================================
# LAYER 2: SYNDICATE DETECTION
# ==============================================================================

class SyndicateDetector:
    """Detects coordinated fraud rings."""

    @staticmethod
    def detect_temporal_clustering(claims_data):
        """
        If N workers enter the same geofence within <60s of a trigger,
        it's suspicious. Real workers are distributed.
        """
        if not claims_data or len(claims_data) < 3:
            return {'score': 0, 'cluster_size': 0, 'details': 'Too few claims to analyze'}

        # Group by zone + time window (60 seconds)
        time_buckets = {}
        for claim in claims_data:
            t = _parse_time(claim.get('timestamp'))
            bucket = t.strftime('%Y-%m-%d-%H-%M')  # 1-minute buckets
            zone = claim.get('zone', 'unknown')
            key = f"{zone}_{bucket}"

            if key not in time_buckets:
                time_buckets[key] = []
            time_buckets[key].append(claim)

        # Find largest cluster
        max_cluster = max((len(v) for v in time_buckets.values()), default=0)

        # 5+ claims in same zone within 1 minute = suspicious
        score = 0
        if max_cluster >= 10:
            score = 95  # Almost certainly coordinated
        elif max_cluster >= 5:
            score = 70
        elif max_cluster >= 3:
            score = 40

        return {
            'score': score,
            'cluster_size': max_cluster,
            'total_buckets': len(time_buckets),
            'details': f"Largest cluster: {max_cluster} claims in 1-minute window",
            'is_syndicate': score >= 70,
        }

    @staticmethod
    def detect_ip_clustering(ip_data):
        """
        Fraud rings often use shared VPN/emulator/Wi-Fi.
        Check for IP subnet clustering.
        """
        if not ip_data or len(ip_data) < 2:
            return {'score': 0, 'details': 'Insufficient IP data'}

        # Extract /24 subnets
        subnets = {}
        for entry in ip_data:
            ip = entry.get('ip', '')
            parts = ip.split('.')
            if len(parts) == 4:
                subnet = '.'.join(parts[:3])
                if subnet not in subnets:
                    subnets[subnet] = []
                subnets[subnet].append(entry)

        max_subnet_size = max((len(v) for v in subnets.values()), default=0)

        score = 0
        if max_subnet_size >= 10:
            score = 80
        elif max_subnet_size >= 5:
            score = 50
        elif max_subnet_size >= 3:
            score = 25

        return {
            'score': score,
            'largest_subnet_cluster': max_subnet_size,
            'unique_subnets': len(subnets),
            'details': f"{max_subnet_size} devices on same subnet" if score > 0 else 'Normal IP distribution',
        }

    @staticmethod
    def cross_check_platform_telemetry(claimed_location, platform_data):
        """
        If GPS says worker is in flood zone, but platform shows
        no active order in 2+ hours → suspicious.
        """
        if not platform_data:
            return {'score': 15, 'details': 'No platform data available — mild flag'}

        last_order_time = platform_data.get('last_order_time')
        is_active = platform_data.get('is_active', False)
        current_status = platform_data.get('status', 'unknown')

        score = 0
        flags = []

        if not is_active and current_status == 'offline':
            score += 40
            flags.append('Worker is offline on platform but claiming disruption')

        if last_order_time:
            try:
                last_order = _parse_time(last_order_time)
                hours_since = (datetime.now() - last_order).total_seconds() / 3600
                if hours_since > 2:
                    score += 30
                    flags.append(f'No orders in {hours_since:.1f} hours')
            except:
                pass

        return {
            'score': min(score, 70),
            'platform_status': current_status,
            'is_active_on_platform': is_active,
            'flags': flags if flags else ['Platform activity consistent with claim'],
        }


# ==============================================================================
# LAYER 3: GRACEFUL DEGRADATION & HONEST WORKER PROTECTION
# ==============================================================================

class HonestWorkerProtector:
    """Ensures honest workers aren't falsely flagged."""

    @staticmethod
    def apply_graceful_degradation(raw_score, network_quality, claim_history):
        """
        During severe monsoons, GPS drops and network degradation are normal.
        Reduce false positives for workers with clean history.
        """
        adjusted_score = raw_score

        # Network degradation discount
        if network_quality and network_quality.get('degraded', False):
            adjusted_score *= 0.6  # 40% reduction during poor network
            adjusted_score = max(0, adjusted_score)

        # Clean history discount
        total_claims = claim_history.get('total_claims', 0)
        rejected_claims = claim_history.get('rejected_claims', 0)

        if total_claims > 0:
            rejection_rate = rejected_claims / total_claims
            if rejection_rate < 0.1 and total_claims >= 3:
                # Good track record — reduce score by 20%
                adjusted_score *= 0.8

        return {
            'original_score': round(raw_score, 1),
            'adjusted_score': round(adjusted_score, 1),
            'network_degraded': network_quality.get('degraded', False) if network_quality else False,
            'history_discount_applied': total_claims >= 3 and (rejected_claims / max(1, total_claims)) < 0.1,
        }

    @staticmethod
    def determine_action(anomaly_score):
        """
        Decide what to do based on anomaly score.
        <30: Auto-approve (instant payout)
        30-70: Micro-verification required
        >70: Auto-reject + admin review
        """
        if anomaly_score < 30:
            return {
                'action': 'auto_approve',
                'label': '✅ Auto-Approved',
                'color': 'green',
                'payout': 'instant',
                'requires_verification': False,
                'message': 'Low fraud risk — instant payout initiated',
            }
        elif anomaly_score < 70:
            return {
                'action': 'micro_verify',
                'label': '🔍 Micro-Verification Required',
                'color': 'yellow',
                'payout': 'held',
                'requires_verification': True,
                'message': 'Moderate risk detected — please submit a timestamped photo of the disruption',
            }
        else:
            return {
                'action': 'reject',
                'label': '🚫 Flagged for Review',
                'color': 'red',
                'payout': 'blocked',
                'requires_verification': True,
                'message': 'High anomaly score — claim flagged for admin review',
            }


# ==============================================================================
# MAIN FRAUD CHECKER
# ==============================================================================

class FraudEngine:
    """Main fraud detection orchestrator."""

    def __init__(self):
        self.kinematic = KinematicAnalyzer()
        self.syndicate = SyndicateDetector()
        self.protector = HonestWorkerProtector()

    def run_full_check(self, worker_data):
        """
        Run complete 3-layer fraud check on a claim.
        
        worker_data: {
            path_points: [{lat, lng, timestamp}, ...],
            accelerometer: [x, y, z, ...],
            gyroscope: [x, y, z, ...],
            battery_temp: float,
            barometric_pressure: float,
            weather_condition: str,
            claimed_location: {lat, lng},
            platform_data: {...},
            network_quality: {degraded: bool},
            claim_history: {total_claims, rejected_claims},
            ip_address: str,
            recent_claims_in_zone: [{...}],
        }
        """
        results = {}

        # Layer 1: Sensor Fusion
        path = worker_data.get('path_points', [])
        teleport = self.kinematic.detect_gps_teleportation(path)
        linear = self.kinematic.detect_linear_path(path)
        stillness = self.kinematic.detect_stillness(
            worker_data.get('accelerometer', []),
            worker_data.get('gyroscope', [])
        )
        env = self.kinematic.check_environmental_sensors(
            worker_data.get('battery_temp'),
            worker_data.get('barometric_pressure'),
            worker_data.get('weather_condition', '')
        )

        layer1_score = (
            teleport['score'] * 0.35 +
            linear['score'] * 0.2 +
            stillness['score'] * 0.25 +
            env['score'] * 0.2
        )

        results['layer1_sensor_fusion'] = {
            'score': round(layer1_score, 1),
            'teleportation': teleport,
            'linear_path': linear,
            'stillness': stillness,
            'environmental': env,
        }

        # Layer 2: Syndicate Detection
        zone_claims = worker_data.get('recent_claims_in_zone', [])
        temporal = self.syndicate.detect_temporal_clustering(zone_claims)
        ip_data = worker_data.get('ip_cluster_data', [])
        ip_cluster = self.syndicate.detect_ip_clustering(ip_data)
        platform = self.syndicate.cross_check_platform_telemetry(
            worker_data.get('claimed_location', {}),
            worker_data.get('platform_data', {})
        )

        layer2_score = (
            temporal['score'] * 0.4 +
            ip_cluster['score'] * 0.3 +
            platform['score'] * 0.3
        )

        results['layer2_syndicate'] = {
            'score': round(layer2_score, 1),
            'temporal_clustering': temporal,
            'ip_clustering': ip_cluster,
            'platform_crosscheck': platform,
        }

        # Combined raw score (Layer 1 weighted 60%, Layer 2 weighted 40%)
        raw_score = layer1_score * 0.6 + layer2_score * 0.4

        # Layer 3: Graceful Degradation
        degradation = self.protector.apply_graceful_degradation(
            raw_score,
            worker_data.get('network_quality'),
            worker_data.get('claim_history', {})
        )

        final_score = degradation['adjusted_score']
        action = self.protector.determine_action(final_score)

        results['layer3_protection'] = degradation
        results['final_anomaly_score'] = round(final_score, 1)
        results['recommended_action'] = action
        results['fraud_verdict'] = action['action']

        return results

    def quick_check(self, lat, lng, worker_id, platform_status='active'):
        """
        Quick fraud check using minimal data (for automated triggers).
        Generates simulated sensor data based on worker location.
        """
        np.random.seed(hash(worker_id) % (2**31))

        # Simulate realistic sensor data
        path = []
        base_time = datetime.now() - timedelta(minutes=30)
        for i in range(10):
            path.append({
                'lat': lat + np.random.normal(0, 0.001),
                'lng': lng + np.random.normal(0, 0.001),
                'timestamp': (base_time + timedelta(minutes=i * 3)).isoformat(),
            })

        # Simulate accelerometer (normal working conditions)
        accel = list(np.random.normal(0.5, 0.3, 6))
        gyro = list(np.random.normal(0.1, 0.08, 6))

        worker_data = {
            'path_points': path,
            'accelerometer': accel,
            'gyroscope': gyro,
            'battery_temp': round(np.random.uniform(28, 38), 1),
            'barometric_pressure': round(np.random.uniform(998, 1012), 1),
            'weather_condition': 'Rain',
            'claimed_location': {'lat': lat, 'lng': lng},
            'platform_data': {
                'is_active': platform_status == 'active',
                'status': platform_status,
                'last_order_time': (datetime.now() - timedelta(minutes=np.random.randint(5, 90))).isoformat(),
            },
            'network_quality': {'degraded': np.random.random() < 0.3},
            'claim_history': {
                'total_claims': np.random.randint(0, 8),
                'rejected_claims': 0,
            },
        }

        return self.run_full_check(worker_data)


# ==============================================================================
# HELPERS
# ==============================================================================

def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2)**2
    return R * 2 * np.arcsin(np.sqrt(a))


def _parse_time(ts):
    if isinstance(ts, datetime):
        return ts
    if not ts:
        return datetime.now()
    try:
        return datetime.fromisoformat(str(ts).replace('Z', '+00:00').replace('+00:00', ''))
    except:
        return datetime.now()


# Singleton
_engine = None

def get_fraud_engine():
    global _engine
    if _engine is None:
        _engine = FraudEngine()
    return _engine
