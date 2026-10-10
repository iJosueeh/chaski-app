import React, { forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapViewProps {
  style?: any;
  initialRegion?: Region;
  region?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  children?: React.ReactNode;
  [key: string]: any;
}

export interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  draggable?: boolean;
  onDragEnd?: (e: any) => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export const Marker: React.FC<MarkerProps> = () => null;

export interface MapViewRef {
  animateToRegion: (region: Region, duration?: number) => void;
}

/**
 * Fallback seguro de MapView para la plataforma Web y SSR en Node.
 * Evita cargar los specs Fabric/TurboModules de react-native-maps en react-native-web.
 */
const MapViewWeb = forwardRef<MapViewRef, MapViewProps>((props, ref) => {
  useImperativeHandle(ref, () => ({
    animateToRegion: (_region: Region, _duration?: number) => {},
  }));

  return (
    <View style={[styles.fallback, props.style]}>
      <Text style={styles.fallbackText}>
        Mapa disponible en la app móvil (Android / iOS)
      </Text>
    </View>
  );
});

MapViewWeb.displayName = 'MapViewWeb';

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#EAE5DC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderWidth: 1,
    borderColor: '#D4C8B8',
  },
  fallbackText: {
    color: '#8A7A6D',
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});

export default MapViewWeb;
