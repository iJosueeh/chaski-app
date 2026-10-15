import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';
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

/**
 * Horarios de un destino en formato de boleto (Serie AX):
 * días en Inter y tramos horarios en IBM Plex Mono, separados por filete punteado.
 */
export function ScheduleDisplay({ horarios }: Props) {
    if (horarios.length === 0) {
        return (
            <Text style={[styles.empty, { color: Colors.light.textSecondary }]}>
                Sin horarios disponibles
            </Text>
        );
    }

    const sorted = [...horarios].sort((a, b) => a.dia_semana - b.dia_semana);

    return (
        <View style={styles.container}>
            {sorted.map((schedule, index) => (
                <View
                    key={schedule.id}
                    style={[
                        styles.row,
                        index < sorted.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: Colors.light.border,
                            borderStyle: 'dashed',
                        },
                    ]}
                >
                    <Text style={[styles.day, { color: Colors.light.brand }]}>
                        {DIAS_SEMANA[schedule.dia_semana]}
                    </Text>
                    <Text style={[styles.hours, { color: Colors.light.primary }]}>
                        {formatTime(schedule.hora_apertura)} - {formatTime(schedule.hora_cierre)}
                    </Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 0,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 7,
    },
    day: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        fontWeight: '600',
    },
    hours: {
        fontFamily: Fonts.mono,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    empty: {
        fontFamily: Fonts.sans,
        fontSize: 12.5,
        fontStyle: 'italic',
    },
});
