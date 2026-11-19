/**
 * Componente de Evolución Temporal para Reportes Administrativos (RF20 / CU09).
 *
 * Resuelve el problema del scroll infinito mediante:
 * 1. Gráfico interactivo compacto de barras duales (Solicitudes vs Expediciones)
 *    con scroll horizontal y altura fija.
 * 2. Inspector táctil para ver el desglose detallado de cualquier día tocando su columna.
 * 3. Tarjetas resumen de actividad diaria (Pico máximo, promedio diario).
 * 4. Pestaña de listado paginado/contraído con botón «Ver más / Ver menos»
 *    y selector de orden (Más recientes vs Cronológico).
 * 5. Iconografía profesional con @expo/vector-icons (sin emojis crudos).
 */

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts } from '@/constants/theme';
import type {
  AdminReportAgrupacion,
  AdminReportTimelinePoint,
} from '../interfaces/admin.interface';

interface AdminTimelineChartProps {
  evolucion: AdminReportTimelinePoint[];
  agrupacion?: AdminReportAgrupacion;
}

type ViewMode = 'grafico' | 'lista';
type OrderMode = 'desc' | 'asc';

const CHART_HEIGHT = 120;
const INITIAL_LIST_LIMIT = 5;

/** Formatea una fecha ISO o año-mes para la etiqueta compacta del eje X */
function formatShortDate(rawDate: string, agrupacion: AdminReportAgrupacion = 'dia'): string {
  if (!rawDate) return '';
  if (agrupacion === 'mes') {
    const parts = rawDate.split('-');
    if (parts.length === 2) {
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${monthNames[mIdx] ?? parts[1]} '${parts[0].slice(2)}`;
    }
    return rawDate;
  }

  // Por día: mostrar DD/MM
  const parts = rawDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return rawDate;
}

export function AdminTimelineChart({
  evolucion,
  agrupacion = 'dia',
}: AdminTimelineChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grafico');
  const [orderMode, setOrderMode] = useState<OrderMode>('desc');
  const [expandedList, setExpandedList] = useState<boolean>(false);
  const [selectedFecha, setSelectedFecha] = useState<string | null>(
    evolucion.length > 0 ? evolucion[evolucion.length - 1].fecha : null,
  );

  // Estadísticas y métricas de la serie temporal
  const stats = useMemo(() => {
    if (evolucion.length === 0) {
      return {
        maxVal: 1,
        totalSol: 0,
        totalExp: 0,
        promSol: '0.0',
        promExp: '0.0',
        picoPoint: null as AdminReportTimelinePoint | null,
      };
    }

    let maxVal = 1;
    let totalSol = 0;
    let totalExp = 0;
    let picoPoint = evolucion[0];
    let picoSum = 0;

    for (const pt of evolucion) {
      totalSol += pt.solicitudes;
      totalExp += pt.expediciones;
      const combined = pt.solicitudes + pt.expediciones;
      if (combined > picoSum) {
        picoSum = combined;
        picoPoint = pt;
      }
      if (pt.solicitudes > maxVal) maxVal = pt.solicitudes;
      if (pt.expediciones > maxVal) maxVal = pt.expediciones;
    }

    const count = evolucion.length;
    return {
      maxVal,
      totalSol,
      totalExp,
      promSol: (totalSol / count).toFixed(1),
      promExp: (totalExp / count).toFixed(1),
      picoPoint,
    };
  }, [evolucion]);

  // Punto actualmente seleccionado para inspección
  const activePoint = useMemo(() => {
    if (!selectedFecha) {
      return evolucion.length > 0 ? evolucion[evolucion.length - 1] : null;
    }
    return evolucion.find((p) => p.fecha === selectedFecha) ?? (evolucion[evolucion.length - 1] || null);
  }, [evolucion, selectedFecha]);

  // Lista ordenada y limitada para modo lista
  const displayList = useMemo(() => {
    const list = [...evolucion];
    if (orderMode === 'desc') {
      list.reverse();
    }
    if (expandedList) return list;
    return list.slice(0, INITIAL_LIST_LIMIT);
  }, [evolucion, orderMode, expandedList]);

  if (evolucion.length === 0) {
    return (
      <View style={styles.cardBox}>
        <Text style={styles.emptyText}>Sin datos para el período seleccionado.</Text>
      </View>
    );
  }

  return (
    <View style={styles.cardBox}>
      {/* 1. Header con Selector de Modo y Resumen Compacto */}
      <View style={styles.topControlRow}>
        <View style={styles.tabSelector}>
          <Pressable
            onPress={() => setViewMode('grafico')}
            style={[styles.tabButton, viewMode === 'grafico' && styles.tabButtonActive]}
            accessibilityRole="button"
            accessibilityLabel="Ver en modo gráfico"
            testID="timeline-mode-grafico"
          >
            <View style={styles.tabButtonContent}>
              <Ionicons
                name="bar-chart-outline"
                size={11}
                color={viewMode === 'grafico' ? '#FFFFFF' : Colors.light.textSecondary}
              />
              <Text style={[styles.tabText, viewMode === 'grafico' && styles.tabTextActive]}>
                TENDENCIA
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setViewMode('lista')}
            style={[styles.tabButton, viewMode === 'lista' && styles.tabButtonActive]}
            accessibilityRole="button"
            accessibilityLabel="Ver en modo lista detallada"
            testID="timeline-mode-lista"
          >
            <View style={styles.tabButtonContent}>
              <Ionicons
                name="list-outline"
                size={11}
                color={viewMode === 'lista' ? '#FFFFFF' : Colors.light.textSecondary}
              />
              <Text style={[styles.tabText, viewMode === 'lista' && styles.tabTextActive]}>
                DETALLE ({evolucion.length})
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Leyenda de Series */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.light.primary }]} />
            <Text style={styles.legendLabel}>Sol.</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.light.accent }]} />
            <Text style={styles.legendLabel}>Exp.</Text>
          </View>
        </View>
      </View>

      {/* 2. Micro-KPIs de la evolución */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>REGISTROS</Text>
          <Text style={styles.summaryValue}>
            {evolucion.length} {agrupacion === 'mes' ? 'meses' : 'días'}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>PROMEDIO DIARIO</Text>
          <Text style={styles.summaryValue}>
            {stats.promSol} sol · {stats.promExp} exp
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>PICO DEL PERÍODO</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {stats.picoPoint ? `${formatShortDate(stats.picoPoint.fecha, agrupacion)} (${stats.picoPoint.solicitudes + stats.picoPoint.expediciones})` : '—'}
          </Text>
        </View>
      </View>

      {/* 3. VISTA 1: Gráfico interactivo con scroll horizontal */}
      {viewMode === 'grafico' ? (
        <View style={styles.chartWrapper}>
          <View style={styles.chartCanvasRow}>
            {/* Eje Y de referencia */}
            <View style={styles.yAxis}>
              <Text style={styles.axisLabel}>{stats.maxVal}</Text>
              <Text style={styles.axisLabel}>{Math.round(stats.maxVal / 2)}</Text>
              <Text style={styles.axisLabel}>0</Text>
            </View>

            {/* Scroll horizontal de barras */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.barsScrollContent}
              testID="timeline-horizontal-scroll"
            >
              {evolucion.map((point) => {
                const isSelected = activePoint?.fecha === point.fecha;
                const solHeight = Math.max(3, Math.min((point.solicitudes / stats.maxVal) * CHART_HEIGHT, CHART_HEIGHT));
                const expHeight = Math.max(3, Math.min((point.expediciones / stats.maxVal) * CHART_HEIGHT, CHART_HEIGHT));

                return (
                  <Pressable
                    key={point.fecha}
                    onPress={() => setSelectedFecha(point.fecha)}
                    style={[styles.barColumn, isSelected && styles.barColumnSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={`Día ${point.fecha}: ${point.solicitudes} solicitudes, ${point.expediciones} expediciones`}
                  >
                    <View style={styles.barsContainer}>
                      <View style={styles.barSlot}>
                        <View
                          style={[
                            styles.vBar,
                            { height: solHeight, backgroundColor: Colors.light.primary },
                          ]}
                        />
                      </View>
                      <View style={styles.barSlot}>
                        <View
                          style={[
                            styles.vBar,
                            { height: expHeight, backgroundColor: Colors.light.accent },
                          ]}
                        />
                      </View>
                    </View>
                    <Text
                      style={[styles.barDateLabel, isSelected && styles.barDateLabelSelected]}
                      numberOfLines={1}
                    >
                      {formatShortDate(point.fecha, agrupacion)}
                    </Text>
                    {isSelected ? <View style={styles.activeIndicatorDot} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Inspector del día seleccionado */}
          {activePoint ? (
            <View style={styles.inspectorCard} testID="timeline-inspector-card">
              <View style={styles.inspectorHeader}>
                <View style={styles.inspectorHeaderLeft}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.light.brand} />
                  <Text style={styles.inspectorDate}>
                    {activePoint.fecha}
                  </Text>
                </View>
                <Text style={styles.inspectorBadge}>
                  {activePoint.expediciones > 0
                    ? `${((activePoint.completadas / activePoint.expediciones) * 100).toFixed(0)}% ÉXITO`
                    : 'SIN EXPEDICIÓN'}
                </Text>
              </View>

              <View style={styles.inspectorMetricsRow}>
                <View style={styles.inspectorMetricPill}>
                  <Text style={styles.inspectorPillLabel}>SOLICITUDES</Text>
                  <Text style={styles.inspectorPillVal}>{activePoint.solicitudes}</Text>
                </View>
                <View style={styles.inspectorMetricPill}>
                  <Text style={styles.inspectorPillLabel}>EXPEDICIONES</Text>
                  <Text style={styles.inspectorPillVal}>{activePoint.expediciones}</Text>
                </View>
                <View style={styles.inspectorStatusBox}>
                  <View style={styles.statusIconsRow}>
                    <View style={styles.statusIconItem}>
                      <Ionicons name="checkmark-circle" size={12} color="#2E7D32" />
                      <Text style={[styles.statusText, { color: '#2E7D32' }]}>{activePoint.completadas}</Text>
                    </View>
                    <View style={styles.statusIconItem}>
                      <Ionicons name="time" size={12} color="#A66D00" />
                      <Text style={[styles.statusText, { color: '#A66D00' }]}>{activePoint.parciales}</Text>
                    </View>
                    <View style={styles.statusIconItem}>
                      <Ionicons name="close-circle" size={12} color={Colors.light.carmine} />
                      <Text style={[styles.statusText, { color: Colors.light.carmine }]}>{activePoint.abandonadas}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 4. VISTA 2: Lista controlada con límite y expansión */}
      {viewMode === 'lista' ? (
        <View style={styles.listWrapper} testID="timeline-list-wrapper">
          {/* Ordenador */}
          <View style={styles.listFilterRow}>
            <Text style={styles.listInfoText}>
              Mostrando {displayList.length} de {evolucion.length} registros
            </Text>
            <Pressable
              onPress={() => setOrderMode((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              style={styles.orderToggleButton}
              accessibilityRole="button"
              accessibilityLabel="Cambiar orden cronológico"
            >
              <Ionicons name="swap-vertical-outline" size={11} color={Colors.light.primary} />
              <Text style={styles.orderToggleText}>
                {orderMode === 'desc' ? 'RECIENTES PRIMERO' : 'CRONOLÓGICO'}
              </Text>
            </Pressable>
          </View>

          {/* Filas */}
          {displayList.map((pt) => {
            const maxVal = Math.max(pt.solicitudes, pt.expediciones, 1);
            const solWidth = Math.max(4, Math.min((pt.solicitudes / maxVal) * 100, 100));
            const expWidth = Math.max(4, Math.min((pt.expediciones / maxVal) * 100, 100));

            return (
              <View key={pt.fecha} style={styles.listRow}>
                <View style={styles.listRowHeader}>
                  <Text style={styles.listRowDate}>{pt.fecha}</Text>
                  <Text style={styles.listRowDetails}>
                    <Text style={styles.bold}>{pt.solicitudes}</Text> sol · <Text style={styles.bold}>{pt.expediciones}</Text> exp (
                    <Text style={{ color: '#2E7D32' }}>✓{pt.completadas}</Text>{' '}
                    <Text style={{ color: '#A66D00' }}>~{pt.parciales}</Text>{' '}
                    <Text style={{ color: Colors.light.carmine }}>✗{pt.abandonadas}</Text>)
                  </Text>
                </View>
                <View style={styles.listRowBars}>
                  <View style={styles.listBarTrack}>
                    <View
                      style={[
                        styles.listBarProgress,
                        { width: `${solWidth}%`, backgroundColor: Colors.light.primary },
                      ]}
                    />
                  </View>
                  <View style={styles.listBarTrack}>
                    <View
                      style={[
                        styles.listBarProgress,
                        { width: `${expWidth}%`, backgroundColor: Colors.light.accent },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}

          {/* Botón Ver Más / Ver Menos si hay más del límite */}
          {evolucion.length > INITIAL_LIST_LIMIT ? (
            <Pressable
              onPress={() => setExpandedList((prev) => !prev)}
              style={styles.expandButton}
              accessibilityRole="button"
              accessibilityLabel={expandedList ? 'Ver menos días' : 'Ver todos los días'}
              testID="timeline-toggle-expand"
            >
              <Ionicons
                name={expandedList ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={13}
                color={Colors.light.primary}
              />
              <Text style={styles.expandButtonText}>
                {expandedList
                  ? 'MOSTRAR MENOS'
                  : `VER TODOS LOS ${evolucion.length} REGISTROS`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardBox: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingVertical: 14,
  },
  topControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  tabButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  tabButtonActive: {
    backgroundColor: Colors.light.primary,
  },
  tabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.light.textSecondary,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FAF6EF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 2,
  },
  summaryLabel: {
    fontFamily: Fonts.mono,
    fontSize: 7.5,
    color: Colors.light.textSecondary,
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  chartWrapper: {
    marginTop: 4,
  },
  chartCanvasRow: {
    flexDirection: 'row',
    height: CHART_HEIGHT + 36,
    alignItems: 'flex-end',
  },
  yAxis: {
    width: 24,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
    marginBottom: 20,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
  },
  axisLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.light.textSecondary,
  },
  barsScrollContent: {
    paddingHorizontal: 8,
    alignItems: 'flex-end',
    gap: 10,
  },
  barColumn: {
    alignItems: 'center',
    width: 34,
    paddingVertical: 4,
    borderRadius: 4,
  },
  barColumnSelected: {
    backgroundColor: '#FAF5ED',
    borderWidth: 1,
    borderColor: Colors.light.accent,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 3,
  },
  barSlot: {
    width: 10,
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  vBar: {
    width: '100%',
    borderRadius: 3,
  },
  barDateLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  barDateLabelSelected: {
    color: Colors.light.text,
    fontWeight: '700',
  },
  activeIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.accent,
    marginTop: 2,
  },
  inspectorCard: {
    marginTop: 10,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    padding: 10,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingBottom: 6,
    marginBottom: 8,
  },
  inspectorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inspectorDate: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.text,
  },
  inspectorBadge: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: Colors.light.primary,
    backgroundColor: '#FAF6EF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  inspectorMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inspectorMetricPill: {
    backgroundColor: Colors.light.backgroundElement,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  inspectorPillLabel: {
    fontFamily: Fonts.mono,
    fontSize: 7,
    color: Colors.light.textSecondary,
  },
  inspectorPillVal: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
  },
  inspectorStatusBox: {
    flex: 1,
    justifyContent: 'center',
  },
  statusIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  statusIconItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
  },
  listWrapper: {
    marginTop: 4,
  },
  listFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  listInfoText: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    color: Colors.light.textSecondary,
  },
  orderToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  orderToggleText: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  listRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  listRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listRowDate: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.text,
  },
  listRowDetails: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: Colors.light.textSecondary,
  },
  bold: {
    fontWeight: '700',
    color: Colors.light.text,
  },
  listRowBars: {
    gap: 2,
  },
  listBarTrack: {
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  listBarProgress: {
    height: '100%',
    borderRadius: 2,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
  },
  expandButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.primary,
    letterSpacing: 0.5,
  },
});
