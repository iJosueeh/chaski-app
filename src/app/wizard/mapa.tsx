/**
 * Wizard — Paso 1b: SELECCIÓN DE UBICACIÓN EN MAPA (Serie AX).
 *
 * Flujo:
 * 1. Cartografía interactiva visible: Capa de teselas (UrlTile OpenStreetMap)
 *    para garantizar renderizado fluido en Expo Go Android sin depender del
 *    servicio de tiles restringido de Google Play Services que produce fondo negro.
 * 2. Barra de búsqueda compacta con geocodificación nativa (expo-location).
 * 3. Selección directa tocando el mapa con geocodificación inversa automática.
 * 4. Panel Serie AX tipo boleto con coordenadas y dirección seleccionada.
 * 5. Botón «CONFIRMAR UBICACIÓN» deshabilitado hasta disponer de selección válida.
 */
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, UrlTile, type Region } from '@/components/ui/map-view';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TocapuStrip,
  WizardButton,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';
import { safeBackWizard, safeCancelWizard } from '@/features/wizard/utils/wizard-navigation';
import {
  formatMapCoordinates,
  formatReverseGeocodeLabel,
  LIMA_INICIAL,
  OSM_TILE_URL,
  resolveMapCartographyMode,
} from '@/features/wizard/constants/wizard-map';

const palette = Colors.light;

export default function WizardMapa() {
  const insets = useSafeAreaInsets();
  const { setUbicacion } = useWizard();
  const mapRef = useRef<MapView | null>(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [region, setRegion] = useState<Region>(LIMA_INICIAL);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinLabel, setPinLabel] = useState('');

  // En Android Expo Go sin API key registrada en Google Cloud, mapType="none" + UrlTile
  // evita el fondo negro que produce la falta de autorización del Maps SDK nativo.
  const hasCustomGoogleKey = Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);
  const initialMode = useMemo(
    () => resolveMapCartographyMode(Platform.OS === 'android', hasCustomGoogleKey),
    [hasCustomGoogleKey]
  );
  const [useOsmTiles, setUseOsmTiles] = useState<boolean>(initialMode.useOsmTiles);

  /** Geocoding nativo de expo-location (gratuito, sin API key requerida). */
  const buscar = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchError('');
    try {
      const results = await Location.geocodeAsync(`${q}, Lima, Perú`);
      if (!results.length) {
        setSearchError('No encontramos esa dirección en Lima. Prueba con otra o toca el mapa.');
        setSearching(false);
        return;
      }
      const { latitude, longitude } = results[0];
      const next: Region = {
        latitude,
        longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
      setRegion(next);
      setPin({ lat: latitude, lng: longitude });
      setPinLabel(q);
      mapRef.current?.animateToRegion(next, 500);
    } catch {
      setSearchError('Error de conexión al buscar. Toca el mapa directamente o intenta de nuevo.');
    } finally {
      setSearching(false);
    }
  };

  /**
   * Al tocar el mapa:
   * 1. Fija el pin de inmediato en las coordenadas tocadas.
   * 2. Intenta resolver nombre de calle/distrito con reverseGeocodeAsync.
   */
  const onMapPress = async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSearchError('');
    setPin({ lat: latitude, lng: longitude });
    const fallbackCoordText = `Punto (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
    setPinLabel(fallbackCoordText);

    setResolvingAddress(true);
    try {
      const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (rev && rev.length > 0) {
        const resolved = formatReverseGeocodeLabel(rev[0]);
        if (resolved) {
          setPinLabel(resolved);
        }
      }
    } catch {
      // Si falla geocodificación inversa (e.g. offline), conserva coordenadas legibles
    } finally {
      setResolvingAddress(false);
    }
  };

  /** Al arrastrar el mapa con pin activo, actualiza el punto central */
  const onRegionChangeComplete = (r: Region) => {
    setRegion(r);
  };

  /** Re-centrar mapa en Lima Metropolitana */
  const reenfocarLima = () => {
    setRegion(LIMA_INICIAL);
    mapRef.current?.animateToRegion(LIMA_INICIAL, 400);
  };

  /** Limpiar selección */
  const limpiarPin = () => {
    setPin(null);
    setPinLabel('');
    setSearchError('');
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

  const coordinatesDisplay = useMemo(() => {
    if (!pin) return '';
    return formatMapCoordinates(pin.lat, pin.lng);
  }, [pin]);

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={() => safeBackWizard('/wizard/ubicacion')}
        onCancel={safeCancelWizard}
      />
      <TocapuStrip />

      {/* Banner de instrucción Serie AX */}
      <View style={[styles.instructionBanner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.instructionBadge}>
          <Text style={[styles.instructionBadgeText, { color: palette.primary }]}>PASO 1B</Text>
        </View>
        <Text style={[styles.instructionText, { color: palette.brand }]} numberOfLines={2}>
          Busca una dirección o toca cualquier punto del mapa para fijar tu partida.
        </Text>
      </View>

      {/* Buscador compacto Serie AX */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchField, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={styles.searchIcon} accessible={false}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: palette.brand }]}
            placeholder="Ej. Parque Kennedy, Miraflores"
            placeholderTextColor={palette.textSecondary}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (searchError) setSearchError('');
            }}
            onSubmitEditing={buscar}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Buscar dirección o punto de partida"
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery('')}
              style={styles.clearBtn}
              accessibilityRole="button"
              accessibilityLabel="Borrar texto de búsqueda"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.clearBtnText, { color: palette.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.searchBtn,
            { backgroundColor: palette.primary, borderColor: palette.brand },
          ]}
          onPress={buscar}
          disabled={searching || !query.trim()}
          accessibilityRole="button"
          accessibilityLabel="Ejecutar búsqueda de dirección"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {searching ? (
            <ActivityIndicator color={palette.surface} size="small" />
          ) : (
            <Text style={[styles.searchBtnText, { color: palette.surface }]}>BUSCAR</Text>
          )}
        </TouchableOpacity>
      </View>

      {searchError ? (
        <View style={[styles.errorContainer, { backgroundColor: 'rgba(125, 41, 53, 0.08)' }]}>
          <Text style={[styles.errorText, { color: palette.burgundy }]}>⚠️ {searchError}</Text>
        </View>
      ) : null}

      {/* Mapa protagonista */}
      <View style={[styles.mapWrap, { borderColor: palette.border }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={LIMA_INICIAL}
          region={region}
          mapType={useOsmTiles ? 'none' : 'standard'}
          loadingEnabled={true}
          loadingIndicatorColor={palette.primary}
          loadingBackgroundColor={palette.background}
          onRegionChangeComplete={onRegionChangeComplete}
          onPress={onMapPress}
        >
          {/* Capa de teselas OpenStreetMap activa cuando se usa el modo raster tile */}
          {useOsmTiles ? (
            <UrlTile
              urlTemplate={OSM_TILE_URL}
              maximumZ={19}
              flipY={false}
              zIndex={1}
            />
          ) : null}

          {pin ? (
            <Marker
              coordinate={{ latitude: pin.lat, longitude: pin.lng }}
              title="Punto de partida"
              description={pinLabel}
              pinColor={palette.primary}
            />
          ) : null}
        </MapView>

        {/* Botón flotante para reenfocar en Lima */}
        <TouchableOpacity
          style={[styles.floatingActionBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={reenfocarLima}
          accessibilityRole="button"
          accessibilityLabel="Reenfocar mapa en Lima Centro"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[styles.floatingActionText, { color: palette.brand }]}>🎯 LIMA</Text>
        </TouchableOpacity>

        {/* Alternador de capa cartográfica */}
        <TouchableOpacity
          style={[styles.layerToggleBtn, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={() => setUseOsmTiles((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Alternar capa cartográfica entre OpenStreetMap y nativo"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[styles.layerToggleText, { color: palette.textSecondary }]}>
            {useOsmTiles ? '🗺 OSM' : '🗺 GOOGLE'}
          </Text>
        </TouchableOpacity>

        {/* Indicador de resolución de dirección */}
        {resolvingAddress ? (
          <View style={[styles.resolvingBadge, { backgroundColor: palette.surface, borderColor: palette.accent }]}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.resolvingBadgeText, { color: palette.brand }]}>Identificando calle...</Text>
          </View>
        ) : null}
      </View>

      {/* Panel inferior Serie AX con la ubicación seleccionada */}
      <View style={styles.selectionPanelWrap}>
        {pin ? (
          <View style={[styles.ticketStub, { backgroundColor: palette.surface, borderColor: palette.primary }]}>
            <View style={styles.ticketHeader}>
              <View style={styles.ticketTagRow}>
                <Text style={[styles.ticketTagText, { color: palette.primary }]}>
                  📍 PUNTO DE PARTIDA
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(212, 175, 55, 0.18)' }]}>
                  <Text style={[styles.statusBadgeText, { color: palette.brand }]}>FIJADO</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={limpiarPin}
                accessibilityRole="button"
                accessibilityLabel="Eliminar punto seleccionado"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.changeLinkText, { color: palette.burgundy }]}>✕ Cambiar</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.ticketPlaceName, { color: palette.brand }]} numberOfLines={2}>
              {pinLabel || 'Ubicación seleccionada en el mapa'}
            </Text>

            <Text style={[styles.ticketCoordinates, { color: palette.textSecondary }]}>
              {coordinatesDisplay}
            </Text>
          </View>
        ) : (
          <View style={[styles.ticketStubEmpty, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.emptyPromptTitle, { color: palette.textSecondary }]}>
              📍 NINGÚN PUNTO SELECCIONADO
            </Text>
            <Text style={[styles.emptyPromptHint, { color: palette.textSecondary }]}>
              Toca el mapa o busca para habilitar la confirmación.
            </Text>
          </View>
        )}
      </View>

      {/* CTA Confirmar Ubicación */}
      <View style={styles.ctaWrap}>
        <WizardButton
          label="CONFIRMAR UBICACIÓN"
          onPress={confirmar}
          disabled={!pin}
        />
      </View>

      {/* Footer con indicador de progreso */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.background,
            paddingBottom: Math.max(insets.bottom, 12) + 4,
          },
        ]}
      >
        <StepIndicator step={1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
    gap: 8,
  },
  instructionBadge: {
    backgroundColor: 'rgba(156, 62, 27, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  instructionBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  instructionText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  searchField: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.mono,
    fontSize: 12,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  searchBtn: {
    minWidth: 76,
    height: 46,
    borderWidth: 1.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  searchBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  errorText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  floatingActionBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  floatingActionText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  layerToggleBtn: {
    position: 'absolute',
    top: 50,
    right: 10,
    borderWidth: 1.2,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  layerToggleText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '600',
  },
  resolvingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  resolvingBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
  },
  selectionPanelWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  ticketStub: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ticketTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketTagText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  changeLinkText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '600',
  },
  ticketPlaceName: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 2,
  },
  ticketCoordinates: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  ticketStubEmpty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPromptTitle: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  emptyPromptHint: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    textAlign: 'center',
  },
  ctaWrap: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});
