// trilateration.js
import { Alert } from 'react-native';

// Convert latitude/longitude to meters (simplified for small campus area)
function toMeters(lat, lng, refLat = 31.481991, refLng = 74.3036737) {
  // Approximate conversions for small areas
  const latToMeters = 111320; // meters per degree latitude
  const lngToMeters = 111320 * Math.cos(refLat * Math.PI / 180); // meters per degree longitude
  
  return {
    x: (lng - refLng) * lngToMeters,
    y: (lat - refLat) * latToMeters
  };
}

// Block coordinates in meters (using your GeoJSON data)
const BLOCK_COORDS = {
  "Block A": toMeters(31.481991, 74.3036737),
  "Block B": toMeters(31.4815, 74.3030), // Approximate center of polygon
  "Block C": toMeters(31.4811762, 74.3028048),
  "Block D": toMeters(31.481064, 74.3033213),
  "Block E": toMeters(31.4815328, 74.3038079),
  "Block F": toMeters(31.4805619, 74.3041524)
};

export function calculatePosition(measurements) {
  // Need at least 3 measurements for trilateration
  if (measurements.length < 3) {
    throw new Error("Need at least 3 measurements for trilateration");
  }

  // Filter measurements for known blocks
  const validMeasurements = measurements.filter(m => BLOCK_COORDS[m.block]);
  
  if (validMeasurements.length < 3) {
    throw new Error("Need measurements to at least 3 known blocks");
  }

  // Prepare data for trilateration
  const points = validMeasurements.map(m => {
    const blockPos = BLOCK_COORDS[m.block];
    return {
      x: blockPos.x,
      y: blockPos.y,
      r: m.distance
    };
  });

  // Simple trilateration (least squares approach)
  let A = [], b = [];
  for (let i = 1; i < points.length; i++) {
    A.push([
      2 * (points[i].x - points[0].x),
      2 * (points[i].y - points[0].y)
    ]);
    b.push([
      points[i].x**2 + points[i].y**2 - points[i].r**2 - 
      (points[0].x**2 + points[0].y**2 - points[0].r**2)
    ]);
  }

  // Solve the system Ax = b
  const At = transpose(A);
  const AtA = multiply(At, A);
  const Atb = multiply(At, b);
  const solution = solve(AtA, Atb);

  if (!solution) {
    throw new Error("Could not solve trilateration equations");
  }

  return {
    x: solution[0][0],
    y: solution[1][0],
    error: calculateError(solution[0][0], solution[1][0], points)
  };
}

// Helper linear algebra functions
function transpose(matrix) {
  return matrix[0].map((_, i) => matrix.map(row => row[i]));
}

function multiply(a, b) {
  const result = [];
  for (let i = 0; i < a.length; i++) {
    result[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < a[0].length; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function solve(A, b) {
  // Simple Gaussian elimination for 2x2 system
  const a = A[0][0], b1 = A[0][1], c = A[1][0], d = A[1][1];
  const e = b[0][0], f = b[1][0];
  
  const det = a * d - b1 * c;
  if (Math.abs(det) < 1e-10) return null;
  
  return [
    [(d * e - b1 * f) / det],
    [(a * f - c * e) / det]
  ];
}

function calculateError(x, y, points) {
  // Calculate average error
  let totalError = 0;
  for (const p of points) {
    const dist = Math.sqrt((x - p.x)**2 + (y - p.y)**2);
    totalError += Math.abs(dist - p.r);
  }
  return totalError / points.length;
}