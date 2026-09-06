import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/features/preferences/context/preferences-context';

export function PreferencesScreen() {
    const theme = useTheme();
    const { userPreferences } = usePreferences();

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background }]}
            contentContainerStyle={styles.content}
        >
            <ThemedText type="subtitle" style={styles.title}>
                Mis Preferencias
            </ThemedText>

            {!userPreferences ? (
                <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
                    No tienes preferencias guardadas.
                </ThemedText>
            ) : (
                <ThemedView style={styles.section}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                        Categorias
                    </ThemedText>
                    <ThemedView style={styles.chipsContainer}>
                        {userPreferences.categorias.length > 0 ? (
                            userPreferences.categorias.map(category => (
                                <ThemedView
                                    key={category.id}
                                    style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                                >
                                    <ThemedText type="smallBold">
                                        {category.nombre}
                                    </ThemedText>
                                </ThemedView>
                            ))
                        ) : (
                            <ThemedText type="small" themeColor="textSecondary">
                                Sin categorias seleccionadas
                            </ThemedText>
                        )}
                    </ThemedView>

                    <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.label, styles.mt]}>
                        Presupuesto
                    </ThemedText>
                    <ThemedView style={styles.budgetContainer}>
                        <ThemedView style={styles.budgetItem}>
                            <ThemedText type="small" themeColor="textSecondary">
                                Minimo
                            </ThemedText>
                            <ThemedText type="default">
                                {userPreferences.gasto_min != null ? `$${userPreferences.gasto_min}` : 'No definido'}
                            </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.budgetItem}>
                            <ThemedText type="small" themeColor="textSecondary">
                                Maximo
                            </ThemedText>
                            <ThemedText type="default">
                                {userPreferences.gasto_max != null ? `$${userPreferences.gasto_max}` : 'No definido'}
                            </ThemedText>
                        </ThemedView>
                    </ThemedView>
                </ThemedView>
            )}

            <ThemedView style={styles.footer}>
                <TouchableOpacity style={styles.button} onPress={() => router.back()}>
                    <ThemedText type="default" style={styles.buttonText}>
                        Volver
                    </ThemedText>
                </TouchableOpacity>
            </ThemedView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 24,
        gap: 24,
    },
    title: {
        textAlign: 'center',
    },
    empty: {
        textAlign: 'center',
        marginTop: 48,
    },
    section: {
        gap: 12,
    },
    label: {
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    mt: {
        marginTop: 8,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    budgetContainer: {
        flexDirection: 'row',
        gap: 24,
    },
    budgetItem: {
        flex: 1,
        gap: 4,
    },
    footer: {
        alignItems: 'center',
        marginTop: 24,
    },
    button: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        backgroundColor: '#3c87f7',
        borderRadius: 8,
    },
    buttonText: {
        color: '#ffffff',
    },
});
