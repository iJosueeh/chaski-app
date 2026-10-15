import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import {
  BUDGET_PRESETS,
  matchBudgetPreset,
  type BudgetPreset,
} from '../utils/preference-validation';


export interface BudgetSelectorProps {
  gastoMinText: string;
  gastoMaxText: string;
  onChangeGastoMinText: (text: string) => void;
  onChangeGastoMaxText: (text: string) => void;
  onSelectPreset?: (preset: BudgetPreset) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Selector de presupuesto Serie AX con opciones predefinidas y campos personalizados.
 *
 * Características:
 * - Desacoplado de Supabase y contextos de aplicación.
 * - Permite omitir el presupuesto (presiona "Cualquiera" o deja campos vacíos).
 * - Chips rápidos: 'Cualquiera', 'Económico', 'Moderado', 'Holgado'.
 * - Modo personalizado con inputs numéricos accesibles de Min/Max.
 * - Respeta formato monetario nacional (S/).
 */
export const BudgetSelector = memo(function BudgetSelector({
  gastoMinText,
  gastoMaxText,
  onChangeGastoMinText,
  onChangeGastoMaxText,
  onSelectPreset,
  error,
  disabled = false,
}: BudgetSelectorProps) {
  const minNum = gastoMinText.trim() === '' ? null : Number(gastoMinText);
  const maxNum = gastoMaxText.trim() === '' ? null : Number(gastoMaxText);
  const activePresetKey = matchBudgetPreset(
    Number.isNaN(minNum) ? null : minNum,
    Number.isNaN(maxNum) ? null : maxNum,
  );

  const handlePresetPress = (preset: BudgetPreset) => {
    if (disabled) return;
    if (preset.key === 'all') {
      onChangeGastoMinText('');
      onChangeGastoMaxText('');
    } else {
      onChangeGastoMinText(preset.min !== null ? String(preset.min) : '');
      onChangeGastoMaxText(preset.max !== null ? String(preset.max) : '');
    }
    onSelectPreset?.(preset);
  };

  return (
    <View style={styles.container}>
      {/* Selector de Presets Rápidos */}
      <View style={styles.presetsContainer}>
        {BUDGET_PRESETS.map((preset) => {
          const isSelected = activePresetKey === preset.key;
          return (
            <Pressable
              key={preset.key}
              onPress={() => handlePresetPress(preset)}
              disabled={disabled}
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`Presupuesto ${preset.label}, ${preset.description}`}
              style={({ pressed }) => [
                styles.presetChip,
                isSelected ? styles.presetChipSelected : styles.presetChipUnselected,
                pressed && !disabled && styles.presetChipPressed,
                disabled && styles.presetChipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.presetChipText,
                  isSelected ? styles.presetChipTextSelected : styles.presetChipTextUnselected,
                ]}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Inputs Personalizados Min / Max */}
      <View style={styles.inputsRow}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>MÍNIMO (S/)</Text>
          <View style={[styles.inputContainer, error ? styles.inputContainerError : null]}>
            <Text style={styles.currencyPrefix}>S/</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Sin mínimo"
              placeholderTextColor={Colors.light.textSecondary}
              value={gastoMinText}
              onChangeText={onChangeGastoMinText}
              keyboardType="numeric"
              editable={!disabled}
              accessible={true}
              accessibilityLabel="Gasto mínimo en soles"
              accessibilityHint="Ingresa el monto mínimo estimado o déjalo vacío"
            />
          </View>
        </View>

        <View style={styles.inputSeparator}>
          <Text style={styles.inputSeparatorDash}>—</Text>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>MÁXIMO (S/)</Text>
          <View style={[styles.inputContainer, error ? styles.inputContainerError : null]}>
            <Text style={styles.currencyPrefix}>S/</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Sin tope"
              placeholderTextColor={Colors.light.textSecondary}
              value={gastoMaxText}
              onChangeText={onChangeGastoMaxText}
              keyboardType="numeric"
              editable={!disabled}
              accessible={true}
              accessibilityLabel="Gasto máximo en soles"
              accessibilityHint="Ingresa el monto máximo estimado o déjalo vacío"
            />
          </View>
        </View>
      </View>

      {/* Mensaje de error de rango o validación */}
      {error ? (
        <View style={styles.errorContainer} accessible={true} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Text style={styles.helpText}>
          Opcional. Puedes dejar ambos campos vacíos si no deseas filtrar por presupuesto.
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  presetChipUnselected: {
    backgroundColor: Colors.light.backgroundElement,
    borderColor: Colors.light.border,
  },
  presetChipSelected: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.brand,
  },
  presetChipPressed: {
    opacity: 0.8,
  },
  presetChipDisabled: {
    opacity: 0.5,
  },
  presetChipText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  presetChipTextUnselected: {
    color: Colors.light.text,
    fontWeight: '500',
  },
  presetChipTextSelected: {
    color: Colors.light.brand,
    fontWeight: '700',
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    gap: 4,
  },
  inputLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.light.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundElement,
    paddingHorizontal: 12,
  },
  inputContainerError: {
    borderColor: Colors.light.carmine,
  },
  currencyPrefix: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginRight: 6,
    fontWeight: '600',
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.light.text,
    paddingVertical: 0,
  },
  inputSeparator: {
    paddingTop: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputSeparatorDash: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  errorContainer: {
    paddingHorizontal: 4,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.carmine,
    fontWeight: '500',
  },
  helpText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
});
