import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';

const BLOCK_COORDS = {
  "Block A": { latitude: 31.481991, longitude: 74.3036737 },
  "Block B": { latitude: 31.4815, longitude: 74.3030 },
  "Block C": { latitude: 31.4811762, longitude: 74.3028048 },
  "Block D": { latitude: 31.481064, longitude: 74.3033213 },
  "Block E": { latitude: 31.4815328, longitude: 74.3038079 },
  "Block F": { latitude: 31.4805619, longitude: 74.3041524 }
};

const BLOCK_POLYGONS = {
  "Block A": [
    { latitude: 31.4823319, longitude: 74.3033411 },
    { latitude: 31.4816815, longitude: 74.3035853 },
    { latitude: 31.4817432, longitude: 74.3038589 },
    { latitude: 31.4824073, longitude: 74.3036094 },
    { latitude: 31.4823319, longitude: 74.3033411 }
  ],
  "Block B": [
    { latitude: 31.4813546, longitude: 74.3027201 },
    { latitude: 31.4813158, longitude: 74.3027362 },
    { latitude: 31.4814919, longitude: 74.303388 },
    { latitude: 31.4816772, longitude: 74.3033183 },
    { latitude: 31.4814804, longitude: 74.3026611 },
    { latitude: 31.4813546, longitude: 74.3027201 }
  ],
  "Block C": [
    { latitude: 31.4809004, longitude: 74.3026615 },
    { latitude: 31.4809794, longitude: 74.302904 },
    { latitude: 31.4813889, longitude: 74.3026841 },
    { latitude: 31.4813615, longitude: 74.3026023 },
    { latitude: 31.4812254, longitude: 74.30267 },
    { latitude: 31.4811785, longitude: 74.3025286 },
    { latitude: 31.4809004, longitude: 74.3026615 }
  ],
  "Block D": [
    { latitude: 31.4809004, longitude: 74.3026642 },
    { latitude: 31.4806899, longitude: 74.3027594 },
    { latitude: 31.4809747, longitude: 74.3036539 },
    { latitude: 31.4811921, longitude: 74.3035695 },
    { latitude: 31.4809004, longitude: 74.3026642 }
  ],
  "Block E": [
    { latitude: 31.4816861, longitude: 74.3036175 },
    { latitude: 31.4812995, longitude: 74.3037596 },
    { latitude: 31.4813658, longitude: 74.3040198 },
    { latitude: 31.4817478, longitude: 74.3038911 },
    { latitude: 31.4816861, longitude: 74.3036175 }
  ],
  "Block F": [
    { latitude: 31.4805756, longitude: 74.3037796 },
    { latitude: 31.4800289, longitude: 74.3039941 },
    { latitude: 31.4801547, longitude: 74.3044125 },
    { latitude: 31.4807083, longitude: 74.3042167 },
    { latitude: 31.4805756, longitude: 74.3037796 }
  ]
};

const MapScreen = ({ route }) => {
  const navigation = useNavigation();
  const { position } = route.params;
  const blockARef = BLOCK_COORDS["Block A"];
  
  // Convert position from meters to lat/lng
  const latToMeters = 111320;
  const lngToMeters = 111320 * Math.cos(blockARef.latitude * Math.PI / 180);
  
  const userLat = blockARef.latitude + (position.y / latToMeters);
  const userLng = blockARef.longitude + (position.x / lngToMeters);
  
  const userPosition = {
    latitude: userLat,
    longitude: userLng,
  };

  return (
    <View style={styles.container}>


      <MapView
        style={styles.map}
        initialRegion={{
          latitude: blockARef.latitude,
          longitude: blockARef.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        // Add these props to improve polygon rendering
        minZoomLevel={13}
        maxZoomLevel={20}
        mapType="standard"
      >
        {/* Improved Polygon Rendering */}
        {Object.entries(BLOCK_POLYGONS).map(([blockName, coordinates]) => (
          <Polygon
            key={blockName}
            coordinates={coordinates}
            fillColor="rgba(100, 100, 255, 0.3)"  // More opaque fill
            strokeColor="rgba(0, 0, 255, 0.8)"    // Darker stroke
            strokeWidth={3}                      // Thicker border
            tappable={true}
            zIndex={2}                           // Higher zIndex
            lineCap="round"
            lineJoin="round"
            miterLimit={1}
            geodesic={false}
          />
        ))}
        
        {/* Block markers */}
        {Object.entries(BLOCK_COORDS).map(([blockName, coords]) => (
          <Marker
            key={blockName}
            coordinate={coords}
            title={blockName}
            pinColor="blue"
            zIndex={3}
          />
        ))}
        
        {/* User position marker */}
        <Marker coordinate={userPosition} title="Your Position" zIndex={4}>
  <View style={styles.userMarker} />
</Marker>

      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  userMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgb(247, 4, 4)', // bright blue dot
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: 'rgb(255, 0, 0)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6, // For Android shadow
  },
  
  markerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MapScreen;
