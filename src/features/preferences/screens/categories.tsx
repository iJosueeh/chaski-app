import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/features/preferences/context/preferences-context';

export function CategoriesScreen() {
    const theme = useTheme();
    const { categories, selectedIds, loading, toggleCategory, loadCategories } = usePreferences();

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const canProceed = selectedIds.length > 0;

    return (
        <ThemedView style={styles.container}>
            <ThemedView style={styles.header}>
                <ThemedText type="subtitle" style={styles.title}>
                    ¿Que te interesa?
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary">
                    Selecciona al menos una categoria
                </ThemedText>
            </ThemedView>

            {loading ? (
                <ActivityIndicator size="large" style={styles.loader} />
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.grid}
                >
                    {categories.map(category => {
                        const isSelected = selectedIds.includes(category.id);
                        return (
                            <TouchableOpacity
                                key={category.id}
                                onPress={() => toggleCategory(category.id)}
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: isSelected ? '#3c87f7' : theme.backgroundElement,
                                        borderColor: isSelected ? '#3c87f7' : theme.backgroundSelected,
                                    },
                                ]}
                            >
                                <ThemedText
                                    type="smallBold"
                                    style={{ color: isSelected ? '#ffffff' : theme.text }}
                                >
                                    {category.nombre}
                                </ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}

            <ThemedView style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, { opacity: canProceed ? 1 : 0.4 }]}
                    onPress={() => router.push('/onboarding-budget' as any)}
                    disabled={!canProceed}
                >
                    <ThemedText type="default" style={styles.buttonText}>
                        Siguiente
                    </ThemedText>
                </TouchableOpacity>
            </ThemedView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        paddingTop: 64,
        paddingHorizontal: 24,
        gap: 8,
    },
    title: {
        marginBottom: 4,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
    },
    scrollView: {
        flex: 1,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        padding: 24,
        justifyContent: 'center',
    },
    chip: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: 1,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 48,
        paddingTop: 16,
    },
    button: {
        height: 48,
        backgroundColor: '#3c87f7',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#ffffff',
    },
});
