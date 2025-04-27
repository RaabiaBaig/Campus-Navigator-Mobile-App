
import numpy as np
from scipy.optimize import least_squares

class TrilaterationCalculator:
    def __init__(self):
        # Known positions of landmarks (blocks) in meters
        # Using Block A as reference point (0,0)
        self.landmark_positions = {
            "Block A": np.array([0, 0]),      # Reference point
            "Block B": np.array([-75.32, -54.60]),   # Calculated from your GeoJSON
            "Block C": np.array([-96.63, -90.62]),
            "Block D": np.array([-3.91, -103.76]),
            "Block E": np.array([14.81, -51.15]),
            "Block F": np.array([52.91, -159.41])
        }

    def calculate_position_with_confidence(self, measurements):
        """
        Calculate position with confidence estimates
        
        Args:
            measurements: List of dicts with format:
                [{
                    'block': 'Block A',
                    'distance': 10.5,  # in meters
                    'confidence': 0.95  # optional confidence score
                }, ...]
        
        Returns:
            {
                'position': [x, y],
                'error_estimate': float,
                'used_landmarks': int
            }
        """
        try:
            # Filter and weight measurements
            valid_measurements = []
            weights = []
            
            for m in measurements:
                if m['block'] in self.landmark_positions:
                    valid_measurements.append(m)
                    # Use confidence if available, otherwise default to 1.0
                    weights.append(m.get('confidence', 1.0))
            
            if len(valid_measurements) < 3:
                raise ValueError("Not enough valid measurements (need at least 3)")
            
            positions = [self.landmark_positions[m['block']] for m in valid_measurements]
            distances = [m['distance'] for m in valid_measurements]
            
            # Weighted initial guess (centroid of landmarks)
            initial_guess = np.average(positions, axis=0, weights=weights)
            
            # Weighted error function
            def error_function(point):
                errors = [
                    (np.linalg.norm(point - positions[i]) - distances[i])
                    for i in range(len(positions))
                ]
                return np.array(errors) * np.array(weights)
            
            # Solve using nonlinear least squares
            result = least_squares(error_function, initial_guess)
            
            if not result.success:
                raise RuntimeError("Position calculation failed to converge")
            
            # Calculate error estimate (mean absolute residual)
            residuals = error_function(result.x)
            error_estimate = np.mean(np.abs(residuals))
            
            return {
                'position': result.x.tolist(),
                'error_estimate': error_estimate,
                'used_landmarks': len(valid_measurements)
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'used_landmarks': len(valid_measurements) if 'valid_measurements' in locals() else 0
            }

    def latlng_to_meters(self, lat, lng, ref_lat=31.481991, ref_lng=74.3036737):
        """Convert latitude/longitude to meters relative to reference point"""
        # Approximate conversions for small areas
        lat_to_meters = 111320  # meters per degree latitude
        lng_to_meters = 111320 * np.cos(np.radians(ref_lat))  # meters per degree longitude
        
        x = (lng - ref_lng) * lng_to_meters
        y = (lat - ref_lat) * lat_to_meters
        return np.array([x, y])