/**
 * Wizard — Paso 4 de 5: INTERESES (stub funcional).
 * Chips multiselección simples; se reemplaza por la grilla completa del Figma.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TocapuStrip,
  WizardButton,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';

const OPCIONES = ['Gastronomía', 'Cultura', 'Naturaleza', 'Historia', 'Compras', 'Nocturno'];

export default function WizardIntereses() {
  const theme = useTheme();
  const { request, setIntereses } = useWizard();
  const [sel, setSel] = useState<string[]>(request.intereses);

  const toggle = (v: string) =>
    setSel((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const seguir = () => {
    setIntereses(sel);
    router.push('/wizard/movilidad');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <WizardTopBar onBack={() => router.back()} onCancel={() => { router.dismissAll(); router.back(); }} />
        <TocapuStrip />
        <View style={styles.block}>
          <WizardHeading
            title="¿Qué te provoca hacer?"
            subtitle="Elige uno o varios intereses"
          />
        </View>
        <View style={styles.chips}>
          {OPCIONES.map((op) => {
            const active = sel.includes(op);
            return (
              <TouchableOpacity key={op} activeOpacity={0.8} onPress={() => toggle(op)}>
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
      <View style={[styles.footer, { backgroundColor: theme.background }]}>
        <StepIndicator step={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  block: { paddingHorizontal: 20, paddingTop: 16 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 20,
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
  btnWrap: { paddingHorizontal: 20, marginTop: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
