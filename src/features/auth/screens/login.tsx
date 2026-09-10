import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { router } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import { signIn } from '@/features/auth/services/auth.service';

/**
 * Pantalla de Login — "Boleto de Experiencias" (Serie AX).
 * Identidad: boleto vintage de transporte con marca CHASKI en Cinzel,
 * folio de serie, pergamino crema y acentos dorados.
 */
export function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Completa todos los campos');
            return;
        }
        setLoading(true);
        setError('');
        const { error: authError } = await signIn({ email, password });
        if (authError) setError(authError.message);
        setLoading(false);
    };

    return (
        <View style={styles.canvas}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboard}
            >
                {/* Ticket / boleto */}
                <View style={styles.ticket}>
                    {/* Franja superior (marca + folio) */}
                    <View style={styles.ticketHeader}>
                        <Text style={styles.brand}>CHASKI</Text>
                        <Text style={styles.serie}>SERIE AX · NRO 00001</Text>
                    </View>

                    {/* Separador dorado con muescas */}
                    <View style={styles.goldRule} />

                    {/* Cuerpo del boleto */}
                    <View style={styles.ticketBody}>
                        <Text style={styles.title}>Bienvenido</Text>
                        <Text style={styles.subtitle}>
                            Inicia sesión para planificar tu salida.
                        </Text>

                        <View style={styles.form}>
                            <TextInput
                                style={styles.input}
                                placeholder="Correo electrónico"
                                placeholderTextColor={Colors.light.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            <TextInput
                                style={styles.input}
                                placeholder="Contraseña"
                                placeholderTextColor={Colors.light.textSecondary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />

                            {error ? <Text style={styles.error}>{error}</Text> : null}

                            <TouchableOpacity
                                style={[styles.button, { opacity: loading ? 0.6 : 1 }]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={Colors.light.surface} />
                                ) : (
                                    <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={() => router.push('/register')} style={styles.link}>
                            <Text style={styles.linkText}>
                                ¿No tienes boleto? <Text style={styles.linkStrong}>Regístrate</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Franja inferior (folio) */}
                    <View style={styles.goldRule} />
                    <View style={styles.ticketFooter}>
                        <Text style={styles.folio}>EMPRESA DE TRANSPORTES CHASKI · LÍNEA CULTURAL</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    canvas: {
        flex: 1,
        backgroundColor: Colors.light.background,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    keyboard: {
        flex: 1,
        justifyContent: 'center',
    },
    ticket: {
        backgroundColor: Colors.light.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.light.border,
        shadowColor: Colors.light.shadowStrong,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 5,
        overflow: 'hidden',
    },
    ticketHeader: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 16,
        alignItems: 'center',
    },
    brand: {
        fontFamily: Fonts.serif,
        fontSize: 34,
        fontWeight: '700',
        letterSpacing: 6,
        color: Colors.light.brand,
    },
    serie: {
        fontFamily: Fonts.mono,
        fontSize: 10,
        letterSpacing: 2,
        color: Colors.light.textSecondary,
        marginTop: 4,
    },
    goldRule: {
        height: 2,
        backgroundColor: Colors.light.accent,
        opacity: 0.7,
    },
    ticketBody: {
        paddingHorizontal: 24,
        paddingVertical: 28,
    },
    title: {
        fontFamily: Fonts.serif,
        fontSize: 24,
        fontWeight: '700',
        color: Colors.light.text,
        marginBottom: 6,
    },
    subtitle: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        color: Colors.light.textSecondary,
        marginBottom: 28,
    },
    form: {
        gap: 12,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: 10,
        paddingHorizontal: 16,
        fontSize: 15,
        fontFamily: Fonts.sans,
        color: Colors.light.text,
        backgroundColor: Colors.light.backgroundElement,
    },
    button: {
        height: 50,
        backgroundColor: Colors.light.primary,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        fontFamily: Fonts.mono,
        fontSize: 13,
        letterSpacing: 2,
        fontWeight: '700',
        color: Colors.light.surface,
    },
    error: {
        color: Colors.light.error,
        textAlign: 'center',
        fontFamily: Fonts.sans,
        fontSize: 13,
    },
    link: {
        marginTop: 24,
        alignItems: 'center',
    },
    linkText: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        color: Colors.light.textSecondary,
    },
    linkStrong: {
        color: Colors.light.primary,
        fontWeight: '700',
    },
    ticketFooter: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        alignItems: 'center',
    },
    folio: {
        fontFamily: Fonts.mono,
        fontSize: 9,
        letterSpacing: 1,
        color: Colors.light.textSecondary,
    },
});
