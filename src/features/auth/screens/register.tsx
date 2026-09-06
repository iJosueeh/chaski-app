import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { signUp } from '@/features/auth/services/auth.service';

export function RegisterScreen() {
    const theme = useTheme();
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!nombre || !email || !password) {
            setError('Completa todos los campos');
            return;
        }

        setLoading(true);
        setError('');

        const { error: authError } = await signUp({ nombre, email, password });

        if (authError) {
            setError(authError.message);
        } else {
            router.back();
        }

        setLoading(false);
    };

    return (
        <ThemedView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboard}
            >
                <ThemedView style={styles.inner}>
                    <ThemedText type="title" style={styles.title}>
                        Chaski
                    </ThemedText>

                    <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
                        Crea tu cuenta
                    </ThemedText>

                    <ThemedView style={styles.form}>
                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
                            placeholder="Nombre"
                            placeholderTextColor={theme.textSecondary}
                            value={nombre}
                            onChangeText={setNombre}
                            autoCapitalize="words"
                        />

                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
                            placeholder="Correo electronico"
                            placeholderTextColor={theme.textSecondary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
                            placeholder="Contrasena"
                            placeholderTextColor={theme.textSecondary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        {error ? (
                            <ThemedText type="small" style={styles.error}>
                                {error}
                            </ThemedText>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.button, { opacity: loading ? 0.6 : 1 }]}
                            onPress={handleRegister}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <ThemedText type="default" style={styles.buttonText}>
                                    Crear cuenta
                                </ThemedText>
                            )}
                        </TouchableOpacity>
                    </ThemedView>

                    <TouchableOpacity onPress={() => router.back()} style={styles.link}>
                        <ThemedText type="small" themeColor="textSecondary">
                            Ya tienes cuenta? <ThemedText type="linkPrimary">Inicia sesion</ThemedText>
                        </ThemedText>
                    </TouchableOpacity>
                </ThemedView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboard: {
        flex: 1,
    },
    inner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        marginBottom: 32,
    },
    form: {
        width: '100%',
        maxWidth: 320,
        gap: 12,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    button: {
        height: 48,
        backgroundColor: '#3c87f7',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#ffffff',
    },
    error: {
        color: '#e53935',
        textAlign: 'center',
    },
    link: {
        marginTop: 24,
    },
});
