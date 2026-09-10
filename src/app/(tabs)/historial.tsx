/**
 * Historial — "Mis Exploraciones" (frame "Historial").
 * Lista de planes completados archivados (PlansContext), boletos Serie AX.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { usePlans } from '@/features/plans/context/plans-context';
import { useTheme } from '@/hooks/use-theme';

export default function HistorialScreen() {
  const theme = useTheme();
  const { historial } = usePlans();

  const stopsWrap: ViewStyle = { gap: 6, marginTop: 8 };

  return (
    <ThemedView style={styles.canvas}>
      {/* Encabezado */}
      <View
        style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.brand }]}>MIS EXPLORACIONES</Text>
        <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
          {historial.length}{' '}
          {historial.length === 1 ? 'boleto validado' : 'boletos validados'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {historial.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyGlyph}>📜</Text>
            <Text style={[styles.emptyTitle, { color: theme.brand }]}>
              Aún no tienes exploraciones
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Los planes que completes aparecerán aquí como boletos validados
            </Text>
          </View>
        ) : (
          historial.map((entry, i) => {
            const fecha = new Date(entry.completado_en).toLocaleDateString('es-PE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            return (
              <View
                key={entry.completado_en}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.brand }]}>
                {/* Perforación lateral (boleto) */}
                <View style={[styles.perf, { backgroundColor: theme.accent }]} />

                <View style={styles.cardHead}>
                  <View>
                    <Text style={[styles.folio, { color: theme.primary }]}>
                      FOLIO · NRO {String(historial.length - i).padStart(6, '0')}
                    </Text>
                    <Text style={[styles.titulo, { color: theme.brand }]} numberOfLines={2}>
                      {entry.titulo}
                    </Text>
                  </View>
                  <View style={[styles.visto, { borderColor: theme.brand }]}>
                    <Text style={[styles.vistoTexto, { color: theme.brand }]}>✓</Text>
                  </View>
                </View>

                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  {fecha} · {entry.paradas.length} {entry.paradas.length === 1 ? 'parada' : 'paradas'} ·{' '}
                  {Math.round((entry.duracion_total_min / 60) * 10) / 10}h ·{' '}
                  {entry.costo_total === 0 ? 'Gratis' : `S/ ${entry.costo_total}`}
                </Text>

                {/* Paradas */}
                <View style={stopsWrap}>
                  {entry.paradas.map((s) => (
                    <View key={s.orden} style={styles.paradaRow}>
                      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                      <Text style={[styles.paradaNombre, { color: theme.brand }]} numberOfLines={1}>
                        {s.place.nombre}
                      </Text>
                      <Text style={[styles.paradaHora, { color: theme.textSecondary }]}>
                        {s.llegada}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  header: {
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 20,
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    marginTop: 2,
  },
  scroll: { padding: 20, paddingBottom: 120, gap: 14 },

  empty: { alignItems: 'center', gap: 8, paddingTop: 80 },
  emptyGlyph: { fontSize: 36 },
  emptyTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
  },
  emptyText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  card: {
    borderRadius: 4,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 14,
  },
  perf: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  folio: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
  },
  titulo: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 14,
    marginTop: 2,
    flexShrink: 1,
  },
  visto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vistoTexto: { fontSize: 13, fontWeight: '700' },
  meta: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    marginTop: 6,
  },
  paradaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  paradaNombre: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 12,
    flex: 1,
  },
  paradaHora: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 9,
  },
});
