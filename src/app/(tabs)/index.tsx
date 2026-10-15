/**
 * Pantalla de Inicio — "Boleto de Experiencias" (Serie AX).
 *
 * Paleta Serie AX clara:
 * - Pergamino: #FAF5EE (lienzo principal)
 * - Marfil: #FFFDF9 (superficies y tarjetas de boleto)
 * - Tinta: #4A2E18 (marca, títulos, textos principales)
 * - Terracota: #9C3E1B (acciones primarias y CTA)
 * - Borgoña: #7D2935 (series, folios y tags)
 * - Dorado ocre: #D4AF37 (sellos y acentos)
 *
 * Estructura de cinco bloques con identidad incaica y estética de boleto:
 * 1. Encabezado CHASKI (marca, folio Serie AX, avatar de usuario y perfil).
 * 2. Boleto principal «Trazar mi ruta» (elemento protagonista con perforaciones y CTA).
 * 3. Afinidades del usuario (categorías y presupuesto reales desde PreferencesContext).
 * 4. Plan activo (condicional: solo si existe un plan en curso).
 * 5. Destinos patrimoniales destacados (obtenidos en tiempo real vía usePlaces).
 * 6. Sello cultural de tránsito compacto (AndeanTransitStamp).
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { formatBudgetRange } from '@/shared/utils/format-currency';
import { useAuth } from '@/features/auth/context/auth-context';
import { usePreferences } from '@/features/preferences/context/preferences-context';
import { usePlans } from '@/features/plans/context/plans-context';
import { usePlaces } from '@/features/places/hooks';
import { AndeanTransitStamp } from '@/features/auth/components/andean-transit-stamp';
import { AndeanTocapuDivider } from '@/components/andean-tocapu-divider';

/** Tokens de la paleta Serie AX clara para la experiencia de boleto */
const palette = Colors.light;

/** Chips de ritmo de exploración rápida */
const QUICK_CHIPS = ['2 HORAS', '4 HORAS', 'LA TARDE'] as const;

export default function HomeScreen() {
  const { user } = useAuth();
  const { userPreferences } = usePreferences();
  const insets = useSafeAreaInsets();
  const { planActivo, visitadas: visitadasRaw, loading: plansLoading } = usePlans();

  const [selectedChip, setSelectedChip] = useState<string | null>(null);

  // Destinos patrimoniales reales (ciclo de vida encapsulado en usePlaces)
  const { places: activePlaces, loading: loadingPlaces, errorKind: placesErrorKind } = usePlaces();
  const featuredPlaces = useMemo(() => activePlaces.slice(0, 3), [activePlaces]);
  // El copy de error es presentación de esta pantalla.
  const placesError =
    placesErrorKind === 'service'
      ? 'No se pudo cargar el catálogo patrimonial.'
      : placesErrorKind === 'network'
        ? 'Error de conexión al obtener destinos.'
        : null;

  const goCrearPlan = () => router.push('/wizard/ubicacion');

  // Identidad y saludo del pasajero
  const userName = (user?.user_metadata?.nombre as string | undefined)?.trim();
  const greetingName = userName ? userName.toUpperCase() : 'EXPLORADOR';
  const initial = (userName ? userName[0] : (user?.email?.[0] ?? 'A')).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  const [avatarImageError, setAvatarImageError] = useState(false);

  // Categorías y presupuesto reales del usuario
  const userCategories = useMemo(
    () => userPreferences?.categorias ?? [],
    [userPreferences?.categorias],
  );
  const budgetLabel = formatBudgetRange(userPreferences?.gasto_min, userPreferences?.gasto_max);

  // Progreso del plan activo (si existe)
  const visitadas = planActivo ? [...visitadasRaw].sort((a, b) => a - b) : [];
  const totalParadas = planActivo?.paradas?.length ?? 0;
  const paradaActual = planActivo ? Math.min(visitadas.length + 1, totalParadas) : 0;
  const pctActivo = totalParadas > 0 ? Math.round((visitadas.length / totalParadas) * 100) : 0;
  const siguienteParada = planActivo?.paradas?.[visitadas.length] ?? null;

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 16) + Spacing.one,
            paddingLeft: insets.left + Spacing.four,
            paddingRight: insets.right + Spacing.four,
            paddingBottom: 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================= */}
        {/* BLOQUE 1: ENCABEZADO CHASKI                               */}
        {/* ========================================================= */}
        <View style={styles.topBar}>
          <View style={styles.brandContainer}>
            <View style={styles.folioBadge}>
              <Text style={styles.folioBadgeText}>SERIE AX-01 · LIMA</Text>
            </View>
            <Text style={[styles.brandTitle, { color: palette.brand }]}>CHASKI</Text>
            <Text style={[styles.brandSubtitle, { color: palette.primary }]}>
              BOLETO DE EXPERIENCIAS PATRIMONIALES
            </Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil y preferencias"
            accessibilityHint="Accede a la gestión de tu boleto y cuenta"
            activeOpacity={0.75}
            onPress={() => router.push('/(tabs)/perfil')}
            style={styles.avatarButton}
          >
            <View style={[styles.avatarFrame, { borderColor: palette.brand, backgroundColor: palette.backgroundElement }]}>
              {avatarUrl && !avatarImageError ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarThumbnail}
                  contentFit="cover"
                  transition={200}
                  onError={() => setAvatarImageError(true)}
                />
              ) : (
                <Text style={[styles.avatarInitial, { color: palette.brand }]}>{initial}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Saludo editorial de bienvenida */}
        <View style={styles.greetingSection}>
          <Text style={[styles.greetingKicker, { color: palette.primary }]}>
            PASAJERO CULTURAL · ESTACIÓN CENTRAL
          </Text>
          <Text style={[styles.greetingTitle, { color: palette.text }]}>
            HOLA, {greetingName}
          </Text>
          <Text style={[styles.greetingSub, { color: palette.textSecondary }]}>
            {planActivo
              ? 'Tienes una expedición en curso por Lima. Revisa tu progreso y continúa a la siguiente estación.'
              : 'Tu boleto está listo para iniciar una nueva expedición por Lima.'}
          </Text>

          {planActivo ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Expedición activa: ${planActivo.titulo}. Toca para ver el recorrido.`}
              activeOpacity={0.8}
              onPress={() => router.push('/plan/activo')}
              style={[
                styles.activeExpeditionBanner,
                { backgroundColor: palette.surface, borderColor: palette.burgundy },
              ]}
            >
              <View style={[styles.activeExpeditionBannerDot, { backgroundColor: palette.burgundy }]} />
              <View style={styles.activeExpeditionBannerInfo}>
                <Text style={[styles.activeExpeditionBannerKicker, { color: palette.burgundy }]}>
                  EN CURSO · PARADA {paradaActual} DE {totalParadas} ({pctActivo}%)
                </Text>
                <Text style={[styles.activeExpeditionBannerTitle, { color: palette.brand }]} numberOfLines={1}>
                  {planActivo.titulo}
                </Text>
              </View>
              <Text style={[styles.activeExpeditionBannerCta, { color: palette.primary }]}>
                VER RUTA →
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ========================================================= */}
        {/* BLOQUE 2: BOLETO PRINCIPAL «TRAZAR MI RUTA» (PROTAGONISTA) */}
        {/* ========================================================= */}
        <View style={styles.ticketCardWrapper}>
          <View style={[styles.ticketCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {/* Cabecera del boleto */}
            <View style={styles.ticketHeader}>
              <View style={[styles.ticketSeriesBadge, { backgroundColor: palette.accent }]}>
                <Text style={[styles.ticketSeriesText, { color: palette.brand }]}>EXPEDICIÓN · SERIE AX</Text>
              </View>
              <Text style={[styles.ticketFolioText, { color: palette.textSecondary }]}>FOLIO N° 00482</Text>
            </View>

            <Text style={[styles.ticketTitle, { color: palette.brand }]}>
              TRAZAR MI RUTA
            </Text>
            <Text style={[styles.ticketDescription, { color: palette.textSecondary }]}>
              Genera un recorrido patrimonial personalizado según tu tiempo, ritmo y preferencias.
            </Text>

            {/* Metadatos de viaje del boleto */}
            <View style={[styles.ticketMetaRow, { backgroundColor: palette.backgroundElement }]}>
              <View style={styles.ticketMetaItem}>
                <Text style={[styles.ticketMetaLabel, { color: palette.textSecondary }]}>ORIGEN</Text>
                <Text style={[styles.ticketMetaValue, { color: palette.brand }]}>
                  Lima Histórica
                </Text>
              </View>
              <View style={[styles.ticketMetaDivider, { backgroundColor: palette.border }]} />
              <View style={styles.ticketMetaItem}>
                <Text style={[styles.ticketMetaLabel, { color: palette.textSecondary }]}>MODALIDAD</Text>
                <Text style={[styles.ticketMetaValue, { color: palette.brand }]}>
                  A tu propio ritmo
                </Text>
              </View>
            </View>

            {/* Perforación de boleto */}
            <View style={styles.perforationWrapper} accessible={false}>
              <View style={[styles.notchLeft, { backgroundColor: palette.background }]} />
              <View style={[styles.perforationLine, { borderColor: palette.border }]} />
              <View style={[styles.notchRight, { backgroundColor: palette.background }]} />
            </View>

            {/* Chips de duración rápida */}
            <View style={styles.quickAccessRow}>
              <Text style={[styles.quickAccessLabel, { color: palette.textSecondary }]}>RITMO ESTIMADO:</Text>
              <View style={styles.chipsContainer}>
                {QUICK_CHIPS.map((chip) => {
                  const active = selectedChip === chip;
                  return (
                    <TouchableOpacity
                      key={chip}
                      accessibilityRole="button"
                      accessibilityLabel={`Seleccionar duración ${chip}`}
                      activeOpacity={0.8}
                      onPress={() => {
                        setSelectedChip(chip);
                        goCrearPlan();
                      }}
                      style={[
                        styles.quickChip,
                        {
                          backgroundColor: active ? palette.brand : palette.surface,
                          borderColor: active ? palette.brand : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          { color: active ? palette.surface : palette.brand },
                        ]}
                      >
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* CTA principal de emisión */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Empezar expedición y trazar mi ruta"
              activeOpacity={0.85}
              onPress={goCrearPlan}
              style={[
                styles.ticketCtaButton,
                { backgroundColor: palette.primary, borderColor: palette.brand },
              ]}
            >
              <View style={styles.ticketCtaInnerBorder} />
              <Text style={[styles.ticketCtaText, { color: palette.surface }]}>TRAZAR MI RUTA AHORA</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Separador Andino Tocapu */}
        <AndeanTocapuDivider />

        {/* ========================================================= */}
        {/* BLOQUE 3: AFINIDADES DEL USUARIO (PREFERENCIAS REALES)    */}
        {/* ========================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleBlock}>
            <Text style={[styles.sectionKicker, { color: palette.primary }]}>CONTROL DE PERFIL</Text>
            <Text style={[styles.sectionTitle, { color: palette.brand }]}>
              TUS AFINIDADES DE RUTA
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Modificar preferencias en perfil"
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/perfil')}
          >
            <Text style={[styles.sectionActionText, { color: palette.primary }]}>
              MODIFICAR
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.affinitiesCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {/* Categorías reales seleccionadas */}
          <Text style={[styles.affinitiesLabel, { color: palette.textSecondary }]}>INTERESES CULTURALES SELECCIONADOS</Text>
          {userCategories.length > 0 ? (
            <View style={styles.affinitiesChipsGrid}>
              {userCategories.map((cat) => (
                <View
                  key={cat.id}
                  style={[
                    styles.affinityChip,
                    { backgroundColor: palette.backgroundElement, borderColor: palette.border },
                  ]}
                >
                  <View style={[styles.affinityChipDot, { backgroundColor: palette.accent }]} />
                  <Text style={[styles.affinityChipText, { color: palette.brand }]}>
                    {cat.nombre}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.affinitiesEmptyText, { color: palette.textSecondary }]}>
              Aún no has seleccionado afinidades culturales.
            </Text>
          )}

          {/* Presupuesto configurado */}
          <View style={[styles.affinitiesBudgetRow, { borderTopColor: palette.border }]}>
            <View>
              <Text style={[styles.affinitiesLabel, { color: palette.textSecondary }]}>PRESUPUESTO POR SALIDA</Text>
              <Text style={[styles.affinitiesBudgetValue, { color: palette.brand }]}>
                {budgetLabel}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Editar presupuesto"
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/perfil')}
              style={styles.adjustBudgetBtn}
            >
              <Text style={[styles.adjustBudgetText, { color: palette.primary }]}>
                Ajustar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ========================================================= */}
        {/* BLOQUE 4: PLAN ACTIVO (SOLO SI EXISTE O CARGANDO)         */}
        {/* ========================================================= */}
        {plansLoading ? (
          <>
            <AndeanTocapuDivider />
            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  alignItems: 'center',
                  paddingVertical: 18,
                  gap: 6,
                },
              ]}
            >
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={[styles.planLoadingText, { color: palette.textSecondary }]}>
                Verificando estado de expedición…
              </Text>
            </View>
          </>
        ) : planActivo ? (
          <>
            <AndeanTocapuDivider />
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleBlock}>
                <Text style={[styles.sectionKicker, { color: palette.primary }]}>EN PROGRESO</Text>
                <Text style={[styles.sectionTitle, { color: palette.brand }]}>
                  PLAN ACTIVO EN CURSO
                </Text>
              </View>
              <View style={styles.activePlanBadge}>
                <Text style={styles.activePlanBadgeText}>ACTIVO</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Ver detalle del plan activo: ${planActivo.titulo}`}
              onPress={() => router.push('/plan/activo')}
            >
              <View
                style={[
                  styles.planCard,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}
              >
                <View style={[styles.planCardAccent, { backgroundColor: palette.accent }]} />
                <View style={styles.planCardHeader}>
                  <View style={styles.planCardInfo}>
                    <Text style={[styles.planCardKicker, { color: palette.primary }]}>
                      EXPEDICIÓN VIGENTE
                    </Text>
                    <Text
                      style={[styles.planCardTitle, { color: palette.brand }]}
                      numberOfLines={2}
                    >
                      {planActivo.titulo}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.planCardBadge,
                      { backgroundColor: palette.backgroundElement, borderColor: palette.border },
                    ]}
                  >
                    <Text style={[styles.planCardBadgeText, { color: palette.brand }]}>
                      {totalParadas} {totalParadas === 1 ? 'parada' : 'paradas'}
                    </Text>
                  </View>
                </View>

                {/* Barra de progreso de paradas */}
                <View style={styles.planProgress}>
                  <View style={styles.planProgressRow}>
                    <Text style={[styles.planProgressLabel, { color: palette.brand }]}>
                      Parada {paradaActual} de {totalParadas}
                    </Text>
                    <Text style={[styles.planProgressPct, { color: palette.burgundy }]}>
                      {pctActivo}%
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.planProgressTrack,
                      { borderColor: palette.border, backgroundColor: palette.backgroundElement },
                    ]}
                  >
                    <View
                      style={[
                        styles.planProgressFill,
                        { backgroundColor: palette.burgundy, width: `${pctActivo}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Siguiente parada */}
                {siguienteParada && (
                  <View
                    style={[
                      styles.planNext,
                      { borderColor: palette.border, backgroundColor: palette.background },
                    ]}
                  >
                    <View style={[styles.planNextIcon, { backgroundColor: palette.accent }]} />
                    <View style={styles.planNextInfo}>
                      <Text style={[styles.planNextKicker, { color: palette.primary }]}>
                        SIGUIENTE DESTINO
                      </Text>
                      <Text
                        style={[styles.planNextNombre, { color: palette.brand }]}
                        numberOfLines={1}
                      >
                        {siguienteParada.place.nombre}
                      </Text>
                    </View>
                    <Text style={[styles.planNextArrow, { color: palette.primary }]}>→</Text>
                  </View>
                )}

                {/* Botón CTA explícito para continuar expedición */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Continuar expedición activa"
                  activeOpacity={0.85}
                  onPress={() => router.push('/plan/activo')}
                  style={[
                    styles.planCtaButton,
                    { backgroundColor: palette.primary, borderColor: palette.brand },
                  ]}
                >
                  <Text style={[styles.planCtaText, { color: palette.surface }]}>
                    CONTINUAR EXPEDICIÓN →
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {/* Separador Andino Tocapu */}
        <AndeanTocapuDivider />

        {/* ========================================================= */}
        {/* BLOQUE 5: DESTINOS PATRIMONIALES REALES                   */}
        {/* ========================================================= */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleBlock}>
            <Text style={[styles.sectionKicker, { color: palette.primary }]}>CATÁLOGO PATRIMONIAL</Text>
            <Text style={[styles.sectionTitle, { color: palette.brand }]}>
              DESTINOS EN TU RUTA
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Ver catálogo completo de destinos"
            activeOpacity={0.7}
            onPress={() => router.push('/places')}
          >
            <Text style={[styles.sectionActionText, { color: palette.primary }]}>
              VER TODOS →
            </Text>
          </TouchableOpacity>
        </View>

        {loadingPlaces ? (
          <View style={styles.placesLoadingContainer}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.placesLoadingText, { color: palette.textSecondary }]}>
              Consultando estaciones culturales...
            </Text>
          </View>
        ) : placesError ? (
          <View style={[styles.placesErrorBox, { borderColor: palette.burgundy }]}>
            <Text style={[styles.placesErrorText, { color: palette.burgundy }]}>
              {placesError}
            </Text>
          </View>
        ) : featuredPlaces.length === 0 ? (
          <View style={[styles.placesEmptyBox, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.placesEmptyText, { color: palette.textSecondary }]}>
              No hay destinos activos registrados en este momento.
            </Text>
          </View>
        ) : (
          <View style={styles.placesList}>
            {featuredPlaces.map((place) => {
              const costoLabel =
                place.gasto_min == null || place.gasto_min === 0
                  ? 'Gratis'
                  : `S/ ${place.gasto_min}`;
              const duracionLabel = place.duracion_sugerida_min
                ? `${place.duracion_sugerida_min} min`
                : null;
              const primeraCategoria = place.categorias?.[0]?.nombre;

              return (
                <TouchableOpacity
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver detalles de ${place.nombre}`}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/place/${place.id}` as any)}
                >
                  <View
                    style={[
                      styles.placeCard,
                      { backgroundColor: palette.surface, borderColor: palette.border },
                    ]}
                  >
                    <View style={[styles.placeCardAccentBar, { backgroundColor: palette.accent }]} />
                    <View style={styles.placeCardContent}>
                      <View style={styles.placeCardHead}>
                        <View style={styles.placeCategoryTag}>
                          <Text style={[styles.placeCategoryText, { color: palette.burgundy }]}>
                            {primeraCategoria ? primeraCategoria.toUpperCase() : 'PATRIMONIO'}
                          </Text>
                        </View>
                        <Text style={[styles.placeCostText, { color: palette.primary }]}>
                          {costoLabel}
                        </Text>
                      </View>

                      <Text
                        style={[styles.placeName, { color: palette.brand }]}
                        numberOfLines={1}
                      >
                        {place.nombre}
                      </Text>

                      {place.direccion && (
                        <Text
                          style={[styles.placeAddress, { color: palette.textSecondary }]}
                          numberOfLines={1}
                        >
                          {place.direccion}
                        </Text>
                      )}

                      <View style={[styles.placeFooter, { borderTopColor: palette.border }]}>
                        {duracionLabel && (
                          <Text style={[styles.placeMeta, { color: palette.textSecondary }]}>
                            ⏱ {duracionLabel}
                          </Text>
                        )}
                        <Text style={[styles.placeArrow, { color: palette.primary }]}>
                          Ver ficha →
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ========================================================= */}
        {/* SELLO DE CONTROL DE TRÁNSITO FINAL (COMPACTO Y DISCRETO) */}
        {/* ========================================================= */}
        <View style={styles.stampWrapper}>
          <AndeanTransitStamp
            folio="SERIE AX-01 · PASAJERO CULTURAL"
            station="ESTACIÓN LIMA PATRIMONIAL"
            route="RED DE RECORRIDOS CHASKI"
            compact={true}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    gap: 4,
  },

  /* Top App Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 2,
  },
  brandContainer: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  folioBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  folioBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: palette.brand,
    letterSpacing: 1,
  },
  brandTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  brandSubtitle: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  avatarButton: {
    marginLeft: 12,
  },
  avatarFrame: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarThumbnail: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },

  /* Greeting */
  greetingSection: {
    marginTop: 4,
    marginBottom: 10,
  },
  greetingKicker: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  greetingTitle: {
    fontFamily: Fonts.serif,
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 30,
  },
  greetingSub: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  activeExpeditionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  activeExpeditionBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeExpeditionBannerInfo: {
    flex: 1,
    gap: 1,
  },
  activeExpeditionBannerKicker: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  activeExpeditionBannerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 13,
    fontWeight: '700',
  },
  activeExpeditionBannerCta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* Boleto Principal Protagonista */
  ticketCardWrapper: {
    width: '100%',
    marginVertical: 2,
  },
  ticketCard: {
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: palette.brand,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketSeriesBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  ticketSeriesText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  ticketFolioText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1,
  },
  ticketTitle: {
    fontFamily: Fonts.serif,
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ticketDescription: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 10,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
  },
  ticketMetaItem: {
    flex: 1,
  },
  ticketMetaDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 10,
  },
  ticketMetaLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  ticketMetaValue: {
    fontFamily: Fonts.serif,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  perforationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -20,
    marginVertical: 8,
  },
  notchLeft: {
    width: 14,
    height: 22,
    borderTopRightRadius: 11,
    borderBottomRightRadius: 11,
  },
  notchRight: {
    width: 14,
    height: 22,
    borderTopLeftRadius: 11,
    borderBottomLeftRadius: 11,
  },
  perforationLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  quickAccessRow: {
    marginTop: 4,
    marginBottom: 12,
    gap: 6,
  },
  quickAccessLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  quickChipText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ticketCtaButton: {
    height: 50,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ticketCtaInnerBorder: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    right: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 253, 249, 0.3)',
  },
  ticketCtaText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Headers de sección compartidos */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 6,
  },
  sectionTitleBlock: {
    flex: 1,
  },
  sectionKicker: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sectionTitle: {
    fontFamily: Fonts.serif,
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionActionText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* Afinidades del usuario */
  affinitiesCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 13,
    marginBottom: 2,
    gap: 7,
  },
  affinitiesLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  affinitiesChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 2,
  },
  affinityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  affinityChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  affinityChipText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '600',
  },
  affinitiesEmptyText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontStyle: 'italic',
  },
  affinitiesBudgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 2,
  },
  affinitiesBudgetValue: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  adjustBudgetBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  adjustBudgetText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  /* Plan activo */
  activePlanBadge: {
    backgroundColor: 'rgba(125, 41, 53, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(125, 41, 53, 0.3)',
  },
  activePlanBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: palette.burgundy,
    letterSpacing: 1,
  },
  planCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 13,
    marginBottom: 2,
  },
  planCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 4,
  },
  planCardInfo: { flex: 1 },
  planCardKicker: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  planCardTitle: {
    fontFamily: Fonts.serif,
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 2,
  },
  planCardBadge: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
  },
  planCardBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
  },
  planProgress: { marginTop: 8, paddingLeft: 4 },
  planProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  planProgressLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
  },
  planProgressPct: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
  },
  planProgressTrack: {
    height: 7,
    borderRadius: 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  planProgressFill: { height: '100%' },
  planNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginLeft: 4,
    borderWidth: 1,
    borderRadius: 4,
    padding: 7,
  },
  planNextIcon: { width: 7, height: 7, borderRadius: 3.5 },
  planNextInfo: { flex: 1 },
  planNextKicker: {
    fontFamily: Fonts.mono,
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  planNextNombre: {
    fontFamily: Fonts.serif,
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 1,
  },
  planNextArrow: { fontSize: 15, fontWeight: '700' },
  planCtaButton: {
    marginTop: 10,
    marginLeft: 4,
    height: 42,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCtaText: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  planLoadingText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
  },

  /* Destinos reales */
  placesList: {
    gap: 7,
    marginBottom: 4,
  },
  placesLoadingContainer: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 7,
  },
  placesLoadingText: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
  },
  placesErrorBox: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(125, 41, 53, 0.08)',
  },
  placesErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    textAlign: 'center',
  },
  placesEmptyBox: {
    padding: 14,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  placesEmptyText: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    textAlign: 'center',
  },
  placeCard: {
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 11,
  },
  placeCardAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
  },
  placeCardContent: {
    paddingLeft: 5,
    gap: 2.5,
  },
  placeCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeCategoryTag: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  placeCategoryText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  placeCostText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
  },
  placeName: {
    fontFamily: Fonts.serif,
    fontSize: 13.5,
    fontWeight: '700',
  },
  placeAddress: {
    fontFamily: Fonts.sans,
    fontSize: 10.5,
  },
  placeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 1,
  },
  placeMeta: {
    fontFamily: Fonts.mono,
    fontSize: 9,
  },
  placeArrow: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
  },

  /* Sello de cierre discreto */
  stampWrapper: {
    marginTop: 'auto',
    paddingTop: 16,
    marginBottom: 2,
  },
});
