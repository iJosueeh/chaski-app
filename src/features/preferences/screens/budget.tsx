import { useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    TextInput,
    TouchableOpacity,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/features/preferences/context/preferences-context';

export function BudgetScreen() {
    const theme = useTheme();
    const {
        gastoMin,
        gastoMax,
        setGastoMin,
        setGastoMax,
        savePreferences,
    } = usePreferences();
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await savePreferences();
        setSaving(false);
    };

    const handleSkip = async () => {
        setSaving(true);
        await savePreferences();
        setSaving(false);
    };

    return (
        <ThemedView style={styles.container}>
            <ThemedView style={styles.header}>
                <ThemedText type="subtitle" style={styles.title}>
                    Define tu presupuesto
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
                    Opcional — puedes omitir este paso
                </ThemedText>
            </ThemedView>

            <ThemedView style={styles.form}>
                <ThemedView style={styles.inputGroup}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                        Gasto minimo
                    </ThemedText>
                    <TextInput
                        style={[styles.input, {
                            color: theme.text,
                            borderColor: theme.backgroundSelected,
                            backgroundColor: theme.backgroundElement,
                        }]}
                        placeholder="0"
                        placeholderTextColor={theme.textSecondary}
                        value={gastoMin}
                        onChangeText={setGastoMin}
                        keyboardType="numeric"
                    />
                </ThemedView>

                <ThemedView style={styles.inputGroup}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                        Gasto maximo
                    </ThemedText>
                    <TextInput
                        style={[styles.input, {
                            color: theme.text,
                            borderColor: theme.backgroundSelected,
                            backgroundColor: theme.backgroundElement,
                        }]}
                        placeholder="0"
                        placeholderTextColor={theme.textSecondary}
                        value={gastoMax}
                        onChangeText={setGastoMax}
                        keyboardType="numeric"
                    />
                </ThemedView>
            </ThemedView>

            <ThemedView style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, { opacity: saving ? 0.6 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <ThemedText type="default" style={styles.buttonText}>
                            Guardar preferencias
                        </ThemedText>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleSkip}
                    disabled={saving}
                >
                    <ThemedText type="small" themeColor="textSecondary">
                        Omitir
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
    subtitle: {
        textAlign: 'center',
    },
    form: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 20,
        maxWidth: 320,
        alignSelf: 'center',
        width: '100%',
    },
    inputGroup: {
        gap: 6,
    },
    label: {
        marginLeft: 4,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 48,
        paddingTop: 16,
        alignItems: 'center',
        gap: 12,
    },
    button: {
        height: 48,
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#3c87f7',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#ffffff',
    },
    skipButton: {
        paddingVertical: 8,
    },
});
