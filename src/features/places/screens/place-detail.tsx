import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { getPlaceById } from '@/features/places/services/places.service';
import type { Place } from '@/features/places/interface/places.interface';
import { ScheduleDisplay, PriceRange } from '@/shared';

export function PlaceDetailScreen() {
    const theme = useTheme();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [place, setPlace] = useState<Place | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        getPlaceById(id)
            .then(({ data, error: fetchError }) => {
                if (cancelled) return;
                if (fetchError) {
                    setError(fetchError.message);
                } else if (data) {
                    setPlace(data);
                }
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [id]);

    if (loading) {
        return (
            <ThemedView style={styles.centered}>
                <ActivityIndicator size="large" />
            </ThemedView>
        );
    }

    if (error || !place) {
        return (
            <ThemedView style={styles.centered}>
                <ThemedText type="default" style={styles.errorText}>
                    {error || 'Lugar no encontrado'}
                </ThemedText>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <ThemedText type="default" style={styles.backButtonText}>Volver</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.background }]}
            contentContainerStyle={styles.content}
        >
            <ThemedText type="subtitle" style={styles.title}>
                {place.nombre}
            </ThemedText>

            {place.descripcion && (
                <ThemedText type="default" themeColor="textSecondary">
                    {place.descripcion}
                </ThemedText>
            )}

            {place.direccion && (
                <ThemedView style={styles.section}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                        Direccion
                    </ThemedText>
                    <ThemedText type="default">{place.direccion}</ThemedText>
                </ThemedView>
            )}

            <ThemedView style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Categorias
                </ThemedText>
                <ThemedView style={styles.chipsContainer}>
                    {place.categorias.length > 0 ? (
                        place.categorias.map(category => (
                            <ThemedView
                                key={category.id}
                                style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                            >
                                <ThemedText type="smallBold">{category.nombre}</ThemedText>
                            </ThemedView>
                        ))
                    ) : (
                        <ThemedText type="small" themeColor="textSecondary">Sin categorias</ThemedText>
                    )}
                </ThemedView>
            </ThemedView>

            <ThemedView style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Etiquetas
                </ThemedText>
                <ThemedView style={styles.chipsContainer}>
                    {place.etiquetas.length > 0 ? (
                        place.etiquetas.map(tag => (
                            <ThemedView
                                key={tag.id}
                                style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
                            >
                                <ThemedText type="smallBold">{tag.nombre}</ThemedText>
                            </ThemedView>
                        ))
                    ) : (
                        <ThemedText type="small" themeColor="textSecondary">Sin etiquetas</ThemedText>
                    )}
                </ThemedView>
            </ThemedView>

            <ThemedView style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    Presupuesto
                </ThemedText>
                <PriceRange min={place.gasto_min} max={place.gasto_max} />
            </ThemedView>

            {place.duracion_sugerida_min != null && (
                <ThemedView style={styles.section}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                        Duracion sugerida
                    </ThemedText>
                    <ThemedText type="default">{place.duracion_sugerida_min} min</ThemedText>
                </ThemedView>
            )}

            {place.horarios.length > 0 && (
                <ThemedView style={styles.section}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                        Horarios
                    </ThemedText>
                    <ScheduleDisplay horarios={place.horarios} />
                </ThemedView>
            )}

            <ThemedView style={styles.footer}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <ThemedText type="default" style={styles.backButtonText}>Volver</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    content: {
        padding: 24,
        gap: 20,
    },
    title: {
        textAlign: 'center',
    },
    section: {
        gap: 8,
    },
    label: {
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    footer: {
        alignItems: 'center',
        marginTop: 16,
    },
    backButton: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        backgroundColor: '#3c87f7',
        borderRadius: 8,
    },
    backButtonText: {
        color: '#ffffff',
    },
    errorText: {
        color: '#e53935',
    },
});
