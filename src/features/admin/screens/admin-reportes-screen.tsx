/**
 * Pantalla de Reportes y Estadísticas Administrativas (RF20 / CU09).
 *
 * Muestra KPIs de rendimiento, tasas de finalización y adopción, rankings de
 * categorías y destinos (incluidos vs. visitados), y evolución temporal con
 * filtros de período (7d, 30d, 90d, histórico y personalizado).
 *
 * Incluye descarga directa e impresión de reporte oficial en PDF con identidad Serie AX
 * e iconografía vectorial profesional (@expo/vector-icons).
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AndeanTocapuDivider } from '@/components/andean-tocapu-divider';
import { Colors, Fonts } from '@/constants/theme';

import { AdminTimelineChart } from '../components/admin-timeline-chart';
import { useAdminReports } from '../hooks/use-admin-reports';
import type {
  AdminReportItemRanking,
  AdminReportPeriodo,
} from '../interfaces/admin.interface';
import {
  downloadAdminReportPdf,
  printAdminReportPdf,
} from '../services/admin-pdf.service';

interface KpiTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
}

function KpiTile({ label, value, subtext, highlight }: KpiTileProps) {
  return (
    <View style={[styles.kpiTile, highlight && styles.kpiTileHighlight]}>
      <Text style={[styles.kpiValue, highlight && styles.kpiValueHighlight]}>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      {subtext ? <Text style={styles.kpiSubtext}>{subtext}</Text> : null}
    </View>
  );
}

interface RankingBarProps {
  item: AdminReportItemRanking;
  index: number;
  barColor?: string;
}

function RankingBar({ item, index, barColor = Colors.light.accent }: RankingBarProps) {
  const clampedWidth = Math.max(3, Math.min(item.porcentaje, 100));

  return (
    <View style={styles.rankingRow}>
      <View style={styles.rankingHeader}>
        <Text style={styles.rankingName} numberOfLines={1}>
          {index + 1}. {item.nombre}
        </Text>
        <Text style={styles.rankingNumbers}>
          {item.total} ({item.porcentaje.toFixed(1)}%)
        </Text>
      </View>
      <View style={styles.rankingTrack}>
        <View
          style={[
            styles.rankingProgress,
            { width: `${clampedWidth}%`, backgroundColor: barColor },
          ]}
        />
      </View>
    </View>
  );
}

export function AdminReportesScreen() {
  const insets = useSafeAreaInsets();
  const {
    reports,
    loading,
    error,
    periodo,
    setPeriodo,
    setRangoPersonalizado,
    reload,
  } = useAdminReports('30d');

  const [inputDesde, setInputDesde] = useState<string>('');
  const [inputHasta, setInputHasta] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState<boolean>(false);
  const [pdfPrinting, setPdfPrinting] = useState<boolean>(false);

  const handleApplyCustom = useCallback(() => {
    setInputError(null);
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(inputDesde.trim()) || !regex.test(inputHasta.trim())) {
      setInputError('Formato inválido. Usa AAAA-MM-DD (ej: 2026-10-01).');
      return;
    }
    if (inputDesde > inputHasta) {
      setInputError('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    setRangoPersonalizado(inputDesde.trim(), inputHasta.trim());
  }, [inputDesde, inputHasta, setRangoPersonalizado]);

  // Descarga directa del archivo PDF en el almacenamiento local
  const handleDownloadPdf = useCallback(async () => {
    if (!reports) return;
    setPdfDownloading(true);
    try {
      const res = await downloadAdminReportPdf(reports, {
        titulo: `REPORTE ESTADÍSTICO - SERIE AX (${periodo.toUpperCase()})`,
      });
      if (res.success) {
        if (res.savedDirectly && res.uri) {
          Alert.alert('Descarga exitosa', 'El archivo PDF se guardó correctamente en tu dispositivo.');
        }
      } else if (res.error) {
        Alert.alert('Error al descargar PDF', res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo generar el archivo PDF.';
      Alert.alert('Error al descargar PDF', msg);
    } finally {
      setPdfDownloading(false);
    }
  }, [reports, periodo]);

  // Diálogo nativo de impresión directa
  const handlePrintPdf = useCallback(async () => {
    if (!reports) return;
    setPdfPrinting(true);
    try {
      const res = await printAdminReportPdf(reports, {
        titulo: `REPORTE ESTADÍSTICO - SERIE AX (${periodo.toUpperCase()})`,
      });
      if (!res.success && res.error) {
        Alert.alert('Error al imprimir', res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar la impresión.';
      Alert.alert('Error al imprimir', msg);
    } finally {
      setPdfPrinting(false);
    }
  }, [reports, periodo]);

  const kpis = reports?.kpis;
  const isCustom = periodo === 'personalizado';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Encabezado estructurado con respiro visual y sin apiñamiento */}
      <View style={styles.headerContainer}>
        {/* Fila 1: Botón Volver a la izquierda y Acciones a la derecha */}
        <View style={styles.topNavRow}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/admin');
            }}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Volver al panel"
            testID="admin-reports-back-button"
          >
            <Ionicons name="arrow-back" size={13} color={Colors.light.brand} />
            <Text style={styles.backButtonText}>VOLVER</Text>
          </Pressable>

          <View style={styles.topActionsRow}>
            {/* Botón Descargar PDF */}
            <Pressable
              onPress={handleDownloadPdf}
              disabled={pdfDownloading || !reports}
              style={[styles.pdfButton, (pdfDownloading || !reports) && styles.buttonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Descargar reporte en PDF"
              testID="admin-reports-export-pdf-button"
            >
              {pdfDownloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={12} color="#FFFFFF" />
                  <Text style={styles.pdfButtonText}>PDF</Text>
                </>
              )}
            </Pressable>

            {/* Botón Imprimir */}
            <Pressable
              onPress={handlePrintPdf}
              disabled={pdfPrinting || !reports}
              style={[styles.actionSecondaryButton, (pdfPrinting || !reports) && styles.buttonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Imprimir reporte"
              testID="admin-reports-print-button"
            >
              {pdfPrinting ? (
                <ActivityIndicator size="small" color={Colors.light.accent} />
              ) : (
                <>
                  <Ionicons name="print-outline" size={12} color={Colors.light.brand} />
                </>
              )}
            </Pressable>

            {/* Botón Actualizar */}
            <Pressable
              onPress={() => void reload()}
              style={styles.actionSecondaryButton}
              accessibilityRole="button"
              accessibilityLabel="Actualizar reportes"
              testID="admin-reports-refresh-button"
            >
              <Ionicons name="refresh-outline" size={13} color={Colors.light.accent} />
            </Pressable>
          </View>
        </View>

        {/* Fila 2: Título Centrado con amplia holgura horizontal */}
        <View style={styles.titleCenterBlock}>
          <Text style={styles.topKicker}>SERIE AX · GESTIÓN INSTITUCIONAL</Text>
          <Text style={styles.topTitle}>REPORTES Y ESTADÍSTICAS</Text>
        </View>

        <AndeanTocapuDivider style={styles.headerDivider} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Selector de Período */}
        <View style={styles.periodSelector}>
          {(['7d', '30d', '90d', 'todo', 'personalizado'] as AdminReportPeriodo[]).map((p) => {
            const labels: Record<AdminReportPeriodo, string> = {
              '7d': '7 DÍAS',
              '30d': '30 DÍAS',
              '90d': '90 DÍAS',
              'todo': 'HISTÓRICO',
              'personalizado': 'RANGO',
            };
            const active = periodo === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPeriodo(p)}
                style={[styles.periodButton, active && styles.periodButtonActive]}
                accessibilityRole="button"
                accessibilityLabel={`Filtro de período ${labels[p]}`}
                testID={`admin-reports-filter-${p}`}
              >
                <Text style={[styles.periodButtonText, active && styles.periodButtonTextActive]}>
                  {labels[p]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Banner de Acciones Destacadas: Descargar PDF e Imprimir */}
        {reports ? (
          <View style={styles.bannerRow}>
            <Pressable
              onPress={handleDownloadPdf}
              disabled={pdfDownloading}
              style={[styles.exportReportBanner, styles.bannerDownload, pdfDownloading && styles.buttonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Descargar archivo PDF directamente"
              testID="admin-reports-export-banner"
            >
              {pdfDownloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.exportReportBannerText}>
                    DESCARGAR PDF
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handlePrintPdf}
              disabled={pdfPrinting}
              style={[styles.exportReportBanner, styles.bannerPrint, pdfPrinting && styles.buttonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Abrir gestor de impresión"
              testID="admin-reports-print-banner"
            >
              {pdfPrinting ? (
                <ActivityIndicator size="small" color={Colors.light.brand} />
              ) : (
                <>
                  <Ionicons name="print-outline" size={14} color={Colors.light.brand} />
                  <Text style={[styles.exportReportBannerText, { color: Colors.light.brand }]}>
                    IMPRIMIR
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* Inputs de Rango Personalizado */}
        {isCustom ? (
          <View style={styles.customDateBox}>
            <View style={styles.customInputsRow}>
              <View style={styles.customInputGroup}>
                <Text style={styles.customInputLabel}>DESDE (AAAA-MM-DD)</Text>
                <TextInput
                  value={inputDesde}
                  onChangeText={setInputDesde}
                  placeholder="2026-10-01"
                  placeholderTextColor={Colors.light.textSecondary}
                  style={styles.customInput}
                  testID="admin-reports-input-desde"
                />
              </View>
              <View style={styles.customInputGroup}>
                <Text style={styles.customInputLabel}>HASTA (AAAA-MM-DD)</Text>
                <TextInput
                  value={inputHasta}
                  onChangeText={setInputHasta}
                  placeholder="2026-11-18"
                  placeholderTextColor={Colors.light.textSecondary}
                  style={styles.customInput}
                  testID="admin-reports-input-hasta"
                />
              </View>
            </View>

            {inputError ? <Text style={styles.customErrorText}>{inputError}</Text> : null}

            <Pressable
              onPress={handleApplyCustom}
              style={styles.customApplyButton}
              accessibilityRole="button"
              accessibilityLabel="Aplicar rango personalizado"
              testID="admin-reports-apply-custom"
            >
              <Text style={styles.customApplyButtonText}>CONSULTAR RANGO</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Estado de Carga */}
        {loading && !reports ? (
          <View style={styles.centered} testID="admin-reports-loading">
            <ActivityIndicator size="small" color={Colors.light.accent} />
            <Text style={styles.loadingText}>Calculando reportes e indicadores...</Text>
          </View>
        ) : null}

        {/* Estado de Error */}
        {error ? (
          <View style={styles.errorBox} testID="admin-reports-error">
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() => void reload()}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Reintentar carga"
            >
              <Text style={styles.retryButtonText}>REINTENTAR</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Contenido Principal con Reportes */}
        {reports ? (
          <View>
            {/* Sección 1: Indicadores Clave (KPIs) */}
            <Text style={styles.sectionLabel}>INDICADORES DEL PERÍODO</Text>
            <View style={styles.kpiGrid}>
              <KpiTile
                label="SOLICITUDES GENERADAS"
                value={kpis?.solicitudes_total ?? 0}
                subtext="En el período"
              />
              <KpiTile
                label="EXPEDICIONES REGISTRADAS"
                value={kpis?.expediciones_total ?? 0}
                subtext="Finalizadas o abandonadas"
              />
              <KpiTile
                label="COMPLETADAS"
                value={kpis?.expediciones_completadas ?? 0}
                highlight
              />
              <KpiTile
                label="PARCIALES"
                value={kpis?.expediciones_parciales ?? 0}
              />
              <KpiTile
                label="ABANDONADAS"
                value={kpis?.expediciones_abandonadas ?? 0}
              />
              <KpiTile
                label="TASA DE FINALIZACIÓN"
                value={`${(kpis?.tasa_finalizacion ?? 0).toFixed(1)}%`}
                subtext="Completadas / Expediciones"
                highlight
              />
              <KpiTile
                label="CONVERSIÓN DE SOLICITUDES"
                value={`${(kpis?.tasa_conversion_solicitudes ?? 0).toFixed(1)}%`}
                subtext="Solicitudes con expedición"
              />
              <KpiTile
                label="PARADAS VISITADAS"
                value={kpis?.paradas_visitadas_total ?? 0}
                subtext="Total acumulado"
              />
            </View>

            {/* Sección 2: Categorías más seleccionadas */}
            <Text style={styles.sectionLabel}>
              CATEGORÍAS MÁS SELECCIONADAS — TOP {reports.categorias_ranking.length}
            </Text>
            <View style={styles.cardBox}>
              {reports.categorias_ranking.length === 0 ? (
                <Text style={styles.emptyText}>
                  No se registraron selecciones de categorías en este período.
                </Text>
              ) : (
                reports.categorias_ranking.map((cat, idx) => (
                  <RankingBar key={cat.id || idx} item={cat} index={idx} />
                ))
              )}
            </View>

            {/* Sección 3: Destinos incluidos en expediciones */}
            <Text style={styles.sectionLabel}>
              DESTINOS INCLUIDOS EN EXPEDICIONES REGISTRADAS
            </Text>
            <View style={styles.cardBox}>
              {reports.destinos_incluidos_ranking.length === 0 ? (
                <Text style={styles.emptyText}>
                  No hay destinos incluidos en expediciones en este período.
                </Text>
              ) : (
                reports.destinos_incluidos_ranking.map((dest, idx) => (
                  <RankingBar
                    key={dest.id || idx}
                    item={dest}
                    index={idx}
                    barColor={Colors.light.primary}
                  />
                ))
              )}
            </View>

            {/* Sección 4: Destinos más visitados */}
            <Text style={styles.sectionLabel}>
              DESTINOS MÁS VISITADOS EFECTIVAMENTE
            </Text>
            <View style={styles.cardBox}>
              {reports.destinos_visitados_ranking.length === 0 ? (
                <Text style={styles.emptyText}>
                  No se registraron paradas visitadas en este período.
                </Text>
              ) : (
                reports.destinos_visitados_ranking.map((dest, idx) => (
                  <RankingBar
                    key={dest.id || idx}
                    item={dest}
                    index={idx}
                    barColor="#2E7D32"
                  />
                ))
              )}
            </View>

            {/* Sección 5: Evolución temporal compacta y visual */}
            <Text style={styles.sectionLabel}>
              EVOLUCIÓN TEMPORAL ({reports.rango.agrupacion === 'mes' ? 'POR MES' : 'POR DÍA'})
            </Text>
            <AdminTimelineChart
              evolucion={reports.evolucion}
              agrupacion={reports.rango.agrupacion}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 8,
  },
  headerContainer: {
    width: '100%',
    paddingBottom: 4,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    marginBottom: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    minHeight: 34,
    justifyContent: 'center',
  },
  backButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.brand,
    letterSpacing: 0.5,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    minHeight: 34,
    justifyContent: 'center',
  },
  pdfButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  actionSecondaryButton: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FBF8F1',
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  titleCenterBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  topKicker: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.light.accent,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  topTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.brand,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 2,
  },
  headerDivider: {
    marginVertical: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodButtonActive: {
    backgroundColor: Colors.light.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  periodButtonTextActive: {
    color: Colors.light.text,
    fontWeight: '700',
  },
  bannerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  exportReportBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  bannerDownload: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primaryDark,
  },
  bannerPrint: {
    backgroundColor: '#FAF5ED',
    borderColor: Colors.light.border,
  },
  exportReportBannerText: {
    fontFamily: Fonts.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  customDateBox: {
    backgroundColor: Colors.light.backgroundElement,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 12,
  },
  customInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customInputGroup: {
    flex: 1,
  },
  customInputLabel: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  customInput: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.light.text,
  },
  customErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.light.carmine,
    marginTop: 6,
  },
  customApplyButton: {
    marginTop: 10,
    backgroundColor: Colors.light.primary,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  customApplyButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiTile: {
    width: '48.5%',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 10,
  },
  kpiTileHighlight: {
    borderColor: Colors.light.accent,
    backgroundColor: '#FAF5ED',
  },
  kpiValue: {
    fontFamily: Fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  kpiValueHighlight: {
    color: Colors.light.accent,
  },
  kpiLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  kpiSubtext: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  cardBox: {
    backgroundColor: Colors.light.backgroundElement,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
  },
  rankingRow: {
    marginBottom: 10,
  },
  rankingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rankingName: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
  },
  rankingNumbers: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  rankingTrack: {
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  rankingProgress: {
    height: '100%',
    borderRadius: 3,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingVertical: 14,
  },
  errorBox: {
    backgroundColor: Colors.light.backgroundElement,
    borderColor: Colors.light.carmine,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.light.carmine,
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryButtonText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.text,
  },
});
