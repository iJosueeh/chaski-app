import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/features/preferences/context/preferences-context';
import { signOut } from '@/features/auth/services/auth.service';

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
                <TouchableOpacity
                    style={styles.buttonGhost}
                    onPress={() => {
                        // Llegar por tab switch deja la pila vacía: back seguro.
                        if (router.canGoBack()) router.back();
                        else router.replace('/(tabs)');
                    }}
                >
                    <ThemedText type="default" style={styles.buttonGhostText}>
                        Volver
                    </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.buttonLogout}
                    onPress={async () => {
                        // 1) cerrar sesión en Supabase (el contexto hace el swap del árbol)
                        await signOut();
                        // 2) navegación explícita al login. SIN dismissAll(): su
                        //    POP_TO_TOP aterrizaba sobre el stack de login recién
                        //    montado (1 pantalla) y generaba el warning "not
                        //    handled". El swap ya desmonta toda la pila
                        //    autenticada (wizard/plan), dismissAll es redundante.
                        router.replace('/login');
                    }}
                >
                    <ThemedText type="default" style={styles.buttonLogoutText}>
                        Cerrar sesión
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
        gap: 16,
    },
    buttonGhost: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1.5,
    },
    buttonGhostText: {
        color: '#9C3E1B', // terracota Serie AX
    },
    buttonLogout: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: '#B71C1C', // carmín Serie AX
    },
    buttonLogoutText: {
        color: '#FFFDF9', // blanco cálido Serie AX
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
