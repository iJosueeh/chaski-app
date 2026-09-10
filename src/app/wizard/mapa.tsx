/**
 * Wizard — Paso 1b: BUSCAR UNA UBICACIÓN (mapa estilo Uber/InDrive).
 *
 * Flujo: barra de búsqueda (geocoding nativo, sin API key) → el mapa se
 * centra en el primer resultado → el usuario puede arrastrar el pin para
 * afinar → CONFIRMAR UBICACIÓN guarda en el WizardContext y avanza al
 * Paso 2 (Tiempo). Estilo Serie AX: crema, mono, botón terracota.
 */
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, type Region } from 'react-native-maps';
import * as Location from 'expo-location';

import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import { StepIndicator, TocapuStrip, WizardTopBar } from '@/features/wizard/components/wizard-ui';

const LIMA_INICIAL: Region = {
  latitude: -12.121,
  longitude: -77.03,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function WizardMapa() {
  const theme = useTheme();
  const { setUbicacion } = useWizard();
  const mapRef = useRef<MapView | null>(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [region, setRegion] = useState<Region>(LIMA_INICIAL);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinLabel, setPinLabel] = useState('');

  /** Geocoding con el API nativo de expo-location (gratis, sin key). */
  const buscar = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchError('');
    try {
      const results = await Location.geocodeAsync(`${q}, Lima, Perú`);
      if (!results.length) {
        setSearchError('No encontramos esa dirección. Prueba con otra.');
        setSearching(false);
        return;
      }
      const { latitude, longitude } = results[0];
      const next: Region = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(next);
      setPin({ lat: latitude, lng: longitude });
      setPinLabel(q);
      mapRef.current?.animateToRegion(next, 500);
    } catch {
      setSearchError('Error al buscar. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setSearching(false);
    }
  };

  /** Al arrastrar el mapa con el pin fijado, se actualiza el punto elegido. */
  const onRegionChangeComplete = (r: Region) => {
    setRegion(r);
    if (pin) {
      setPin({ lat: r.latitude, lng: r.longitude });
    }
  };

  const confirmar = () => {
    if (!pin) return;
    setUbicacion({
      modo: 'busqueda',
      nombre: pinLabel || 'Punto elegido en el mapa',
      lat: pin.lat,
      lng: pin.lng,
    });
    router.push('/wizard/tiempo');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: theme.background }]}>
      <WizardTopBar
        onBack={() => router.back()}
        onCancel={() => {
          router.dismissAll();
          router.back();
        }}
      />
      <TocapuStrip />

      {/* Barra de búsqueda */}
      <View style={styles.searchWrap}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: theme.surface,
              borderColor: theme.brand,
              color: theme.brand,
            },
          ]}
          placeholder="Ej. Parque Kennedy, Miraflores"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={buscar}
          returnKeyType="search"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: theme.carmine, borderColor: theme.brand }]}
          onPress={buscar}
          accessibilityRole="button">
          {searching ? (
            <ActivityIndicator color={theme.surface} size="small" />
          ) : (
            <Text style={[styles.searchBtnText, { color: theme.surface }]}>🔍</Text>
          )}
        </TouchableOpacity>
      </View>

      {searchError ? (
        <Text style={[styles.errorText, { color: theme.carmine }]}>{searchError}</Text>
      ) : null}

      {/* Mapa */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={region}
          onRegionChangeComplete={onRegionChangeComplete}
          onPress={(e) => {
            // Tap en el mapa: mueve el pin ahí
            setPin({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
            setPinLabel(query || 'Punto elegido');
          }}>
          {pin ? (
            <Marker
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              title="Tu punto de partida"
              description={pinLabel}
            />
          ) : null}
        </MapView>

        {/* Chip flotante con el punto elegido */}
        {pin ? (
          <View style={[styles.pinChip, { backgroundColor: theme.surface, borderColor: theme.brand }]}>
            <Text style={[styles.pinChipText, { color: theme.brand }]} numberOfLines={1}>
              📍 {pinLabel || 'Punto elegido'}
            </Text>
          </View>
        ) : (
          <View style={[styles.pinHint, { backgroundColor: theme.surface, borderColor: theme.brand }]}>
            <Text style={[styles.pinHintText, { color: theme.textSecondary }]}>
              Busca una dirección o toca el mapa para poner tu punto
            </Text>
          </View>
        )}
      </View>

      {/* CTA confirmar */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={confirmar}
          disabled={!pin}
          accessibilityRole="button">
          <View
            style={[
              styles.ctaBtn,
              {
                backgroundColor: pin ? theme.carmine : theme.border,
                borderColor: theme.brand,
              },
            ]}>
            <Text style={[styles.ctaText, { color: pin ? theme.surface : theme.textSecondary }]}>
              CONFIRMAR UBICACIÓN
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.background }]}>
        <StepIndicator step={1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 14,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 13,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { fontSize: 16 },
  errorText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  pinChip: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    maxWidth: '85%',
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pinChipText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 11,
  },
  pinHint: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    maxWidth: '85%',
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pinHintText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    textAlign: 'center',
  },
  ctaWrap: { paddingHorizontal: 20, paddingVertical: 12 },
  ctaBtn: {
    height: 54,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
