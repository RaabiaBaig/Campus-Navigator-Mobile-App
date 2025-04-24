import React from 'react';
import { NavigationContainer } from '@react-navigation/native'; // For navigation
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // Stack navigation
import HomeScreen from './src/screens/HomeScreen'; // Import your HomeScreen component
import MapScreen from './src/screens/MapScreen'; // Add this line
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
