/**
 * Componentes compartidos del wizard "Boleto de Experiencias" (Serie AX).
 * Todos derivan de los frames del Figma: top bar (volver/cancelar),
 * franja tocapu, heading con reglas doradas + rombo, indicador "PASO X DE 5"
 * y tarjetas-ticket con esquinas cortadas + stub de folio.
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/* ─── Franja tocapu (greca dorada) ──────────────────────────────────────── */
export function TocapuStrip() {
  const theme = useTheme();
  return (
    <View style={styles.tocapu}>
      {Array.from({ length: 12 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.tocapuSeg,
            { backgroundColor: i % 2 === 0 ? theme.accent : 'transparent' },
          ]}
        />
      ))}
    </View>
  );
}

/* ─── Top bar del wizard (‹ volver | Chaski | ✕ cancelar) ──────────────── */
export function WizardTopBar({
  onBack,
  onCancel,
}: {
  onBack: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button">
        <Text style={[styles.topBarBtn, { color: theme.brand }]}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.topBarBrand, { color: theme.brand }]}>Chaski</Text>
      <TouchableOpacity onPress={onCancel} accessibilityRole="button">
        <Text style={[styles.topBarBtn, { color: theme.primary }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Heading con reglas doradas + rombo + subrayado ───────────────────── */
export function WizardHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const theme = useTheme();
  return (
    <View>
      {/* Pre-rule: línea corta + rombo + línea larga */}
      <View style={styles.preRule}>
        <View style={[styles.preRuleLine, { backgroundColor: theme.accent }]} />
        <View style={[styles.preRuleDiamond, { backgroundColor: theme.accent }]} />
        <View style={[styles.preRuleLineLong, { backgroundColor: theme.accent }]} />
      </View>
      <Text style={[styles.heading, { color: theme.brand }]}>{title}</Text>
      <Text style={[styles.headingSub, { color: theme.textSecondary }]}>{subtitle}</Text>
      <View style={[styles.bottomRule, { backgroundColor: theme.accent }]} />
    </View>
  );
}

/* ─── Indicador PASO X DE 5 con barra ──────────────────────────────────── */
export function StepIndicator({ step, total = 5 }: { step: number; total?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.stepWrap}>
      <Text style={[styles.stepText, { color: theme.brand }]}>
        PASO {step} DE {total}
      </Text>
      <View style={styles.stepTrack}>
        <View
          style={[
            styles.stepFill,
            {
              backgroundColor: theme.carmine,
              width: `${(step / total) * 100}%`,
            },
          ]}
        />
      </View>
      <View style={[styles.stepUnderline, { backgroundColor: theme.accent }]} />
    </View>
  );
}

/* ─── Tarjeta-ticket (opción del wizard) ───────────────────────────────── */
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
  const theme = useTheme();
  return (
    <View
      style={[
        styles.ticket,
        {
          backgroundColor: theme.surface,
          borderColor: selected ? theme.carmine : theme.brand,
          borderWidth: selected ? 2 : 1.5,
        },
      ]}>
      {/* Perforación superior */}
      <View style={styles.perforation}>
        <View
          style={[
            styles.notch,
            styles.notchLeft,
            { backgroundColor: theme.background },
          ]}
        />
        <View style={[styles.perfLine, { borderTopColor: theme.accent }]} />
        <View
          style={[
            styles.notch,
            styles.notchRight,
            { backgroundColor: theme.background },
          ]}
        />
      </View>

      {/* TODO el cuerpo del ticket es táctil */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button">
        <View style={styles.ticketBody}>
          <Text style={[styles.ticketTitle, { color: theme.brand }]}>{title}</Text>
          <Text style={[styles.ticketSub, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
          <View style={[styles.goldRule, { backgroundColor: theme.accent }]} />
        </View>

        {/* Stub inferior también táctil */}
        <View style={styles.stub}>
          <Text style={[styles.stubFolio, { color: theme.primary }]}>{folio}</Text>
          <Text style={[styles.stubDots, { color: theme.accent }]}>◆ ◆ ◆</Text>
          <Text style={[styles.stubStamp, { color: theme.textSecondary }]}>
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
  const theme = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button">
      <View
        style={[
          styles.wizBtn,
          {
            backgroundColor: disabled ? theme.border : theme.carmine,
            borderColor: theme.brand,
          },
        ]}>
        <Text style={[styles.wizBtnText, { color: theme.surface }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tocapu: {
    flexDirection: 'row',
    height: 12,
    width: '100%',
    backgroundColor: 'rgba(212,175,55,0.25)',
  },
  tocapuSeg: {
    flex: 1,
    height: 12,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarBtn: { fontSize: 24, lineHeight: 30, fontWeight: '600' },
  topBarBrand: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 18,
    letterSpacing: 1,
  },

  preRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  preRuleLine: { width: 32, height: 2 },
  preRuleDiamond: {
    width: 8,
    height: 8,
    transform: [{ rotate: '45deg' }],
  },
  preRuleLineLong: { flex: 1, height: 2, opacity: 0.5 },
  heading: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 24,
    lineHeight: 32,
  },
  headingSub: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    marginTop: 6,
  },
  bottomRule: { height: 1, marginTop: 12, opacity: 0.5 },

  stepWrap: { gap: 6, alignItems: 'center', paddingVertical: 8 },
  stepText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
  },
  stepTrack: {
    width: '100%',
    height: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(74,46,24,0.3)',
    overflow: 'hidden',
  },
  stepFill: { height: '100%' },
  stepUnderline: { width: 56, height: 2, opacity: 0.7 },

  ticket: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  perforation: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
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
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    marginHorizontal: 16,
  },
  ticketBody: { padding: 16, gap: 4 },
  ticketTitle: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 18,
  },
  ticketSub: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
  },
  goldRule: { height: 1, marginTop: 8, opacity: 0.6 },
  stub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(74,46,24,0.2)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  stubFolio: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
    letterSpacing: 1,
  },
  stubDots: { fontSize: 8 },
  stubStamp: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
    letterSpacing: 1,
  },

  wizBtn: {
    height: 54,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wizBtnText: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});
