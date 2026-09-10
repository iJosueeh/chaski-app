/**
 * Pantalla Home — "Boleto de Experiencias" (Serie AX).
 * Reproduce el frame "Inicio (Refinado)" del Figma oficial:
 * top bar con marca, saludo, CTA CREAR MI PLAN, chips rápidos,
 * secciones PLAN ACTIVO y PLANES RECIENTES con estados vacíos.
 */
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/context/auth-context';
import { signOut } from '@/features/auth/services/auth.service';
import { usePlans } from '@/features/plans/context/plans-context';
import { useTheme } from '@/hooks/use-theme';

/** Chips de duración rápida (del Figma: Quick Access Chips). */
const CHIPS = ['2 HORAS', '4 HORAS', 'LA TARDE'] as const;

/** Órdenes visitados, ordenados asc (índice de la próxima parada = length). */
function visitadasOrdenadas(list: number[]): number[] {
  return [...list].sort((a, b) => a - b);
}

export default function HomeScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { planActivo, visitadas: visitadasRaw, historial } = usePlans();
  const [selectedChip, setSelectedChip] = useState<string | null>(null);

  const initial = user?.email?.[0]?.toUpperCase() ?? 'A';

  const goCrearPlan = () => router.push('/wizard/ubicacion');

  /** Progreso del plan activo: paradas visitadas / total. */
  const visitadas = planActivo ? visitadasOrdenadas(visitadasRaw) : [];
  const paradaActual = planActivo ? Math.min(visitadas.length + 1, planActivo.paradas.length) : 0;
  const pctActivo = planActivo
    ? Math.round((visitadas.length / planActivo.paradas.length) * 100)
    : 0;
  const siguienteParada = planActivo?.paradas[visitadas.length] ?? null;

  return (
    <ThemedView style={styles.canvas}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.one,
            paddingLeft: insets.left + Spacing.four,
            paddingRight: insets.right + Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.six,
          },
        ]}>
        {/* ── Top App Bar ─────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            style={styles.menuBtn}>
            <Text style={[styles.menuGlyph, { color: theme.brand }]}>☰</Text>
          </TouchableOpacity>

          <View style={styles.brandBlock}>
            <Text style={[styles.brand, { color: theme.brand }]}>CHASKI</Text>
            <Text style={[styles.brandSub, { color: theme.primary }]}>
              BOLETO DE EXPERIENCIAS
            </Text>
          </View>

          <View style={[styles.avatar, { borderColor: theme.brand }]}>
            <Text style={[styles.avatarInitial, { color: theme.brand }]}>
              {initial}
            </Text>
          </View>
        </View>

        {/* ── Greeting ────────────────────────────────────────────── */}
        <View style={styles.greeting}>
          <Text style={[styles.kicker, { color: theme.primary }]}>
            HOLA, EXPLORADOR
          </Text>
          <Text style={[styles.greetingTitle, { color: theme.text }]}>
            ¿Qué hacemos hoy?
          </Text>
        </View>

        {/* ── CTA principal + chips ───────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: theme.carmine, borderColor: theme.brand },
          ]}
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={goCrearPlan}>
          <View
            style={[
              styles.primaryBtnInner,
              { borderColor: 'rgba(255,253,249,0.2)' },
            ]}
          />
          <Text style={[styles.primaryBtnText, { color: theme.surface }]}>
            CREAR MI PLAN
          </Text>
        </TouchableOpacity>

        <View style={styles.chipsRow}>
          <Text style={[styles.chipLabel, { color: theme.primary }]}>
            SELECCIONAR:
          </Text>
          {CHIPS.map((chip) => {
            const active = selectedChip === chip;
            return (
              <TouchableOpacity
                key={chip}
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedChip(chip);
                  goCrearPlan();
                }}>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.brand : theme.surface,
                      borderColor: theme.brand,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? theme.surface : theme.brand },
                    ]}>
                    {chip}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Divider dorado ──────────────────────────────────────── */}
        <View style={[styles.divider, { backgroundColor: theme.accent }]} />

        {/* ── PLAN ACTIVO ─────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.brand }]}>
            PLAN ACTIVO
          </Text>
          {planActivo ? (
            <Text style={[styles.sectionTag, { color: theme.primary }]}>
              EN CURSO
            </Text>
          ) : null}
        </View>

        {planActivo ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/plan/activo')}>
            <View
              style={[
                styles.planCard,
                { backgroundColor: theme.surface, borderColor: theme.brand },
              ]}>
              <View
                style={[styles.planCardAccent, { backgroundColor: theme.accent }]}
              />
              <View style={styles.planCardHeader}>
                <View style={styles.planCardInfo}>
                  <Text style={[styles.planCardKicker, { color: theme.primary }]}>
                    EN PROGRESO
                  </Text>
                  <Text style={[styles.planCardTitle, { color: theme.brand }]} numberOfLines={2}>
                    {planActivo.titulo}
                  </Text>
                </View>
                <View
                  style={[styles.planCardBadge, { backgroundColor: theme.background, borderColor: theme.brand }]}>
                  <Text style={[styles.planCardBadgeText, { color: theme.brand }]}>
                    {planActivo.paradas.length} paradas
                  </Text>
                </View>
              </View>

              {/* Progreso */}
              <View style={styles.planProgress}>
                <View style={styles.planProgressRow}>
                  <Text style={[styles.planProgressLabel, { color: theme.brand }]}>
                    Parada {paradaActual} de {planActivo.paradas.length}
                  </Text>
                  <Text style={[styles.planProgressPct, { color: theme.carmine }]}>
                    {pctActivo}%
                  </Text>
                </View>
                <View
                  style={[styles.planProgressTrack, { borderColor: theme.brand, backgroundColor: theme.background }]}>
                  <View
                    style={[
                      styles.planProgressFill,
                      { backgroundColor: theme.carmine, width: `${pctActivo}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Siguiente destino */}
              {siguienteParada ? (
                <View style={[styles.planNext, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <View style={[styles.planNextIcon, { backgroundColor: theme.accent }]} />
                  <View style={styles.planNextInfo}>
                    <Text style={[styles.planNextKicker, { color: theme.primary }]}>
                      SIGUIENTE DESTINO
                    </Text>
                    <Text style={[styles.planNextNombre, { color: theme.brand }]} numberOfLines={1}>
                      {siguienteParada.place.nombre}
                    </Text>
                  </View>
                  <Text style={[styles.planNextArrow, { color: theme.primary }]}>→</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ) : (
          <View
            style={[
              styles.emptyCard,
              { borderColor: 'rgba(74,46,24,0.25)' },
            ]}>
            <Text style={styles.emptyGlyph}>🎫</Text>
            <Text style={[styles.emptyTitle, { color: theme.brand }]}>
              Aún no tienes planes
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Crea tu primer plan de experiencias
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={goCrearPlan}>
              <Text style={[styles.emptyLink, { color: theme.primary }]}>
                CREAR MI PLAN
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Divider dorado ──────────────────────────────────────── */}
        <View style={[styles.divider, { backgroundColor: theme.accent }]} />

        {/* ── PLANES RECIENTES ────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.brand }]}>
            PLANES RECIENTES
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/historial')}>
            <Text style={[styles.seeAll, { color: theme.primary }]}>
              VER TODOS
            </Text>
          </TouchableOpacity>
        </View>

        {historial.length > 0 ? (
          <View style={styles.recentWrap}>
            {historial.slice(0, 2).map((entry) => {
              const fecha = new Date(entry.completado_en).toLocaleDateString('es-PE', {
                day: '2-digit', month: 'short', year: 'numeric',
              });
              const folio = historial.length - historial.indexOf(entry);
              const n = entry.paradas.length;
              return (
                <TouchableOpacity
                  key={entry.completado_en}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)/historial')}>
                  <View
                    style={[
                      styles.recentCard,
                      { backgroundColor: theme.surface, borderColor: theme.brand },
                    ]}>
                    <View style={[styles.recentAccent, { backgroundColor: theme.accent }]} />
                    <View style={styles.recentHead}>
                      <View style={styles.recentInfo}>
                        <Text style={[styles.recentFolio, { color: theme.primary }]}>
                          FOLIO · NRO {String(folio).padStart(6, '0')}
                        </Text>
                        <Text style={[styles.recentTitle, { color: theme.brand }]} numberOfLines={1}>
                          {entry.titulo}
                        </Text>
                      </View>
                      <View style={[styles.recentVisto, { borderColor: theme.brand }]}>
                        <Text style={[styles.recentVistoMark, { color: theme.brand }]}>✓</Text>
                      </View>
                    </View>
                    <Text style={[styles.recentMeta, { color: theme.textSecondary }]}>
                      {fecha} · {n} {n === 1 ? 'parada' : 'paradas'} ·{' '}
                      {Math.round((entry.duracion_total_min / 60) * 10) / 10}h ·{' '}
                      {entry.costo_total === 0 ? 'Gratis' : `S/ ${entry.costo_total}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View
            style={[
              styles.emptyCard,
              { borderColor: 'rgba(74,46,24,0.25)' },
            ]}>
            <Text style={styles.emptyGlyph}>📜</Text>
            <Text style={[styles.emptyTitle, { color: theme.brand }]}>
              Sin exploraciones todavía
            </Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Tus planes completados aparecerán aquí como boletos
            </Text>
          </View>
        )}

        {/* ── Divider + talonario (logout) ────────────────────────── */}
        <View style={[styles.divider, { backgroundColor: theme.accent }]} />
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.7}
          style={styles.logout}
          onPress={() => signOut()}>
          <Text style={[styles.logoutText, { color: theme.textSecondary }]}>
            SALIR DEL BOLETO
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {},

  /* Top App Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  menuBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  menuGlyph: { fontSize: 22, lineHeight: 26 },
  brandBlock: { alignItems: 'center' },
  brand: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 18,
    letterSpacing: 1,
  },
  brandSub: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 8,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  avatarInitial: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 18,
  },

  /* Greeting */
  greeting: { marginTop: 16 },
  kicker: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
  },
  greetingTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 28,
    lineHeight: 38,
  },

  /* CTA primario */
  primaryBtn: {
    marginTop: 24,
    height: 56,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryBtnInner: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    right: 2,
    borderRadius: 2,
    borderWidth: 1,
  },
  primaryBtnText: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 17,
    letterSpacing: 1,
  },

  /* Chips */
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  chipLabel: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 8,
    letterSpacing: 1,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.5,
  },

  /* Divider */
  divider: {
    height: 1.5,
    opacity: 0.6,
    marginVertical: 24,
  },

  /* Headers de sección */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
  },
  sectionTag: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 9,
    letterSpacing: 1,
  },
  seeAll: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.5,
  },

  /* Estados vacíos */
  emptyCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 4,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  emptyGlyph: { fontSize: 24, marginBottom: 2 },
  emptyTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 14,
  },
  emptyText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    textAlign: 'center',
  },
  emptyLink: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 8,
  },

  /* Logout */
  logout: { alignItems: 'center', paddingVertical: 8 },
  logoutText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 9,
    letterSpacing: 2,
  },

  /* Tarjeta del plan activo (Home) */
  planCard: {
    borderRadius: 4,
    borderWidth: 2,
    overflow: 'hidden',
    padding: 16,
  },
  planCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    paddingLeft: 6,
  },
  planCardInfo: { flex: 1 },
  planCardKicker: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
  },
  planCardTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 2,
  },
  planCardBadge: {
    borderWidth: 1.5,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  planCardBadgeText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
  },
  planProgress: { marginTop: 14, paddingLeft: 6 },
  planProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  planProgressLabel: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
  },
  planProgressPct: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 12,
  },
  planProgressTrack: {
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  planProgressFill: { height: '100%' },
  planNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginLeft: 6,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
  },
  planNextIcon: { width: 10, height: 10, borderRadius: 5 },
  planNextInfo: { flex: 1 },
  planNextKicker: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 8,
    letterSpacing: 1.5,
  },
  planNextNombre: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 13,
    marginTop: 2,
  },
  planNextArrow: { fontSize: 18, fontWeight: '700' },

  /* Boletos de PLANES RECIENTES (Home) */
  recentWrap: { gap: 10 },
  recentCard: {
    borderRadius: 4,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 14,
  },
  recentAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  recentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    paddingLeft: 6,
  },
  recentInfo: { flex: 1 },
  recentFolio: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 8,
    letterSpacing: 2,
  },
  recentTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 14,
    marginTop: 2,
  },
  recentVisto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentVistoMark: { fontSize: 11, fontWeight: '700' },
  recentMeta: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    marginTop: 6,
    paddingLeft: 6,
  },
});
