import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { PlaceSchedule } from '@/features/places/interface/places.interface';

const DIAS_SEMANA = ['', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

function formatTime(time: string | null): string {
    if (!time) return '';
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
}

type Props = {
    horarios: PlaceSchedule[];
};

export function ScheduleDisplay({ horarios }: Props) {
    if (horarios.length === 0) {
        return (
            <ThemedText type="small" themeColor="textSecondary">
                Sin horarios disponibles
            </ThemedText>
        );
    }

    const sorted = [...horarios].sort((a, b) => a.dia_semana - b.dia_semana);

    return (
        <ThemedView style={styles.container}>
            {sorted.map(schedule => (
                <ThemedView key={schedule.id} style={styles.row}>
                    <ThemedText type="small" style={styles.day}>
                        {DIAS_SEMANA[schedule.dia_semana]}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                        {formatTime(schedule.hora_apertura)} - {formatTime(schedule.hora_cierre)}
                    </ThemedText>
                </ThemedView>
            ))}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    day: {
        width: 100,
        fontWeight: '500',
    },
});
