/**
 * Historial — "Mis Exploraciones" (Serie AX).
 *
 * Archivo de boletos culturales validados:
 * - Paleta clara Serie AX: pergamino (#FAF5EE), marfil (#FFFDF9), tinta (#4A2E18),
 *   terracota (#9C3E1B), borgoña (#7D2935) y dorado ocre (#D4AF37).
 * - Título «MIS EXPLORACIONES» con contador dinámico de boletos validados.
 * - TocapuStrip andino ornamental en el encabezado.
 * - Cada expedición se presenta como un boleto cultural con folio estable, perforaciones,
 *   sello «✓ SELLADO», métricas de tiempo y gasto referencial, y desglose de paradas.
 * - Estados cuidados de carga (spinner terracota) y vacío con mensaje natural y CTA accesible
 *   hacia «TRAZAR MI PRIMERA RUTA».
 * - Padding inferior con BottomTabInset para evitar solapamientos con la barra de navegación.
 */
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { AndeanTransitStamp } from '@/features/auth/components/andean-transit-stamp';
import { HistorialTicketCard } from '@/features/plans/components/historial-ticket-card';
import { useHistorialSolicitudes } from '@/features/plans/hooks';
import { formatValidatedCountLabel } from '@/features/plans/utils/historial-formatters';
import { TocapuStrip } from '@/features/wizard/components/wizard-ui';

const palette = Colors.light;

export default function HistorialScreen() {
  const insets = useSafeAreaInsets();
  const { solicitudes, loading } = useHistorialSolicitudes();

  const goCrearRuta = () => {
    router.push('/wizard/ubicacion');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      {/* Encabezado fijo con SafeArea superior */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16) + 12,
            backgroundColor: palette.surface,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <View style={styles.headerKickerRow}>
          <View style={[styles.kickerBadge, { backgroundColor: palette.accent }]}>
            <Text style={[styles.kickerBadgeText, { color: palette.brand }]}>
              ARCHIVO HISTÓRICO
            </Text>
          </View>
          <Text style={[styles.seriesText, { color: palette.burgundy }]}>
            SERIE AX
          </Text>
        </View>

        <Text style={[styles.headerTitle, { color: palette.brand }]}>
          MIS EXPLORACIONES
        </Text>

        <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
          {formatValidatedCountLabel(solicitudes.length)}
        </Text>
      </View>

      {/* Cenefa decorativa andina */}
      <TocapuStrip />

      {/* Cuerpo principal desplazable */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: 16,
          },
        ]}
        showsVerticalScrollIndicator={true}
      >
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
              Consultando archivo de expediciones...
            </Text>
          </View>
        ) : solicitudes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyTicketCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={[styles.emptyAccentBar, { backgroundColor: palette.accent }]} />
              <View style={styles.emptyContent}>
                <View style={[styles.emptyIconCircle, { borderColor: palette.primary, backgroundColor: palette.backgroundElement }]}>
                  <Text style={styles.emptyGlyph}>📜</Text>
                </View>

                <Text style={[styles.emptyTitle, { color: palette.brand }]}>
                  Aún no tienes expediciones archivadas
                </Text>

                <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
                  Cada recorrido que inicies y finalices quedará sellado en este archivo como un boleto cultural permanente con su folio, estaciones y registros.
                </Text>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Trazar mi primera ruta y empezar a explorar"
                  activeOpacity={0.85}
                  onPress={goCrearRuta}
                  style={[
                    styles.emptyCtaButton,
                    {
                      backgroundColor: palette.primary,
                      borderColor: palette.brand,
                    },
                  ]}
                >
                  <Text style={[styles.emptyCtaText, { color: palette.surface }]}>
                    TRAZAR MI PRIMERA RUTA
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.listHeaderRow}>
              <Text style={[styles.listKicker, { color: palette.textSecondary }]}>
                REGISTRO CRONOLÓGICO DE EXPEDICIONES
              </Text>
            </View>

            {solicitudes.map((entry, i) => {
              // Secuencia de archivo: la solicitud más reciente tiene el número más alto
              const indexFromEnd = solicitudes.length - i;

              return (
                <HistorialTicketCard
                  key={entry.id}
                  entry={entry}
                  indexFromEnd={indexFromEnd}
                />
              );
            })}

            {/* Sello de cierre de archivo al final del listado */}
            <View style={styles.stampFooterWrapper}>
              <AndeanTransitStamp
                compact={true}
                folio="SERIE AX · CONTROL DE ARCHIVO"
                station="ARCHIVO PATRIMONIAL CHASKI"
                route="EXPEDICIONES VALIDADAS · LIMA"
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  header: {
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  kickerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  kickerBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  seriesText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerSub: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    marginTop: 3,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: 16,
    gap: 16,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 16,
  },
  loadingText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyTicketCard: {
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  emptyAccentBar: {
    height: 4,
    width: '100%',
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyGlyph: {
    fontSize: 28,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  emptyCtaButton: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  emptyCtaText: {
    fontFamily: Fonts.serif,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  listKicker: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  stampFooterWrapper: {
    marginTop: 'auto',
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
});
