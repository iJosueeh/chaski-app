/**
 * Componentes compartidos del wizard "Boleto de Experiencias" (Serie AX).
 *
 * Paleta Serie AX clara:
 * - Pergamino: #FAF5EE (fondo)
 * - Marfil: #FFFDF9 (superficies de ticket)
 * - Tinta: #4A2E18 (marca y títulos)
 * - Terracota: #9C3E1B (acciones y CTA)
 * - Borgoña: #7D2935 (progreso y serie)
 * - Dorado ocre: #D4AF37 (acentos y sellos)
 */
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';

const palette = Colors.light;

/* ─── Franja tocapu (greca geométrica andina) ───────────────────────────── */
export function TocapuStrip() {
  return (
    <View style={styles.tocapu} accessible={false} importantForAccessibility="no">
      {Array.from({ length: 14 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.tocapuSeg,
            {
              backgroundColor:
                i % 3 === 0
                  ? palette.accent
                  : i % 3 === 1
                  ? palette.backgroundElement
                  : 'rgba(156, 62, 27, 0.25)',
            },
          ]}
        />
      ))}
    </View>
  );
}

/* ─── Top bar del wizard (‹ volver | Chaski Serie AX | ✕ cancelar) ─────── */
export function WizardTopBar({
  onBack,
  onCancel,
}: {
  onBack: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.topBar,
        {
          paddingTop: Math.max(insets.top, 10),
          backgroundColor: palette.background,
        },
      ]}
    >
      {/* Botón Volver (Área táctil mínima 48x48 dp) */}
      <TouchableOpacity
        onPress={() => onBack?.()}
        accessibilityRole="button"
        accessibilityLabel="Volver al paso anterior"
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.navButton}
      >
        <Text style={[styles.navButtonGlyph, { color: palette.brand }]}>‹</Text>
      </TouchableOpacity>

      {/* Marca central con folio de serie */}
      <View style={styles.brandContainer}>
        <Text style={[styles.topBarBrand, { color: palette.brand }]}>CHASKI</Text>
        <Text style={[styles.topBarSub, { color: palette.primary }]}>SERIE AX · RUTA</Text>
      </View>

      {/* Botón Cancelar (Área táctil mínima 48x48 dp) */}
      <TouchableOpacity
        onPress={() => onCancel?.()}
        accessibilityRole="button"
        accessibilityLabel="Cerrar asistente y volver al inicio"
        accessibilityHint="Cancela la creación de ruta y regresa al menú principal"
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.navButton}
      >
        <Text style={[styles.navCancelGlyph, { color: palette.burgundy }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Heading con reglas doradas + rombo + subtítulo ──────────────────── */
export function WizardHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.headingWrapper}>
      {/* Pre-rule: línea corta + rombo escalonado + línea larga */}
      <View style={styles.preRule}>
        <View style={[styles.preRuleLine, { backgroundColor: palette.accent }]} />
        <View style={[styles.preRuleDiamond, { backgroundColor: palette.accent }]} />
        <View style={[styles.preRuleLineLong, { backgroundColor: palette.border }]} />
      </View>
      <Text style={[styles.heading, { color: palette.brand }]}>{title}</Text>
      <Text style={[styles.headingSub, { color: palette.textSecondary }]}>{subtitle}</Text>
      <View style={[styles.bottomRule, { backgroundColor: palette.border }]} />
    </View>
  );
}

/* ─── Indicador PASO X DE 5 con barra ──────────────────────────────────── */
export function StepIndicator({ step, total = 5 }: { step: number; total?: number }) {
  const pct = Math.min(Math.max((step / total) * 100, 0), 100);

  return (
    <View style={styles.stepWrap}>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepText, { color: palette.textSecondary }]}>
          PASO {step} DE {total}
        </Text>
        <Text style={[styles.stepFolio, { color: palette.primary }]}>
          FOLIO AX-0{step}
        </Text>
      </View>
      <View
        style={[
          styles.stepTrack,
          { backgroundColor: palette.backgroundElement, borderColor: palette.border },
        ]}
      >
        <View
          style={[
            styles.stepFill,
            {
              backgroundColor: palette.burgundy,
              width: `${pct}%`,
            },
          ]}
        />
      </View>
      <View style={[styles.stepUnderline, { backgroundColor: palette.accent }]} />
    </View>
  );
}

/* ─── Tarjeta-ticket (opción del wizard con perforaciones) ─────────────── */
export function TicketCard({
  title,
  subtitle,
  folio,
  stamp,
  onPress,
  selected,
}: {
  title: string;
  subtitle: string;
  folio: string;
  stamp: string;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <View
      style={[
        styles.ticket,
        {
          backgroundColor: palette.surface,
          borderColor: selected ? palette.primary : palette.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      {/* Perforación física superior */}
      <View style={styles.perforation} accessible={false}>
        <View
          style={[
            styles.notch,
            styles.notchLeft,
            { backgroundColor: palette.background },
          ]}
        />
        <View style={[styles.perfLine, { borderTopColor: palette.border }]} />
        <View
          style={[
            styles.notch,
            styles.notchRight,
            { backgroundColor: palette.background },
          ]}
        />
      </View>

      {/* Todo el cuerpo del ticket es táctil */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${subtitle}`}
      >
        <View style={styles.ticketBody}>
          <View style={styles.ticketTitleRow}>
            <Text style={[styles.ticketTitle, { color: palette.brand }]}>{title}</Text>
            {selected && (
              <View style={[styles.selectedBadge, { backgroundColor: palette.primary }]}>
                <Text style={styles.selectedBadgeText}>ELEGIDO</Text>
              </View>
            )}
          </View>
          <Text style={[styles.ticketSub, { color: palette.textSecondary }]}>
            {subtitle}
          </Text>
          <View style={[styles.goldRule, { backgroundColor: palette.border }]} />
        </View>

        {/* Stub inferior de comprobante */}
        <View style={[styles.stub, { backgroundColor: palette.backgroundElement, borderTopColor: palette.border }]}>
          <Text style={[styles.stubFolio, { color: palette.primary }]}>{folio}</Text>
          <Text style={[styles.stubDots, { color: palette.accent }]}>◆ ◆ ◆</Text>
          <Text style={[styles.stubStamp, { color: palette.textSecondary }]}>
            {stamp}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Botón primario del wizard ────────────────────────────────────────── */
export function WizardButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.wizBtn,
        {
          backgroundColor: disabled ? palette.backgroundElement : palette.primary,
          borderColor: disabled ? palette.border : palette.brand,
        },
      ]}
    >
      {!disabled && <View style={styles.wizBtnInnerBorder} />}
      <Text
        style={[
          styles.wizBtnText,
          { color: disabled ? palette.textSecondary : palette.surface },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tocapu: {
    flexDirection: 'row',
    height: 8,
    width: '100%',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  tocapuSeg: {
    flex: 1,
    height: 8,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  navButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonGlyph: {
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 32,
  },
  navCancelGlyph: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  brandContainer: {
    alignItems: 'center',
    gap: 1,
  },
  topBarBrand: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 2,
  },
  topBarSub: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  headingWrapper: {
    gap: 2,
  },
  preRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  preRuleLine: { width: 28, height: 1.5 },
  preRuleDiamond: {
    width: 6,
    height: 6,
    transform: [{ rotate: '45deg' }],
  },
  preRuleLineLong: { flex: 1, height: 1 },
  heading: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  headingSub: {
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    marginTop: 3,
  },
  bottomRule: { height: 1, marginTop: 10 },

  stepWrap: {
    gap: 5,
    alignItems: 'center',
    paddingVertical: 6,
    width: '100%',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  stepText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  stepFolio: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stepTrack: {
    width: '100%',
    height: 6,
    borderRadius: 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepFill: { height: '100%' },
  stepUnderline: { width: 48, height: 1.5, marginTop: 2, opacity: 0.6 },

  ticket: {
    borderRadius: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: palette.brand,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  perforation: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
  },
  notch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    top: -7,
    zIndex: 2,
  },
  notchLeft: { left: -7 },
  notchRight: { right: -7 },
  perfLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 14,
  },
  ticketBody: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, gap: 3 },
  ticketTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketTitle: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
  },
  selectedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  selectedBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  ticketSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  goldRule: { height: 1, marginTop: 8 },
  stub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  stubFolio: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stubDots: { fontSize: 8 },
  stubStamp: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
  },

  wizBtn: {
    height: 50,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wizBtnInnerBorder: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    right: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 253, 249, 0.3)',
  },
  wizBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
