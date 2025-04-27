# phase4_trilateration.py
import numpy as np
from geopy.distance import geodesic

def trilaterate(lat1, lon1, d1, lat2, lon2, d2, lat3, lon3, d3):
    """
    Geographic trilateration using haversine distance
    Input: 3 (lat,lon) points and their distances in meters
    Returns: (lat, lon) of estimated position
    """
    # Earth radius in meters
    R = 6371000
    
    # Convert to Cartesian (approximate for small areas)
    def to_cart(lat, lon):
        x = R * np.cos(np.radians(lat)) * np.cos(np.radians(lon))
        y = R * np.cos(np.radians(lat)) * np.sin(np.radians(lon))
        return np.array([x, y])
    
    p1 = to_cart(lat1, lon1)
    p2 = to_cart(lat2, lon2)
    p3 = to_cart(lat3, lon3)
    
    # Trilateration math
    ex = (p2 - p1) / np.linalg.norm(p2 - p1)
    i = np.dot(ex, p3 - p1)
    ey = (p3 - p1 - i*ex) / np.linalg.norm(p3 - p1 - i*ex)
    d = np.linalg.norm(p2 - p1)
    j = np.dot(ey, p3 - p1)
    
    x = (d1**2 - d2**2 + d**2) / (2*d)
    y = (d1**2 - d3**2 + i**2 + j**2) / (2*j) - (i/j)*x
    
    # Convert back to lat/lon
    result = p1 + x*ex + y*ey
    lat = np.degrees(np.arcsin(result[2]/R)) if len(result) > 2 else lat1
    lon = np.degrees(np.arctan2(result[1], result[0]))
    
    return round(lat, 6), round(lon, 6)