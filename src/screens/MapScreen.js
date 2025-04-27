// MapScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';

const BUILDINGS = {
  'Block A': {
    coords: [
      {latitude: 31.4823319, longitude: 74.3033411},
      {latitude: 31.4816815, longitude: 74.3035853},
      {latitude: 31.4817432, longitude: 74.3038589},
      {latitude: 31.4824073, longitude: 74.3036094},
      {latitude: 31.4823319, longitude: 74.3033411}
    ],
    center: {latitude: 31.481991, longitude: 74.3036737}
  },
  'Block E': {
    coords: [
      {latitude: 31.4816861, longitude: 74.3036175},
      {latitude: 31.4812995, longitude: 74.3037596},
      {latitude: 31.4813658, longitude: 74.3040198},
      {latitude: 31.4817478, longitude: 74.3038911},
      {latitude: 31.4816861, longitude: 74.3036175}
    ],
    center: {latitude: 31.4815328, longitude: 74.3038079}
  },
  // Add other buildings similarly...
};

const MapScreen = ({ route }) => {
  const { readings } = route.params;
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const locateUser = async () => {
      try {
        const response = await fetch('http://172.16.74.62:5000/locate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readings })
        });
        const location = await response.json();
        setPosition({
          latitude: location.latitude,
          longitude: location.longitude
        });
      } catch (error) {
        console.error('Location error:', error);
      } finally {
        setLoading(false);
      }
    };

    locateUser();
  }, [readings]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 31.481991,
          longitude: 74.3036737,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        }}
      >
        {Object.entries(BUILDINGS).map(([name, data]) => (
          <Polygon
            key={name}
            coordinates={data.coords}
            fillColor="rgba(0,100,255,0.2)"
            strokeColor="rgba(0,100,255,0.8)"
          />
        ))}
        
        {!loading && position && (
          <Marker
            coordinate={position}
            title="Your Location"
            pinColor="red"
          />
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

export default MapScreen;