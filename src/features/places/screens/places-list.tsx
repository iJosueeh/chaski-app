import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { getActivePlaces } from '@/features/places/services/places.service';
import type { Place } from '@/features/places/interface/places.interface';
import { PriceRange } from '@/shared';

export function PlacesListScreen() {
    const theme = useTheme();
    const [places, setPlaces] = useState<Place[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadPlaces();
    }, []);

    const loadPlaces = async () => {
        setLoading(true);
        const { data, error: fetchError } = await getActivePlaces();
        if (fetchError) {
            setError(fetchError.message);
        } else if (data) {
            setPlaces(data);
        }
        setLoading(false);
    };

    const renderPlace = ({ item }: { item: Place }) => (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
            onPress={() => router.push(`/place/${item.id}` as any)}
        >
            <ThemedText type="default" style={styles.placeName}>
                {item.nombre}
            </ThemedText>

            {item.direccion && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.address}>
                    {item.direccion}
                </ThemedText>
            )}

            <ThemedView style={styles.chipsContainer}>
                {item.categorias.slice(0, 3).map(category => (
                    <ThemedView
                        key={category.id}
                        style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}
                    >
                        <ThemedText type="small" style={styles.chipText}>
                            {category.nombre}
                        </ThemedText>
                    </ThemedView>
                ))}
            </ThemedView>

            <ThemedView style={styles.budgetRow}>
                <PriceRange min={item.gasto_min} max={item.gasto_max} />
            </ThemedView>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <ThemedView style={styles.centered}>
                <ActivityIndicator size="large" />
            </ThemedView>
        );
    }

    if (error) {
        return (
            <ThemedView style={styles.centered}>
                <ThemedText type="default" style={styles.errorText}>{error}</ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="subtitle" style={styles.title}>
                Lugares
            </ThemedText>
            <FlatList
                data={places}
                keyExtractor={item => item.id}
                renderItem={renderPlace}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
                        No hay lugares disponibles
                    </ThemedText>
                }
            />
        </ThemedView>
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
    },
    title: {
        textAlign: 'center',
        paddingTop: 64,
        paddingBottom: 16,
    },
    list: {
        paddingHorizontal: 24,
        gap: 12,
        paddingBottom: 48,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    placeName: {
        fontWeight: '600',
    },
    address: {
        marginBottom: 4,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    chipText: {
        fontSize: 12,
    },
    budgetRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 4,
    },
    empty: {
        textAlign: 'center',
        marginTop: 48,
    },
    errorText: {
        color: '#e53935',
    },
});
