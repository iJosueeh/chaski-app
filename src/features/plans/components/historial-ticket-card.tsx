/**
 * HistorialTicketCard — Boleto cultural del archivo histórico de Chaski (Serie AX).
 *
 * Cada boleto representa una solicitud de planificación registrada en
 * `solicitudes_plan` (Supabase). Si la solicitud tiene expedición ejecutada
 * (embed de `expediciones_plan`), el boleto muestra estado, avance de paradas
 * visitadas e itinerario desde el snapshot del plan; si no, presenta los
 * datos registrados de la solicitud, sin inventar métricas inexistentes.
 *
 * Características de diseño:
 * - Paleta clara Serie AX: pergamino #FAF5EE, marfil #FFFDF9, tinta #4A2E18,
 *   terracota #9C3E1B, borgoña #7D2935, dorado ocre #D4AF37.
 * - Perforación transversal con muescas laterales (notches) y línea discontinua de corte.
 * - Sello circular de archivo andino según estado (SELLADO / PARCIAL / CANCEL).
 * - Folio estable de serie con numeración secuencial.
 * - Resumen honesto de datos: fecha, duración y costo o presupuesto.
 * - Botón accesible hacia el detalle de la solicitud.
 */
import { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Colors, Fonts } from '@/constants/theme';
import type { SolicitudHistorialEntry } from '@/features/plans/interfaces/solicitudes-plan.interface';
import {
  formatFolioNumber,
  formatHistoryCost,
  formatHistoryDate,
  formatHistoryStatusLabel,
  formatMovilidadSolicitud,
  formatPresupuestoSolicitud,
  formatSolicitudDuracion,
  formatSolicitudHorario,
  formatSolicitudTitulo,
  formatTipoPuntoFinal,
  formatTotalDuration,
} from '@/features/plans/utils/historial-formatters';

interface HistorialTicketCardProps {
  entry: SolicitudHistorialEntry;
  indexFromEnd: number;
}

const MAX_VISIBLE_STOPS = 3;

const palette = Colors.light;

export function HistorialTicketCard({ entry, indexFromEnd }: HistorialTicketCardProps) {
  const expedicion = entry.expedicion ?? null;
  const snapshot = expedicion?.plan_snapshot ?? null;
  const estado = expedicion?.estado_expedicion ?? null;
  const paradas = snapshot?.paradas ?? [];
  const visitadas = expedicion?.paradas_visitadas ?? [];
  const totalParadas = paradas.length;

  const hasManyStops = totalParadas > MAX_VISIBLE_STOPS;
  const [expanded, setExpanded] = useState(!hasManyStops);

  const folio = formatFolioNumber(indexFromEnd, entry.id);
  const fecha = formatHistoryDate(expedicion?.completado_en ?? entry.fecha_hora_inicio);
  const duracion =
    expedicion && snapshot
      ? formatTotalDuration(snapshot.duracion_total_min)
      : formatSolicitudDuracion(entry.fecha_hora_inicio, entry.fecha_hora_fin);
  const presupuesto = formatPresupuestoSolicitud(entry.gasto_min, entry.gasto_max);
  const gastoReferencia =
    expedicion && snapshot ? formatHistoryCost(snapshot.costo_total) : presupuesto;
  const horario = formatSolicitudHorario(entry.fecha_hora_inicio, entry.fecha_hora_fin);
  const titulo = formatSolicitudTitulo(entry.inicio_descripcion);
  const movilidad = formatMovilidadSolicitud(entry.movilidad);
  const puntoFinal = formatTipoPuntoFinal(entry.tipo_punto_final, entry.final_descripcion);
  const partida = entry.inicio_descripcion ?? 'Ubicación seleccionada';
  const categorias = entry.categorias ?? [];

  const badgeText =
    estado === 'COMPLETADA'
      ? 'SERIE AX · COMPLETADA'
      : estado === 'PARCIAL'
        ? `SERIE AX · PARCIAL (${visitadas.length}/${totalParadas})`
        : estado === 'ABANDONADA'
          ? 'SERIE AX · ABANDONADA'
          : 'SERIE AX · SOLICITUD';

  const stamp =
    estado === 'COMPLETADA'
      ? { glyph: '✓', text: 'SELLADO', color: palette.primary }
      : estado === 'PARCIAL'
        ? { glyph: '!', text: 'PARCIAL', color: palette.burgundy }
        : estado === 'ABANDONADA'
          ? { glyph: '✕', text: 'CANCEL', color: palette.textSecondary }
          : { glyph: '✓', text: 'ARCHIVADO', color: palette.brand };

  const footerText =
    estado === 'COMPLETADA'
      ? 'ARCHIVO HISTÓRICO CHASKI · EXPEDICIÓN SELLADA'
      : estado === 'PARCIAL'
        ? 'ARCHIVO HISTÓRICO CHASKI · EXPEDICIÓN PARCIAL'
        : estado === 'ABANDONADA'
          ? 'ARCHIVO HISTÓRICO CHASKI · EXPEDICIÓN INTERRUMPIDA'
          : 'ARCHIVO HISTÓRICO CHASKI · SOLICITUD REGISTRADA';

  const detalleRows = [
    { label: 'HORARIO', value: horario },
    { label: 'PARTIDA', value: partida },
    { label: 'MOVILIDAD', value: movilidad },
    { label: 'PUNTO FINAL', value: puntoFinal },
    ...(categorias.length > 0 ? [{ label: 'CATEGORÍAS', value: categorias.join(' · ') }] : []),
  ];

  const paradasVisibles = hasManyStops && !expanded ? paradas.slice(0, 2) : paradas;

  const handleOpenDetail = () => {
    router.push({
      pathname: '/plan/detalle',
      params: {
        solicitud: JSON.stringify(entry),
        modo: 'solicitud',
      },
    });
  };

  const accessibilityLabel = expedicion
    ? `Boleto de expedición: ${titulo}, estado ${estado ?? ''}, sellado el ${fecha}, ${visitadas.length} de ${totalParadas} paradas.`
    : `Solicitud de ruta: ${titulo}, expedición el ${fecha}, horario ${horario}, presupuesto ${presupuesto}.`;

  return (
    <View
      style={[
        styles.ticketCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Franja superior decorativa */}
      <View style={[styles.topAccent, { backgroundColor: palette.accent }]} />

      {/* Cabecera del boleto: Folio, Serie y Sello de archivo */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.badgeSerie,
              {
                backgroundColor: palette.backgroundElement,
                borderColor: estado === 'COMPLETADA' ? palette.accent : palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeSerieText,
                { color: estado === 'ABANDONADA' ? palette.burgundy : palette.brand },
              ]}
            >
              {badgeText}
            </Text>
          </View>
          <Text style={[styles.folioText, { color: palette.textSecondary }]}>
            {folio}
          </Text>
        </View>

        {/* Sello de archivo cultural */}
        <View
          style={[
            styles.stampCircle,
            {
              borderColor: stamp.color,
              backgroundColor: palette.backgroundElement,
            },
          ]}
          accessible={false}
        >
          <Text style={[styles.stampCheck, { color: stamp.color }]}>{stamp.glyph}</Text>
          <Text style={[styles.stampText, { color: stamp.color }]}>{stamp.text}</Text>
        </View>
      </View>

      {/* Título y afinidades de la solicitud */}
      <View style={styles.titleSection}>
        <Text style={[styles.titulo, { color: palette.brand }]} numberOfLines={2}>
          {titulo}
        </Text>
        {categorias.length > 0 && (
          <Text style={[styles.descripcion, { color: palette.textSecondary }]} numberOfLines={2}>
            {categorias.join(' · ')}
          </Text>
        )}
      </View>

      {/* Cuadrícula de metadatos del viaje (Fecha, Duración, Costo/Presupuesto) */}
      <View style={[styles.metaGrid, { backgroundColor: palette.backgroundElement, borderColor: palette.border }]}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>EXPEDICIÓN</Text>
          <Text style={[styles.metaValue, { color: palette.brand }]}>{fecha}</Text>
        </View>
        <View style={[styles.metaDivider, { backgroundColor: palette.border }]} />
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>TIEMPO</Text>
          <Text style={[styles.metaValue, { color: palette.brand }]}>{duracion}</Text>
        </View>
        <View style={[styles.metaDivider, { backgroundColor: palette.border }]} />
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>
            {expedicion ? 'GASTO REF.' : 'PRESUPUESTO'}
          </Text>
          <Text style={[styles.metaValue, { color: palette.burgundy }]}>{gastoReferencia}</Text>
        </View>
      </View>

      {/* Perforación de boleto (muescas semicirculares y línea punteada) */}
      <View style={styles.perforationWrapper} accessible={false}>
        <View style={[styles.notchLeft, { backgroundColor: palette.background }]} />
        <View style={[styles.perforationLine, { borderColor: palette.border }]} />
        <View style={[styles.notchRight, { backgroundColor: palette.background }]} />
      </View>

      {expedicion && snapshot ? (
        /* Itinerario ejecutado con estado de paradas (desde el snapshot del plan) */
        <View style={styles.datosSection}>
          <View style={styles.paradasHeaderRow}>
            <Text style={[styles.datosKicker, { color: palette.primary }]}>
              {formatHistoryStatusLabel(
                expedicion.estado_expedicion,
                visitadas.length,
                totalParadas,
              ).toUpperCase()}
            </Text>
            {hasManyStops && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpanded((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Mostrar menos paradas' : 'Mostrar todas las paradas'}
              >
                <Text style={[styles.toggleStopsText, { color: palette.brand }]}>
                  {expanded ? 'MENOS −' : `TODAS (${totalParadas}) +`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.datosList}>
            {paradasVisibles.map((parada) => {
              const isVisited = visitadas.includes(parada.orden);
              return (
                <View key={parada.place?.id ?? `stop-${parada.orden}`} style={styles.paradaRow}>
                  <View
                    style={[
                      styles.paradaDot,
                      {
                        backgroundColor: isVisited ? palette.primary : palette.backgroundElement,
                        borderColor: isVisited ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.paradaDotText,
                        { color: isVisited ? palette.surface : palette.brand },
                      ]}
                    >
                      {isVisited ? '✓' : parada.orden}
                    </Text>
                  </View>
                  <View style={styles.paradaInfo}>
                    <Text style={[styles.paradaNombre, { color: palette.brand }]} numberOfLines={1}>
                      {parada.place?.nombre ?? `Parada ${parada.orden}`}
                    </Text>
                    <Text
                      style={[
                        styles.paradaHora,
                        { color: isVisited ? palette.brand : palette.textSecondary },
                      ]}
                    >
                      {isVisited ? `✓ ${parada.llegada}` : 'PENDIENTE'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        /* Datos registrados de la solicitud (sin expedición ejecutada) */
        <View style={styles.datosSection}>
          <Text style={[styles.datosKicker, { color: palette.primary }]}>
            DATOS DE LA SOLICITUD
          </Text>
          <View style={styles.datosList}>
            {detalleRows.map((row) => (
              <View key={row.label} style={styles.datosRow}>
                <Text style={[styles.datosLabel, { color: palette.textSecondary }]}>
                  {row.label}
                </Text>
                <Text style={[styles.datosValue, { color: palette.brand }]} numberOfLines={2}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Botón táctil accesible para abrir detalle de la solicitud */}
      <View style={[styles.actionWrap, { borderTopColor: palette.border }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleOpenDetail}
          style={styles.openDetailBtn}
          accessibilityRole="button"
          accessibilityLabel={`Consultar detalle de la solicitud ${titulo}`}
        >
          <Text style={[styles.openDetailBtnText, { color: palette.primary }]}>
            CONSULTAR DETALLE DE SOLICITUD ↗
          </Text>
        </TouchableOpacity>
      </View>

      {/* Micro-sello de archivo al pie */}
      <View style={[styles.ticketFooter, { borderTopColor: palette.border }]}>
        <Text style={[styles.footerArchiveText, { color: palette.textSecondary }]}>
          {footerText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticketCard: {
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: palette.brand,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  topAccent: {
    height: 4,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  badgeSerie: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 3,
    borderWidth: 1,
    marginBottom: 4,
  },
  badgeSerieText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  folioText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  stampCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  stampCheck: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  stampText: {
    fontFamily: Fonts.mono,
    fontSize: 6.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  titulo: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  descripcion: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  metaGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  metaItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  metaDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 8,
  },
  metaLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '600',
  },
  perforationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  notchLeft: {
    width: 12,
    height: 20,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  perforationLine: {
    flex: 1,
    height: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 4,
  },
  notchRight: {
    width: 12,
    height: 20,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  datosSection: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  datosKicker: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  paradasHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  toggleStopsText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  datosList: {
    gap: 8,
  },
  datosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  datosLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  datosValue: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  paradaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paradaDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paradaDotText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
  },
  paradaInfo: {
    flex: 1,
  },
  paradaNombre: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  paradaHora: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    marginTop: 1,
  },
  actionWrap: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  openDetailBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  openDetailBtnText: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  ticketFooter: {
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerArchiveText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
  },
});
