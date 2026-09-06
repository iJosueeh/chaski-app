import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Props = {
    min: number | null;
    max: number | null;
};

export function PriceRange({ min, max }: Props) {
    const isMinZero = min === 0 || min === null;
    const isMaxZero = max === 0 || max === null;

    if (isMinZero && isMaxZero) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText type="small" style={styles.freeText}>
                    Entrada gratis
                </ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            {min != null && min > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                    Desde S/{min}
                </ThemedText>
            ) : isMinZero ? (
                <ThemedText type="small" style={styles.freeText}>
                    Entrada gratis
                </ThemedText>
            ) : null}
            {max != null && (
                <ThemedText type="small" themeColor="textSecondary">
                    Hasta S/{max}
                </ThemedText>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 16,
    },
    freeText: {
        color: '#4caf50',
        fontWeight: '600',
    },
});
