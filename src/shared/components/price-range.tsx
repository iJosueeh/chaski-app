import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
import { formatPlaceBudget } from '@/features/places/utils/places-formatters';

type Props = {
    min: number | null;
    max: number | null;
};

/**
 * Presupuesto de un destino en clave de boleto (Serie AX).
 * Etiqueta mono compacta: única fuente de verdad en `formatPlaceBudget`.
 */
export function PriceRange({ min, max }: Props) {
    const { label, isFree } = formatPlaceBudget(min, max);

    return (
        <View style={styles.container}>
            <Text
                style={[
                    styles.value,
                    { color: isFree ? Colors.light.success : Colors.light.primary },
                ]}
            >
                {isFree ? '◆ ' : ''}
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    value: {
        fontFamily: Fonts.mono,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
});
