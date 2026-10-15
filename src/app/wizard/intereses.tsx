/**
 * Wizard — Paso 4 de 5: INTERESES (Serie AX).
 * Selección de afinidades culturales para afinar la expedición.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts } from '@/constants/theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TocapuStrip,
  WizardButton,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';
import { safeBackWizard, safeCancelWizard } from '@/features/wizard/utils/wizard-navigation';

const palette = Colors.light;

const OPCIONES = [
  'Gastronomía',
  'Cultura',
  'Naturaleza',
  'Historia',
  'Compras',
  'Nocturno',
];

export default function WizardIntereses() {
  const insets = useSafeAreaInsets();
  const { request, setIntereses } = useWizard();
  const [sel, setSel] = useState<string[]>(request.intereses);

  const toggle = (v: string) =>
    setSel((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const seguir = () => {
    setIntereses(sel);
    router.push('/wizard/movilidad');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={() => safeBackWizard('/wizard/presupuesto')}
        onCancel={safeCancelWizard}
      />
      <TocapuStrip />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.block}>
          <WizardHeading
            title="¿Qué te provoca hacer?"
            subtitle="Elige una o varias afinidades culturales"
          />
        </View>

        <View style={styles.chips}>
          {OPCIONES.map((op) => {
            const active = sel.includes(op);
            return (
              <TouchableOpacity
                key={op}
                activeOpacity={0.8}
                onPress={() => toggle(op)}
                accessibilityRole="button"
                accessibilityLabel={`Interés: ${op}, ${active ? 'seleccionado' : 'no seleccionado'}`}
              >
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? palette.brand : palette.surface,
                      borderColor: active ? palette.brand : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? palette.surface : palette.brand },
                    ]}
                  >
                    {op}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.btnWrap}>
          <WizardButton
            label={sel.length ? `CONTINUAR (${sel.length} SELECCIONADOS)` : 'CONTINUAR'}
            onPress={seguir}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.background,
            paddingBottom: Math.max(insets.bottom, 12) + 6,
          },
        ]}
      >
        <StepIndicator step={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  block: { paddingHorizontal: 20, paddingTop: 14 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnWrap: { paddingHorizontal: 20, marginTop: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 6 },
});
