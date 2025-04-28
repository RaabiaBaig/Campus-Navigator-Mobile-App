import React, { useState } from 'react';
import { View, Button, Image, Text, StyleSheet, Alert, ActivityIndicator, ScrollView, Modal, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';

const HOST = 'http://172.16.74.62:5000'; // Use your actual IP
const MAX_RUNS = 3; // Number of times to run the process

const HomeScreen = () => {
  const navigation = useNavigation();
  const [runs, setRuns] = useState([]);
  const [currentRun, setCurrentRun] = useState({
    imageUris: [],
    loading: false,
    prediction: null,
    distanceResult: null,
    selectedForDetection: null,
    step: 1 // 1: select images, 2: detect block, 3: calculate distance
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [positionResult, setPositionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTrilaterationButton, setShowTrilaterationButton] = useState(false);

  // Function to pick images from gallery
  const pickImages = async () => {
    console.log('Starting image picker');
    try {
      // Request permissions first if needed
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photos to select images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 2,
        quality: 1,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length === 2) {
        const selectedImages = result.assets.slice(0, 2);
        console.log('Images selected:', selectedImages.map(img => img.uri));
        setCurrentRun(prev => ({
          ...prev,
          imageUris: selectedImages.map(img => img.uri),
          prediction: null,
          distanceResult: null,
          step: 2
        }));
      } else if (result.assets && result.assets.length !== 2) {
        Alert.alert('Error', 'Please select exactly two images');
      } else {
        console.log('Image selection cancelled');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not select images');
    }
  };

  // Function to capture images from camera
  const captureImages = async () => {
    console.log('Starting camera capture');
    try {
      // Request camera permissions first if needed
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your camera to take photos');
        return;
      }

      // We'll capture two images one after another
      const capturedImages = [];
      
      for (let i = 0; i < 2; i++) {
        Alert.alert(
          `Capture Image ${i + 1}`,
          `Please position your camera for image ${i + 1} of 2 and press OK to take the photo`,
          [
            {
              text: 'Cancel',
              onPress: () => {
                console.log('Image capture cancelled');
                return;
              },
              style: 'cancel',
            },
            {
              text: 'OK',
              onPress: async () => {
                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: false,
                  aspect: [4, 3],
                  quality: 1,
                });

                if (!result.canceled && result.assets && result.assets.length > 0) {
                  capturedImages.push(result.assets[0].uri);
                  console.log(`Image ${i + 1} captured:`, result.assets[0].uri);

                  // If we've captured both images, update state
                  if (capturedImages.length === 2) {
                    setCurrentRun(prev => ({
                      ...prev,
                      imageUris: capturedImages,
                      prediction: null,
                      distanceResult: null,
                      step: 2
                    }));
                  }
                }
              },
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      console.error('Camera capture error:', error);
      Alert.alert('Error', 'Could not capture images');
    }
  };

  const selectImageForDetection = () => {
    if (currentRun.imageUris.length !== 2) {
      Alert.alert('Error', 'Please select two images first');
      return;
    }
    setModalVisible(true);
  };

  const detectBlock = async (selectedUri) => {
    setModalVisible(false);
    setCurrentRun(prev => ({ ...prev, loading: true, selectedForDetection: selectedUri }));

    try {
      const fileInfo = await FileSystem.getInfoAsync(selectedUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      const filename = selectedUri.split('/').pop();
      const fileType = filename.split('.').pop().toLowerCase();

      const formData = new FormData();
      formData.append('image', {
        uri: selectedUri,
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
        setCurrentRun(prev => ({
          ...prev,
          prediction: result,
          step: 3,
          loading: false
        }));
      } else {
        throw new Error(result.message || 'Detection failed');
      }
    } catch (error) {
      console.error('Detection error:', error);
      Alert.alert('Error', error.message || 'Block detection failed');
      setCurrentRun(prev => ({ ...prev, loading: false }));
    }
  };

  const calculateDistance = async () => {
    if (!currentRun.prediction || currentRun.imageUris.length !== 2) {
      Alert.alert('Error', 'Block detection not completed or missing images');
      return;
    }

    setCurrentRun(prev => ({ ...prev, loading: true }));

    try {
      const formData = new FormData();
      
      for (let i = 0; i < currentRun.imageUris.length; i++) {
        const uri = currentRun.imageUris[i];
        const filename = uri.split('/').pop();
        const fileType = filename.split('.').pop().toLowerCase();
        
        formData.append('images', {
          uri: uri,
          name: `image${i+1}.${fileType}`,
          type: `image/${fileType}`,
        });
      }

      formData.append('prediction', JSON.stringify(currentRun.prediction));

      console.log('Sending request to:', `${HOST}/calculate-distance`);
      const response = await fetch(`${HOST}/calculate-distance`, {
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
        const completedRun = {
          ...currentRun,
          distanceResult: result,
          loading: false
        };
        
        setRuns(prev => [...prev, completedRun]);
        setRunCount(prev => prev + 1);
        
        if (runCount + 1 < MAX_RUNS) {
          setCurrentRun({
            imageUris: [],
            loading: false,
            prediction: null,
            distanceResult: null,
            selectedForDetection: null,
            step: 1
          });
        } else {
          setShowTrilaterationButton(true);
        }
      } else {
        throw new Error(result.message || 'Distance calculation failed');
      }
    } catch (error) {
      console.error('Distance calculation error:', error);
      Alert.alert('Error', error.message || 'Distance calculation failed');
      setCurrentRun(prev => ({ ...prev, loading: false }));
    }
  };

  const calculateUserPosition = async () => {
    if (runs.length < 3) {
      Alert.alert('Error', 'Need at least 3 measurements to calculate position');
      return;
    }

    setLoading(true);

    try {
      const measurements = runs.map(run => ({
        block: run.prediction.block,
        distance: run.distanceResult.distance,
        confidence: run.prediction.confidence
      }));

      console.log('Sending measurements:', measurements);
      const response = await fetch(`${HOST}/calculate-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ measurements }),
      });

      const result = await response.json();
      console.log('Position result:', result);

      if (result.status === 'success') {
        setPositionResult({
          x: result.position[0],
          y: result.position[1],
          error: result.error_estimate.toFixed(2),
          landmarks: result.used_landmarks
        });
        
        Alert.alert(
          'Position Calculated',
          `Your estimated position is:\nX: ${result.position[0].toFixed(2)}m\nY: ${result.position[1].toFixed(2)}m\n` +
          `Error estimate: ±${result.error_estimate.toFixed(2)}m\n` +
          `Used landmarks: ${result.used_landmarks}`
        );
      } else {
        Alert.alert('Error', result.message || 'Position calculation failed');
      }
    } catch (error) {
      console.error('Position calculation error:', error);
      Alert.alert('Error', error.message || 'Failed to calculate position');
    } finally {
      setLoading(false);
      setShowTrilaterationButton(false);
    }
  };

  const navigateToMap = () => {
    if (!positionResult) {
      Alert.alert('Error', 'No position data available');
      return;
    }
    
    navigation.navigate('Map', { 
      position: {
        x: parseFloat(positionResult.x),
        y: parseFloat(positionResult.y)
      }
    });
  };

  const resetProcess = () => {
    setRuns([]);
    setCurrentRun({
      imageUris: [],
      loading: false,
      prediction: null,
      distanceResult: null,
      selectedForDetection: null,
      step: 1
    });
    setRunCount(0);
    setPositionResult(null);
    setShowTrilaterationButton(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Campus Navigation Pipeline</Text>
      <Text style={styles.runCounter}>Run {runCount + 1} of {MAX_RUNS}</Text>
      
      {/* Current Run */}
      {runCount < MAX_RUNS && (
        <>
          {/* Step 1: Select Images */}
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 1: Select Two Images</Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonWrapper}>
                <Button title="Pick from Gallery" onPress={pickImages} />
              </View>
              <View style={styles.buttonWrapper}>
                <Button title="Capture with Camera" onPress={captureImages} />
              </View>
            </View>
            
            {currentRun.imageUris.length > 0 && (
              <View style={styles.imagePreviewContainer}>
                {currentRun.imageUris.map((uri, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri }} style={styles.image} />
                    <Text style={styles.imageInfo}>Image {index + 1}</Text>
                    {currentRun.selectedForDetection === uri && (
                      <Text style={styles.selectedLabel}>Selected for Detection</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Step 2: Detect Block */}
          {currentRun.step >= 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Step 2: Detect Block</Text>
              <View style={styles.buttonContainer}>
                <Button 
                  title="Select Image for Block Detection" 
                  onPress={selectImageForDetection} 
                  disabled={currentRun.imageUris.length !== 2 || currentRun.loading} 
                />
              </View>
              
              {currentRun.loading && <ActivityIndicator size="large" color="#0000ff" />}
              
              {currentRun.prediction && (
                <View style={styles.resultContainer}>
                  <Text style={styles.resultTitle}>Block Detection Results:</Text>
                  <Text style={styles.resultText}>Block: {currentRun.prediction.block}</Text>
                  <Text style={styles.resultText}>
                    Confidence: {(currentRun.prediction.confidence * 100).toFixed(2)}%
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Step 3: Calculate Distance */}
          {currentRun.step >= 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Step 3: Calculate Distance</Text>
              <View style={styles.buttonContainer}>
                <Button 
                  title="Calculate Distance" 
                  onPress={calculateDistance} 
                  disabled={!currentRun.prediction || currentRun.loading} 
                />
              </View>
              
              {currentRun.loading && <ActivityIndicator size="large" color="#0000ff" />}
            </View>
          )}
        </>
      )}

      {/* Results from Completed Runs */}
      {runs.length > 0 && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Results Summary</Text>
          {runs.map((run, index) => (
            <View key={index} style={styles.completedRunContainer}>
              <Text style={styles.runHeader}>Run {index + 1}</Text>
              <View style={styles.resultContainer}>
                <Text style={styles.resultTitle}>Block Detection:</Text>
                <Text style={styles.resultText}>Block: {run.prediction.block}</Text>
                <Text style={styles.resultText}>
                  Confidence: {(run.prediction.confidence * 100).toFixed(2)}%
                </Text>
              </View>
              {run.distanceResult && (
                <View style={styles.resultContainer}>
                  <Text style={styles.resultTitle}>Distance Calculation:</Text>
                  <Text style={styles.resultText}>Matched Object: {run.distanceResult.matched_object}</Text>
                  <Text style={styles.resultText}>Distance: {run.distanceResult.distance.toFixed(2)} meters</Text>
                  <Text style={styles.resultText}>ORB Matches: {run.distanceResult.orb_matches}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Trilateration Button */}
      {showTrilaterationButton && (
        <View style={styles.buttonContainer}>
          <Button 
            title="Calculate Position (Trilateration)" 
            onPress={calculateUserPosition} 
            color="#4CAF50"
          />
        </View>
      )}

      {/* Position Result */}
      {positionResult && (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Your Position</Text>
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>X: {positionResult.x.toFixed(2)}m (East-West)</Text>
            <Text style={styles.resultText}>Y: {positionResult.y.toFixed(2)}m (North-South)</Text>
            <Text style={styles.resultText}>Estimated error: ±{positionResult.error}m</Text>
            <Text style={styles.resultText}>Used {positionResult.landmarks} landmarks</Text>
            <Text style={styles.noteText}>
              Note: Coordinates are relative to Block A (0,0)
            </Text>
          </View>
          {/* View on Map Button */}
          <View style={styles.buttonContainer}>
            <Button 
              title="View on Map" 
              onPress={navigateToMap} 
              color="#2196F3"
            />
          </View>
        </View>
      )}

      {/* Reset Button */}
      {(runs.length > 0 || currentRun.step > 1) && (
        <View style={styles.buttonContainer}>
          <Button title="Start Over" onPress={resetProcess} color="#ff4444" />
        </View>
      )}

      {/* Image Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Image for Block Detection</Text>
            {currentRun.imageUris.map((uri, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.modalOption}
                onPress={() => detectBlock(uri)}
              >
                <Image source={{ uri }} style={styles.modalImage} />
                <Text style={styles.modalOptionText}>Image {index + 1}</Text>
              </TouchableOpacity>
            ))}
            <Button 
              title="Cancel" 
              onPress={() => setModalVisible(false)} 
              color="#ff4444"
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  runCounter: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#555',
  },
  stepContainer: {
    width: '100%',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#444',
  },
  buttonContainer: {
    marginVertical: 10,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  buttonWrapper: {
    width: '48%', // Slightly less than half to account for spacing
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  imageWrapper: {
    alignItems: 'center',
    margin: 5,
  },
  image: {
    width: 150,
    height: 150,
    marginBottom: 5,
    resizeMode: 'contain',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  imageInfo: {
    fontSize: 12,
    color: '#666',
  },
  selectedLabel: {
    fontSize: 12,
    color: 'green',
    fontWeight: 'bold',
  },
  completedRunContainer: {
    marginBottom: 20,
    width: '100%',
  },
  runHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  resultContainer: {
    marginTop: 10,
    padding: 15,
    backgroundColor: '#e8f4f8',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#d0e3f0',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    marginVertical: 3,
    color: '#555',
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalImage: {
    width: 60,
    height: 60,
    marginRight: 15,
    resizeMode: 'contain',
  },
  modalOptionText: {
    fontSize: 16,
  },
});

export default HomeScreen;