import React, { useState, useRef } from 'react';
import { View, Button, Image, Text, StyleSheet, Alert } from 'react-native';
import { RNCamera } from 'react-native-camera';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker'; //  NEW

const HomeScreen = () => {
  const navigation = useNavigation();
  const cameraRef = useRef();

  const [leftUri, setLeftUri] = useState(null);
  const [rightUri, setRightUri] = useState(null);
  const [readings, setReadings] = useState([]);

  const takePicture = async (side) => {
    if (!cameraRef.current) return;
    const data = await cameraRef.current.takePictureAsync();
    if (side === 'left') setLeftUri(data.uri);
    else setRightUri(data.uri);
  };

  //  NEW: Pick image from gallery instead of camera
  const pickImage = async (side) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (side === 'left') setLeftUri(uri);
      else setRightUri(uri);
    }
  };

  const getReading = async () => {
    if (!leftUri || !rightUri) {
      Alert.alert('Please capture both left and right images first.');
      return;
    }

    const form = new FormData();
    form.append('left', { uri: leftUri, name: 'left.jpg', type: 'image/jpeg' });
    form.append('right', { uri: rightUri, name: 'right.jpg', type: 'image/jpeg' });

    try {
      const res = await fetch('http://127.0.0.1:5000/predict', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (json.error) {
        Alert.alert('Error', json.error);
        return;
      }
      setReadings((prev) => [...prev, json]);
      setLeftUri(null);
      setRightUri(null);
    } catch (err) {
      Alert.alert('Network error', err.message);
    }
  };

  const onProceed = () => {
    if (readings.length < 3) {
      Alert.alert('Need 3 readings', `Currently you have ${readings.length}.`);
      return;
    }
    navigation.navigate('Map', { readings });
  };

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={RNCamera.Constants.Type.back}
      />

      <View style={styles.buttons}>
        <Button title="Capture Left View" onPress={() => takePicture('left')} />
        <Button title="Capture Right View" onPress={() => takePicture('right')} />
      </View>

      {/*  NEW Upload buttons */}
      <View style={styles.buttons}>
        <Button title="Upload Left Image" onPress={() => pickImage('left')} />
        <Button title="Upload Right Image" onPress={() => pickImage('right')} />
      </View>

      <View style={styles.preview}>
        {leftUri && <Image source={{ uri: leftUri }} style={styles.thumb} />}
        {rightUri && <Image source={{ uri: rightUri }} style={styles.thumb} />}
      </View>

      <Button title="Get Reading" onPress={getReading} />
      <Text style={styles.count}>Readings: {readings.length}/3</Text>
      <Button title="Proceed to Map" onPress={onProceed} disabled={readings.length < 3} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  camera: { flex: 4 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', padding: 10 },
  preview: { flexDirection: 'row', justifyContent: 'center', padding: 10 },
  thumb: { width: 80, height: 80, margin: 5, borderRadius: 5 },
  count: { textAlign: 'center', margin: 10, fontSize: 16 },
});

export default HomeScreen;


