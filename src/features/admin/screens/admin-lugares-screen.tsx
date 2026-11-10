/**
 * Gestión de fotografías de los destinos (Panel de Intendencia, Unidad 3).
 *
 * Cada destino puede tener una foto de portada. Al reemplazarla, el servidor
 * marca la anterior para borrarla del bucket; el botón de limpieza purga esos
 * archivos huérfanos. La pantalla no toca Storage directamente: todo pasa por
 * places-storage.service.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useAdminPlaces } from '../hooks/use-admin-places';
import type { Place } from '@/features/places/interface/places.interface';

const palette = Colors.light;

interface PhotoSource {
  uri: string;
  base64?: string | null;
}

export function AdminLugaresScreen() {
  const insets = useSafeAreaInsets();
  const { places, loading, error, uploadPhoto, removePhoto, runCleanup } = useAdminPlaces();

  const [busqueda, setBusqueda] = useState('');
  const [lugarEnCurso, setLugarEnCurso] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) {
      return places;
    }
    return places.filter((place) => place.nombre.toLowerCase().includes(termino));
  }, [busqueda, places]);

  const subirFoto = useCallback(
    async (place: Place, foto: PhotoSource) => {
      setLugarEnCurso(place.id);
      setAviso(null);

      const resultado = await uploadPhoto({
        place,
        localUri: foto.uri,
        base64: foto.base64,
        asCover: true,
      });

      setLugarEnCurso(null);
      setAviso(
        resultado.success
          ? `Portada de ${place.nombre} actualizada.`
          : resultado.error ?? 'No se pudo actualizar la portada.',
      );
    },
    [uploadPhoto],
  );

  const tomarFoto = useCallback(
    async (place: Place) => {
      try {
        const permiso = await ImagePicker.requestCameraPermissionsAsync();
        if (!permiso.granted) {
          setAviso('Sin permiso de cámara. Puedes elegir una foto de la galería.');
          return;
        }

        const resultado = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
          base64: true,
        });

        if (resultado.canceled || !resultado.assets[0]) {
          return;
        }

        await subirFoto(place, resultado.assets[0]);
      } catch {
        setAviso('No se pudo abrir la cámara.');
      }
    },
    [subirFoto],
  );

  const elegirDeGaleria = useCallback(
    async (place: Place) => {
      try {
        const resultado = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
          base64: true,
        });

        if (resultado.canceled || !resultado.assets[0]) {
          return;
        }

        await subirFoto(place, resultado.assets[0]);
      } catch {
        setAviso('No se pudo abrir la galería.');
      }
    },
    [subirFoto],
  );

  const quitarPortada = useCallback(
    (place: Place) => {
      Alert.alert(
        'Quitar fotografía',
        `La portada de ${place.nombre} se borrará del bucket y del catálogo.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Quitar',
            style: 'destructive',
            onPress: async () => {
              setLugarEnCurso(place.id);
              setAviso(null);
              const resultado = await removePhoto(place);
              setLugarEnCurso(null);
              setAviso(
                resultado.success
                  ? `Portada de ${place.nombre} eliminada.`
                  : resultado.error ?? 'No se pudo eliminar la portada.',
              );
            },
          },
        ],
      );
    },
    [removePhoto],
  );

  const limpiarPendientes = useCallback(async () => {
    setAviso(null);
    const resultado = await runCleanup();

    if (resultado.errors.length > 0) {
      setAviso(`Limpieza con avisos: ${resultado.errors[0]}`);
      return;
    }

    setAviso(
      resultado.processedCount === 0
        ? 'No había archivos pendientes de limpieza.'
        : `Se limpiaron ${resultado.processedCount} archivo(s) del bucket.`,
    );
  }, [runCleanup]);

  const renderLugar = ({ item }: { item: Place }) => {
    const ocupado = lugarEnCurso === item.id;
    const portada = item.imagenes?.find((imagen) => imagen.es_portada) ?? null;

    return (
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.thumb, { backgroundColor: palette.backgroundElement }]}>
          {portada ? (
            <Image
              source={{ uri: portada.url }}
              style={styles.thumbImage}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <Text style={[styles.thumbGlyph, { color: palette.textSecondary }]}>📷</Text>
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: palette.brand }]} numberOfLines={1}>
            {item.nombre}
          </Text>
          <Text style={[styles.cardHint, { color: palette.textSecondary }]}>
            {portada ? 'Portada asignada' : 'Sin portada'}
          </Text>

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { borderColor: palette.primary }]}
              onPress={() => void tomarFoto(item)}
              disabled={ocupado}
              accessibilityRole="button"
              accessibilityLabel={`Tomar foto de ${item.nombre}`}
            >
              <Text style={[styles.actionText, { color: palette.primary }]}>TOMAR FOTO</Text>
            </Pressable>

            <Pressable
              style={[styles.actionButton, { borderColor: palette.primary }]}
              onPress={() => void elegirDeGaleria(item)}
              disabled={ocupado}
              accessibilityRole="button"
              accessibilityLabel={`Elegir foto de galería para ${item.nombre}`}
            >
              <Text style={[styles.actionText, { color: palette.primary }]}>GALERÍA</Text>
            </Pressable>

            {portada ? (
              <Pressable
                style={[styles.actionButton, { borderColor: palette.carmine }]}
                onPress={() => quitarPortada(item)}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel={`Quitar portada de ${item.nombre}`}
              >
                <Text style={[styles.actionText, { color: palette.carmine }]}>QUITAR</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {ocupado ? (
          <View style={styles.busy}>
            <ActivityIndicator color={palette.primary} />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Volver al panel"
        >
          <Text style={[styles.backText, { color: palette.textSecondary }]}>← VOLVER</Text>
        </Pressable>

        <Text style={[styles.title, { color: palette.brand }]}>FOTOGRAFÍAS DE DESTINOS</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Al reemplazar una portada, la anterior queda marcada y se borra del bucket con la limpieza.
        </Text>

        <Pressable
          style={[styles.cleanupButton, { borderColor: palette.border }]}
          onPress={() => void limpiarPendientes()}
          accessibilityRole="button"
          accessibilityLabel="Limpiar archivos pendientes del bucket"
        >
          <Text style={[styles.cleanupText, { color: palette.textSecondary }]}>
            LIMPIAR ARCHIVOS PENDIENTES
          </Text>
        </Pressable>
      </View>

      <TextInput
        style={[
          styles.search,
          { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface },
        ]}
        placeholder="Buscar destino"
        placeholderTextColor={palette.textSecondary}
        value={busqueda}
        onChangeText={setBusqueda}
        returnKeyType="search"
      />

      {aviso ? (
        <Text style={[styles.notice, { color: palette.primary }]}>{aviso}</Text>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
          <Text style={[styles.centerText, { color: palette.textSecondary }]}>
            Cargando catálogo
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.centerText, { color: palette.carmine }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(item) => item.id}
          renderItem={renderLugar}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
          ListEmptyComponent={
            <Text style={[styles.centerText, { color: palette.textSecondary }]}>
              No hay destinos que coincidan con la búsqueda.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 6,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 20,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    lineHeight: 16,
  },
  cleanupButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 4,
  },
  cleanupText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    letterSpacing: 0.8,
  },
  search: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 6,
    fontFamily: Fonts.sans,
    fontSize: 13,
  },
  notice: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    marginHorizontal: 20,
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbGlyph: {
    fontSize: 22,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: Fonts.display,
    fontSize: 14,
  },
  cardHint: {
    fontFamily: Fonts.sans,
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 4,
  },
  actionText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  busy: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  centerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    textAlign: 'center',
  },
});
