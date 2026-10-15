import { memo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import type { Category } from '../interfaces/preferences.interface';

export interface CategoryChipProps {
  category: Pick<Category, 'id' | 'nombre' | 'descripcion'>;
  selected: boolean;
  onToggle: (id: string) => void;
  disabled?: boolean;
}

/**
 * Chip de selección de categoría con estética "Boleto Serie AX".
 *
 * Características:
 * - Totalmente desacoplado de Supabase y contextos de datos.
 * - Soporta estados: seleccionado, reposo y deshabilitado.
 * - Iconografía de sello geométrico andino sutil integrada.
 * - Accesibilidad para lectores de pantalla (role 'checkbox' / 'button', checked state).
 */
export const CategoryChip = memo(function CategoryChip({
  category,
  selected,
  onToggle,
  disabled = false,
}: CategoryChipProps) {
  const handlePress = () => {
    if (!disabled) {
      onToggle(category.id);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessible={true}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`Categoría ${category.nombre}`}
      accessibilityHint={
        selected
          ? 'Toca dos veces para deseleccionar esta categoría'
          : 'Toca dos veces para seleccionar esta categoría'
      }
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        pressed && !disabled && (selected ? styles.chipPressedSelected : styles.chipPressedUnselected),
        disabled && styles.chipDisabled,
      ]}
    >
      {/* Marcador geométrico estilo sello Serie AX */}
      <View
        style={[
          styles.badgeIndicator,
          selected ? styles.badgeIndicatorSelected : styles.badgeIndicatorUnselected,
        ]}
      >
        <Text
          style={[
            styles.badgeIndicatorText,
            selected ? styles.badgeIndicatorTextSelected : styles.badgeIndicatorTextUnselected,
          ]}
          aria-hidden={true}
        >
          {selected ? '✓' : '◇'}
        </Text>
      </View>

      <Text
        style={[
          styles.chipText,
          selected ? styles.chipTextSelected : styles.chipTextUnselected,
        ]}
        numberOfLines={1}
      >
        {category.nombre}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    marginVertical: 4,
    marginHorizontal: 4,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.brand,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  chipUnselected: {
    backgroundColor: Colors.light.backgroundElement,
    borderColor: Colors.light.border,
  },
  chipSelected: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primaryDark,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  chipPressedUnselected: {
    backgroundColor: Colors.light.backgroundSelected,
    borderColor: Colors.light.textSecondary,
  },
  chipPressedSelected: {
    backgroundColor: Colors.light.primaryDark,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  badgeIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeIndicatorUnselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.textSecondary,
  },
  badgeIndicatorSelected: {
    backgroundColor: Colors.light.surface,
  },
  badgeIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  badgeIndicatorTextUnselected: {
    color: Colors.light.textSecondary,
  },
  badgeIndicatorTextSelected: {
    color: Colors.light.primary,
  },
  chipText: {
    fontSize: 14,
    fontFamily: Fonts.sans,
    letterSpacing: 0.2,
  },
  chipTextUnselected: {
    color: Colors.light.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: Colors.light.surface,
    fontWeight: '700',
  },
});
