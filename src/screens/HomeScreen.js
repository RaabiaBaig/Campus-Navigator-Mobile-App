import React, { useState } from 'react';
import { View, Button, Image, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const HOST = 'http://172.16.74.62:5000'; // Use your actual IP

const HomeScreen = () => {
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);

  const pickImage = async () => {
    console.log('Starting image picker');
    try {
      // Remove allowsEditing and aspect ratio to disable cropping
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        console.log('Image selected:', selectedImage.uri);
        setImageUri(selectedImage.uri);
        setPrediction(null);
      } else {
        console.log('Image selection cancelled');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not select image');
    }
  };

  const uploadImage = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    console.log('Starting image upload with URI:', imageUri);
    setLoading(true);

    try {
      // Read the file content
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      const filename = imageUri.split('/').pop();
      const fileType = filename.split('.').pop().toLowerCase();

      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        name: filename,
        type: `image/${fileType}`,
      });

      console.log('Sending request to:', `${HOST}/detect-block`);
      const response = await fetch(`${HOST}/detect-block`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);

      if (result.status === 'success') {
        setPrediction({
          block: result.block,
          confidence: result.confidence,
        });
      } else {
        Alert.alert('Error', result.message || 'Prediction failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Image upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {imageUri && (
        <>
          <Image source={{ uri: imageUri }} style={styles.image} />
          <Text style={styles.imageInfo}>{imageUri}</Text>
        </>
      )}

      <View style={styles.buttonContainer}>
        <Button title="Select Image" onPress={pickImage} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <View style={styles.buttonContainer}>
          <Button 
            title="Upload and Detect" 
            onPress={uploadImage} 
            disabled={!imageUri || loading} 
          />
        </View>
      )}

      {prediction && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>Block: {prediction.block}</Text>
          <Text style={styles.resultText}>
            Confidence: {(prediction.confidence * 100).toFixed(2)}%
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  image: {
    width: 300,
    height: 300,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  imageInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  buttonContainer: {
    marginVertical: 10,
    width: '80%',
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e8f4f8',
    borderRadius: 5,
  },
  resultText: {
    fontSize: 16,
    marginVertical: 5,
  },
});

export default HomeScreen;