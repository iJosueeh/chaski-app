/**
 * Wizard — Paso 2 de 5: TIEMPO DISPONIBLE (Serie AX).
 *
 * Estructura del frame "Tiempo disponible":
 * TOTAL DISPONIBLE + duración calculada en vivo + dos relojes
 * (HORA DE INICIO / HORA LÍMITE, con «MAÑANA» si la límite cae al día
 * siguiente) + chips de acceso rápido (2 HORAS / 4 HORAS / LA TARDE)
 * + CTA CONTINUAR (deshabilitado si la duración resultante es 0).
 *
 * Cálculo único del intervalo (`utils/wizard-time`): presets, validación,
 * CTA y datos enviados al contexto derivan del mismo cálculo. La hora límite
 * anterior a la de inicio se interpreta como el día siguiente, en línea con
 * lo que ya asume `solicitudes-plan.service` al construir la solicitud.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@/components/ui/date-time-picker';

import { Colors, Fonts } from '@/constants/theme';
import { useWizard } from '@/features/wizard/context/wizard-context';
import {
  StepIndicator,
  TocapuStrip,
  WizardButton,
  WizardHeading,
  WizardTopBar,
} from '@/features/wizard/components/wizard-ui';
import { safeBackWizard, safeCancelWizard } from '@/features/wizard/utils/wizard-navigation';
import {
  cruzaMedianoche,
  duracionEntreHoras,
  esIntervaloValido,
  minutoDelDia,
  minutosAHora,
  parseHoraAMinutos,
} from '@/features/wizard/utils/wizard-time';

const palette = Colors.light;

/** Chips de duración: hora límite = hora de inicio + N minutos. */
const CHIPS = [
  { label: '2 HORAS', minutos: 120 },
  { label: '4 HORAS', minutos: 240 },
  { label: 'LA TARDE', minutos: 360 },
] as const;

/** Reloj digital táctil Serie AX */
function Reloj({
  etiqueta,
  hhmm,
  nota,
  onPress,
}: {
  etiqueta: string;
  hhmm: string;
  /** Nota bajo el valor, p. ej. «MAÑANA» cuando cruza la medianoche. */
  nota?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta}: ${hhmm}${nota ? `, ${nota}` : ''}. Toca para cambiar la hora.`}
      style={[styles.reloj, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <Text style={[styles.relojEtiqueta, { color: palette.primary }]}>{etiqueta}</Text>
      <Text style={[styles.relojValor, { color: palette.brand }]}>{hhmm}</Text>
      {/* Ranura reservada siempre (vacía si no hay nota) para alinear ambas tarjetas */}
      <Text style={[styles.relojNota, { color: palette.primary }]}>{nota ?? ''}</Text>
      <View style={[styles.relojColon, { backgroundColor: palette.accent }]} />
      <Text style={[styles.relojAjusta, { color: palette.textSecondary }]}>
        Toca para ajustar
      </Text>
    </TouchableOpacity>
  );
}

export default function WizardTiempo() {
  const insets = useSafeAreaInsets();
  const { request, setTiempo } = useWizard();

  /** Hora de inicio inicial: si no hay en context, ahora redondeado a los próximos 15m. */
  const inicioInicial = useMemo<Date>(() => {
    const inicioGuardado = parseHoraAMinutos(request.horaInicio);
    if (inicioGuardado !== null) {
      const d = new Date();
      d.setHours(Math.floor(inicioGuardado / 60), inicioGuardado % 60, 0, 0);
      return d;
    }
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    return d;
  }, [request.horaInicio]);

  /** Hora límite inicial: inicio + minutosTotales (default 240 = 4h). */
  const finInicial = useMemo<Date>(() => {
    const finGuardado = parseHoraAMinutos(request.horaFin);
    if (finGuardado !== null) {
      const d = new Date();
      d.setHours(Math.floor(finGuardado / 60), finGuardado % 60, 0, 0);
      // Si la hora límite es anterior a la de inicio, corresponde al día siguiente.
      if (finGuardado < minutoDelDia(inicioInicial)) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }
    const min = request.minutosTotales ?? 240;
    return new Date(inicioInicial.getTime() + min * 60000);
  }, [request.horaFin, request.minutosTotales, inicioInicial]);

  const [inicio, setInicio] = useState<Date>(inicioInicial);
  const [fin, setFin] = useState<Date>(finInicial);
  const [picker, setPicker] = useState<'inicio' | 'fin' | null>(null);

  /** Cálculo único del intervalo: presets, validación, CTA y envío lo comparten. */
  const inicioMin = minutoDelDia(inicio);
  const finMin = minutoDelDia(fin);
  const duracionMin = duracionEntreHoras(inicioMin, finMin);
  const esDeManana = cruzaMedianoche(inicioMin, finMin);
  const valido = esIntervaloValido(duracionMin);

  /** Chip coherente con el intervalo restaurado del contexto (null si no coincide). */
  const [chipActivo, setChipActivo] = useState<string | null>(
    () => CHIPS.find((c) => c.minutos === duracionMin)?.label ?? null,
  );

  const horas = Math.floor(duracionMin / 60);
  const mins = duracionMin % 60;
  const duracionTexto = valido ? `${horas}h ${String(mins).padStart(2, '0')}m` : '—';

  /** Atajo: hora límite = hora de inicio + N minutos (cruza medianoche si hace falta). */
  const aplicarChip = (label: string, minutos: number) => {
    setChipActivo(label);
    setFin(new Date(inicio.getTime() + minutos * 60000));
  };

  /** Al cambiar la hora en el picker nativo (onValueChange). */
  const alElegirHora = (tipo: 'inicio' | 'fin') => (_event: DateTimePickerChangeEvent, date: Date) => {
    if (tipo === 'inicio') {
      setInicio(date);
      const chip = CHIPS.find((c) => c.label === chipActivo);
      if (chip) {
        setFin(new Date(date.getTime() + chip.minutos * 60000));
      }
    } else {
      setFin(date);
      setChipActivo(null);
    }
    setPicker(null);
  };

  const alCerrarPicker = () => {
    setPicker(null);
  };

  const seguir = () => {
    if (!valido) {
      return;
    }
    // Mismos valores que la UI muestra: minutos e «HH:MM» derivados del cálculo único.
    setTiempo({
      minutos: duracionMin,
      horaInicio: minutosAHora(inicioMin),
      horaFin: minutosAHora(finMin),
    });
    router.push('/wizard/presupuesto');
  };

  return (
    <View style={[styles.canvas, { backgroundColor: palette.background }]}>
      <WizardTopBar
        onBack={() => safeBackWizard('/wizard/ubicacion')}
        onCancel={safeCancelWizard}
      />
      <TocapuStrip />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.block}>
          <WizardHeading
            title="¿Cuánto tiempo tienes?"
            subtitle="Define hora de inicio y hora límite"
          />
        </View>

        {/* Kicker TOTAL DISPONIBLE + duración calculada en vivo */}
        <View style={styles.block}>
          <View style={styles.kickerRow}>
            <Text style={[styles.kicker, { color: palette.primary }]}>TOTAL DISPONIBLE</Text>
            <Text
              style={[styles.duracionValor, { color: valido ? palette.brand : palette.burgundy }]}
            >
              {valido ? `≈ ${duracionTexto}` : '—'}
            </Text>
          </View>
        </View>

        {/* Relojes */}
        <View style={styles.relojesRow}>
          <Reloj
            etiqueta="HORA DE INICIO"
            hhmm={minutosAHora(inicioMin)}
            onPress={() => setPicker('inicio')}
          />
          <Reloj
            etiqueta="HORA LÍMITE"
            hhmm={minutosAHora(finMin)}
            nota={esDeManana ? 'MAÑANA' : undefined}
            onPress={() => setPicker('fin')}
          />
        </View>

        {/* Aviso de intervalo inválido (duración 0: misma hora) */}
        {!valido ? (
          <View
            style={[
              styles.avisoRow,
              { backgroundColor: palette.surface, borderColor: palette.burgundy },
            ]}
          >
            <Text style={[styles.avisoTexto, { color: palette.burgundy }]}>
              ⚠ La hora límite es igual a la hora de inicio: ajústala para continuar.
            </Text>
          </View>
        ) : null}

        {/* Chips de acceso rápido */}
        <View style={styles.chipsRow}>
          <Text style={[styles.chipsLabel, { color: palette.primary }]}>RITMO SUGERIDO:</Text>
          <View style={styles.chipsGroup}>
            {CHIPS.map((c) => {
              const activo = chipActivo === c.label;
              return (
                <TouchableOpacity
                  key={c.label}
                  activeOpacity={0.8}
                  onPress={() => aplicarChip(c.label, c.minutos)}
                  accessibilityRole="button"
                  accessibilityLabel={`Atajo de ${c.label}`}
                >
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: activo ? palette.brand : palette.surface,
                        borderColor: activo ? palette.brand : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: activo ? palette.surface : palette.brand },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CTA */}
        <View style={styles.btnWrap}>
          <WizardButton label="CONTINUAR" onPress={seguir} disabled={!valido} />
        </View>
      </ScrollView>

      {/* Picker nativo */}
      {picker ? (
        <DateTimePicker
          value={picker === 'inicio' ? inicio : fin}
          mode="time"
          is24Hour
          onValueChange={alElegirHora(picker)}
          onDismiss={alCerrarPicker}
        />
      ) : null}

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.background,
            paddingBottom: Math.max(insets.bottom, 12) + 6,
          },
        ]}
      >
        <StepIndicator step={2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  scrollContent: { paddingBottom: 24, gap: 12 },
  block: { paddingHorizontal: 20 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2,
  },
  duracionValor: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  relojesRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  reloj: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    gap: 3,
  },
  relojEtiqueta: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  relojValor: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    fontWeight: '700',
  },
  relojNota: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  relojColon: { width: 20, height: 2, opacity: 0.7, marginVertical: 2 },
  relojAjusta: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
  },
  avisoRow: {
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
  },
  avisoTexto: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipsRow: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chipsLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  chipsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnWrap: { paddingHorizontal: 20, marginTop: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 6 },
});
