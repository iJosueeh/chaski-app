/**
 * Wizard — Paso 2 de 5: TIEMPO DISPONIBLE (completo, según Figma).
 *
 * Estructura del frame "Tiempo disponible (Modal Refinado)":
 * TOTAL DISPONIBLE (kicker) + dos relojes (HORA DE INICIO / HORA LÍMITE)
 * + chips de acceso rápido (2H/4H/LA TARDE) + duración calculada en vivo
 * + CTA CONTINUAR (deshabilitado si fin <= inicio).
 *
 * Lógica del usuario: chips como atajos; tocar un reloj abre el picker
 * nativo de Android para la opción propia. Duración = fin - inicio.
 */
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';

import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TocapuStrip,
  WizardButton,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';

/** Chips de duración: hora límite = hora de inicio + N minutos. */
const CHIPS = [
  { label: '2 HORAS', minutos: 120 },
  { label: '4 HORAS', minutos: 240 },
  { label: 'LA TARDE', minutos: 360 },
] as const;

function aHHMM(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function minutosDeCadena(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Reloj digital táctil (declarado FUERA del render — regla react-hooks). */
function Reloj({
  etiqueta,
  valor,
  colorPrimario,
  colorMarca,
  colorSecundario,
  onPress,
}: {
  etiqueta: string;
  valor: Date;
  colorPrimario: string;
  colorMarca: string;
  colorSecundario: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.reloj,
        { borderColor: colorMarca, backgroundColor: colorMarca === undefined ? undefined : undefined },
      ]}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button">
      <Text style={[styles.relojEtiqueta, { color: colorPrimario }]}>{etiqueta}</Text>
      <Text style={[styles.relojValor, { color: colorMarca }]}>{aHHMM(valor)}</Text>
      <View style={[styles.relojColon, { backgroundColor: colorSecundario }]} />
      <Text style={[styles.relojAjusta, { color: colorSecundario }]}>Toca para ajustar</Text>
    </TouchableOpacity>
  );
}

export default function WizardTiempo() {
  const theme = useTheme();
  const { setTiempo } = useWizard();

  const ahora = new Date();
  const [inicio, setInicio] = useState<Date>(ahora);
  const [fin, setFin] = useState<Date>(new Date(ahora.getTime() + 4 * 60 * 60 * 1000));
  const [chipActivo, setChipActivo] = useState<string | null>('4 HORAS');
  const [picker, setPicker] = useState<'inicio' | 'fin' | null>(null);
  const [error, setError] = useState('');

  const duracionMin = useMemo(() => {
    const ini = minutosDeCadena(aHHMM(inicio));
    let f = minutosDeCadena(aHHMM(fin));
    if (f <= ini) f += 24 * 60; // cruce de medianoche legítimo (23:00 → 02:00 = 3h)
    return f - ini;
  }, [inicio, fin]);
  const valido = duracionMin > 0 && duracionMin <= 24 * 60;
  const horas = Math.floor(duracionMin / 60);
  const mins = duracionMin % 60;

  const aplicarChip = (label: string, minutos: number) => {
    const nuevoFin = new Date(inicio.getTime() + minutos * 60 * 1000);
    setFin(nuevoFin);
    setChipActivo(label);
    setError('');
  };

  // v9 del picker: onValueChange(event, date) + onDismiss (botón CANCELAR).
  // Reemplaza onChange deprecated — sin chequeo manual de e.type.
  const alElegirHora = (campo: 'inicio' | 'fin') => (_e: DateTimePickerChangeEvent, date: Date) => {
    if (campo === 'inicio') {
      setInicio(date);
      setChipActivo(null);
    } else {
      setFin(date);
      setChipActivo(null);
    }
    setPicker(null); // cerrar el picker en Android también al elegir
    setError('');
  };

  const alCerrarPicker = () => {
    setPicker(null);
  };

  const seguir = () => {
    if (!valido) {
      setError('La hora límite debe ser mayor a la hora de inicio.');
      return;
    }
    setTiempo({
      minutos: duracionMin,
      horaInicio: aHHMM(inicio),
      horaFin: aHHMM(fin),
    });
    router.push('/wizard/presupuesto');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <WizardTopBar
          onBack={() => router.back()}
          onCancel={() => {
            router.dismissAll();
            router.back();
          }}
        />
        <TocapuStrip />
        <View style={styles.block}>
          <WizardHeading
            title="¿Cuánto tiempo tienes?"
            subtitle="Define hora de inicio y hora límite"
          />
        </View>

        {/* Kicker TOTAL DISPONIBLE */}
        <View style={styles.block}>
          <Text style={[styles.kicker, { color: theme.primary }]}>TOTAL DISPONIBLE</Text>
        </View>

        {/* Relojes */}
        <View style={styles.relojesRow}>
          <Reloj
            etiqueta="HORA DE INICIO"
            valor={inicio}
            colorPrimario={theme.primary}
            colorMarca={theme.brand}
            colorSecundario={theme.textSecondary}
            onPress={() => setPicker('inicio')}
          />
          <Reloj
            etiqueta="HORA LÍMITE"
            valor={fin}
            colorPrimario={theme.primary}
            colorMarca={theme.brand}
            colorSecundario={theme.textSecondary}
            onPress={() => setPicker('fin')}
          />
        </View>

        {/* Duración calculada */}
        <View style={styles.duracionRow}>
          <Text style={[styles.duracionTexto, { color: valido ? theme.brand : theme.carmine }]}>
            {valido ? `≈ ${horas}h ${mins}m de recorrido` : '⚠ La hora límite debe ser mayor'}
          </Text>
        </View>

        {/* Chips de acceso rápido */}
        <View style={styles.chipsRow}>
          <Text style={[styles.chipsLabel, { color: theme.primary }]}>ACCESO RÁPIDO:</Text>
          {CHIPS.map((c) => {
            const activo = chipActivo === c.label;
            return (
              <TouchableOpacity key={c.label} activeOpacity={0.8} onPress={() => aplicarChip(c.label, c.minutos)}>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: activo ? theme.brand : theme.surface,
                      borderColor: theme.brand,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: activo ? theme.surface : theme.brand },
                    ]}>
                    {c.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Error */}
        {error ? <Text style={[styles.error, { color: theme.carmine }]}>{error}</Text> : null}

        {/* CTA */}
        <View style={styles.btnWrap}>
          <WizardButton label="CONTINUAR" onPress={seguir} disabled={!valido} />
        </View>
      </ScrollView>

      {/* Picker nativo (opción propia del usuario) — API v9 */}
      {picker ? (
        <DateTimePicker
          value={picker === 'inicio' ? inicio : fin}
          mode="time"
          is24Hour
          onValueChange={alElegirHora(picker)}
          onDismiss={alCerrarPicker}
        />
      ) : null}

      <View style={[styles.footer, { backgroundColor: theme.background }]}>
        <StepIndicator step={2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  block: { paddingHorizontal: 20, paddingTop: 16 },
  kicker: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 10,
    letterSpacing: 2,
  },
  relojesRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  reloj: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 4,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  relojEtiqueta: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  relojValor: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 26,
  },
  relojColon: { width: 24, height: 2, opacity: 0.7 },
  relojAjusta: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 9,
  },
  duracionRow: { paddingHorizontal: 20, marginTop: 12, alignItems: 'center' },
  duracionTexto: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  chipsLabel: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 8,
    letterSpacing: 1,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: 'IBMPlexMono_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  error: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  btnWrap: { paddingHorizontal: 20, marginTop: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
});
