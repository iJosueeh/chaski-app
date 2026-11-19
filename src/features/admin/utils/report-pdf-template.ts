/**
 * Plantilla HTML/CSS para generación de reportes PDF en Chaski (Serie AX).
 *
 * Mantiene la identidad visual oficial:
 * - Paleta: Pergamino (#FAF5EE), Marrón tinta (#4A2E18), Terracota (#9C3E1B), Dorado ocre (#D4AF37).
 * - Tipografías: Cinzel (serif títulos), IBM Plex Mono (datos/cifras), Inter (cuerpo).
 * - Optimizado para impresión A4, alto contraste, saltos de página limpios y tablas estructuradas.
 */

import type { AdminReportsResult } from '../interfaces/admin.interface';

export interface ReportPdfOptions {
  titulo?: string;
  autor?: string;
  folio?: string;
  fechaEmision?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPeriodoLabel(periodo: string): string {
  const map: Record<string, string> = {
    '7d': 'ÚLTIMOS 7 DÍAS',
    '30d': 'ÚLTIMOS 30 DÍAS',
    '90d': 'ÚLTIMOS 90 DÍAS',
    'todo': 'HISTÓRICO COMPLETO',
    'personalizado': 'RANGO PERSONALIZADO',
  };
  return map[periodo] ?? periodo.toUpperCase();
}

/**
 * Genera el documento HTML completo para exportar o imprimir en PDF.
 */
export function generateReportHtml(
  reports: AdminReportsResult,
  options: ReportPdfOptions = {},
): string {
  const { kpis, rango, categorias_ranking, destinos_visitados_ranking, evolucion } = reports;

  const now = options.fechaEmision ?? new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const folio = options.folio ?? `CHK-REP-${Date.now().toString().slice(-6)}`;
  const titulo = options.titulo ?? 'INFORME ESTADÍSTICO Y OPERATIVO';
  const periodoLabel = formatPeriodoLabel(rango.periodo);

  // Formato de fechas de rango
  const fechaDesde = rango.desde ? escapeHtml(rango.desde.split('T')[0]) : 'Inicio histórico';
  const fechaHasta = rango.hasta ? escapeHtml(rango.hasta.split('T')[0]) : 'Actualidad';
  const agrupacionLabel = rango.agrupacion === 'mes' ? 'Mensual' : 'Diario';

  // Renderizar filas de rankings
  const renderRankingRows = (items: typeof categorias_ranking, barColor: string) => {
    if (items.length === 0) {
      return '<tr><td colspan="3" class="empty-cell">Sin registros en este período</td></tr>';
    }
    return items
      .map((item, idx) => {
        const pct = Math.max(0, Math.min(item.porcentaje, 100));
        return `
          <tr>
            <td class="col-rank">${idx + 1}</td>
            <td class="col-name">${escapeHtml(item.nombre)}</td>
            <td class="col-metric">
              <span class="metric-val">${item.total}</span>
              <span class="metric-pct">(${pct.toFixed(1)}%)</span>
              <div class="progress-track">
                <div class="progress-bar" style="width: ${pct}%; background-color: ${barColor};"></div>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  };

  // Renderizar filas de evolución temporal
  const renderTimelineRows = () => {
    if (evolucion.length === 0) {
      return '<tr><td colspan="7" class="empty-cell">No se registran datos para la escala temporal seleccionada.</td></tr>';
    }

    return evolucion
      .map((pt) => {
        const tasa = pt.expediciones > 0
          ? ((pt.completadas / pt.expediciones) * 100).toFixed(1)
          : '—';

        return `
          <tr>
            <td class="col-date font-mono">${escapeHtml(pt.fecha)}</td>
            <td class="col-num font-mono bold">${pt.solicitudes}</td>
            <td class="col-num font-mono bold">${pt.expediciones}</td>
            <td class="col-num font-mono success">✓ ${pt.completadas}</td>
            <td class="col-num font-mono warning">~ ${pt.parciales}</td>
            <td class="col-num font-mono danger">✗ ${pt.abandonadas}</td>
            <td class="col-num font-mono text-primary">${tasa}${tasa !== '—' ? '%' : ''}</td>
          </tr>
        `;
      })
      .join('');
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 16mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #3A2312;
      background-color: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .font-serif { font-family: 'Cinzel', serif; }
    .font-mono { font-family: 'IBM Plex Mono', monospace; }
    .bold { font-weight: 700; }
    .success { color: #2E7D32; }
    .warning { color: #A66D00; }
    .danger { color: #9C3E1B; }
    .text-primary { color: #9C3E1B; }

    /* Contenedor Principal */
    .report-sheet {
      width: 100%;
      margin: 0 auto;
    }

    /* Encabezado Boleto Serie AX */
    .ticket-header {
      border: 2px solid #4A2E18;
      border-radius: 6px;
      padding: 12px 16px;
      background: #FAF6EF;
      position: relative;
      margin-bottom: 16px;
    }

    .ticket-header::after {
      content: "";
      position: absolute;
      left: 3px;
      right: 3px;
      top: 3px;
      bottom: 3px;
      border: 1px dashed #D4AF37;
      border-radius: 4px;
      pointer-events: none;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #E2D7C3;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }

    .brand-kicker {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 7pt;
      font-weight: 700;
      color: #8A7C64;
      letter-spacing: 1.2px;
    }

    .brand-title {
      font-family: 'Cinzel', serif;
      font-size: 16pt;
      font-weight: 800;
      color: #4A2E18;
      letter-spacing: 0.8px;
      margin-top: 2px;
    }

    .folio-badge {
      text-align: right;
    }

    .folio-label {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 7pt;
      color: #8A7C64;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .folio-number {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11pt;
      font-weight: 700;
      color: #9C3E1B;
      letter-spacing: 0.5px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      font-size: 8pt;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 6.5pt;
      font-weight: 600;
      color: #8A7C64;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .meta-val {
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 600;
      color: #4A2E18;
    }

    /* Secciones */
    .section-title {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 8.5pt;
      font-weight: 700;
      color: #4A2E18;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      border-left: 3px solid #9C3E1B;
      padding-left: 8px;
      margin-top: 14px;
      margin-bottom: 8px;
    }

    /* Grid de KPIs */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }

    .kpi-card {
      background: #FAF7F2;
      border: 1px solid #E2D7C3;
      border-radius: 5px;
      padding: 8px 10px;
    }

    .kpi-card.highlight {
      border-color: #D4AF37;
      background: #FFFDF9;
      box-shadow: inset 0 0 0 1px #D4AF37;
    }

    .kpi-value {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 14pt;
      font-weight: 700;
      color: #4A2E18;
      line-height: 1.1;
    }

    .kpi-card.highlight .kpi-value {
      color: #9C3E1B;
    }

    .kpi-label {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 6.5pt;
      font-weight: 600;
      color: #8A7C64;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-top: 4px;
    }

    .kpi-subtext {
      font-size: 6.5pt;
      color: #8A7C64;
      margin-top: 2px;
    }

    /* Grid de Tablas de Rankings */
    .rankings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }

    .table-card {
      border: 1px solid #E2D7C3;
      border-radius: 5px;
      overflow: hidden;
      background: #FFFFFF;
    }

    .table-title {
      background: #FAF6EF;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 7.5pt;
      font-weight: 700;
      color: #4A2E18;
      padding: 6px 10px;
      border-bottom: 1px solid #E2D7C3;
      letter-spacing: 0.5px;
    }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
    }

    table.data-table th {
      background: #F4EFE6;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 6.5pt;
      font-weight: 700;
      color: #6B5E4B;
      text-align: left;
      padding: 5px 8px;
      border-bottom: 1px solid #E2D7C3;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }

    table.data-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #F0E8D8;
      vertical-align: middle;
    }

    table.data-table tbody tr:last-child td {
      border-bottom: none;
    }

    .col-rank {
      width: 20px;
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 700;
      color: #8A7C64;
    }

    .col-name {
      font-weight: 500;
      color: #3A2312;
    }

    .col-metric {
      width: 90px;
      text-align: right;
    }

    .metric-val {
      font-family: 'IBM Plex Mono', monospace;
      font-weight: 700;
      color: #4A2E18;
    }

    .metric-pct {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 6.5pt;
      color: #8A7C64;
      margin-left: 2px;
    }

    .progress-track {
      height: 4px;
      background: #EAE2D2;
      border-radius: 2px;
      margin-top: 3px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      border-radius: 2px;
    }

    /* Tabla de Evolución Temporal */
    .timeline-container {
      border: 1px solid #E2D7C3;
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    table.timeline-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
    }

    table.timeline-table thead th {
      background: #4A2E18;
      color: #FFFDF9;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 6.5pt;
      font-weight: 700;
      padding: 6px 8px;
      text-align: center;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    table.timeline-table thead th:first-child {
      text-align: left;
    }

    table.timeline-table tbody tr {
      page-break-inside: avoid;
    }

    table.timeline-table tbody tr:nth-child(even) {
      background: #FAF7F2;
    }

    table.timeline-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #EFE8DC;
      text-align: center;
    }

    table.timeline-table td.col-date {
      text-align: left;
      font-weight: 600;
      color: #4A2E18;
    }

    .empty-cell {
      text-align: center !important;
      padding: 14px !important;
      color: #8A7C64;
      font-style: italic;
    }

    /* Pie de página Oficial */
    .report-footer {
      border-top: 1px solid #D4AF37;
      padding-top: 8px;
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.5pt;
      color: #8A7C64;
      font-family: 'IBM Plex Mono', monospace;
    }

    .footer-stamp {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #9C3E1B;
      font-weight: 700;
      border: 1px solid #9C3E1B;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="report-sheet">
    <!-- Header tipo Boleto Chaski -->
    <header class="ticket-header">
      <div class="header-top">
        <div>
          <div class="brand-kicker">SISTEMA DE GESTIÓN INSTITUCIONAL · SERIE AX</div>
          <h1 class="brand-title">CHASKI EXPEDICIONES</h1>
        </div>
        <div class="folio-badge">
          <div class="folio-label">FOLIO OFICIAL</div>
          <div class="folio-number">${escapeHtml(folio)}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">INFORME</span>
          <span class="meta-val font-serif">${escapeHtml(titulo)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">PERÍODO CONSULTADO</span>
          <span class="meta-val">${escapeHtml(periodoLabel)} (${escapeHtml(agrupacionLabel)})</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">RANGO DE FECHAS</span>
          <span class="meta-val">${fechaDesde} al ${fechaHasta}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">EMISIÓN</span>
          <span class="meta-val">${escapeHtml(now)}</span>
        </div>
      </div>
    </header>

    <!-- Sección 1: KPIs Principales -->
    <div class="section-title">1. Resumen Ejecutivo de Métricas Clave</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">${kpis.solicitudes_total}</div>
        <div class="kpi-label">Solicitudes Generadas</div>
        <div class="kpi-subtext">Total en el período</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${kpis.expediciones_total}</div>
        <div class="kpi-label">Expediciones Totales</div>
        <div class="kpi-subtext">Completas o finalizadas</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-value">${kpis.expediciones_completadas}</div>
        <div class="kpi-label">Expediciones Concluidas</div>
        <div class="kpi-subtext">100% de paradas</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-value">${kpis.tasa_finalizacion.toFixed(1)}%</div>
        <div class="kpi-label">Tasa de Finalización</div>
        <div class="kpi-subtext">Completadas / Expediciones</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${kpis.expediciones_parciales}</div>
        <div class="kpi-label">Parciales</div>
        <div class="kpi-subtext">Al menos 1 parada</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${kpis.expediciones_abandonadas}</div>
        <div class="kpi-label">Abandonadas</div>
        <div class="kpi-subtext">0 paradas registradas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${kpis.tasa_conversion_solicitudes.toFixed(1)}%</div>
        <div class="kpi-label">Tasa de Conversión</div>
        <div class="kpi-subtext">Solicitudes con expedición</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${kpis.paradas_visitadas_total}</div>
        <div class="kpi-label">Paradas Visitadas</div>
        <div class="kpi-subtext">Volumen de actividad</div>
      </div>
    </div>

    <!-- Sección 2: Rankings Destacados -->
    <div class="section-title">2. Preferencias y Destinos de Mayor Demanda</div>
    <div class="rankings-grid">
      <div class="table-card">
        <div class="table-title">CATEGORÍAS MÁS SELECCIONADAS (TOP ${categorias_ranking.length})</div>
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th>Categoría</th>
              <th class="col-metric">Selecciones</th>
            </tr>
          </thead>
          <tbody>
            ${renderRankingRows(categorias_ranking, '#D4AF37')}
          </tbody>
        </table>
      </div>

      <div class="table-card">
        <div class="table-title">DESTINOS MÁS VISITADOS EFECTIVAMENTE</div>
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th>Destino / Punto de Interés</th>
              <th class="col-metric">Visitas</th>
            </tr>
          </thead>
          <tbody>
            ${renderRankingRows(destinos_visitados_ranking, '#2E7D32')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Sección 3: Evolución Temporal Detallada -->
    <div class="section-title">3. Detalle de Evolución Temporal (${escapeHtml(agrupacionLabel)})</div>
    <div class="timeline-container">
      <table class="timeline-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Solicitudes</th>
            <th>Expediciones</th>
            <th>Completadas</th>
            <th>Parciales</th>
            <th>Abandonadas</th>
            <th>Efectividad</th>
          </tr>
        </thead>
        <tbody>
          ${renderTimelineRows()}
        </tbody>
      </table>
    </div>

    <!-- Pie de página Oficial -->
    <footer class="report-footer">
      <div>
        <span>CHASKI GESTIÓN INSTITUCIONAL &bull; SERIE AX &bull; DOCUMENTO OFICIAL</span>
      </div>
      <div class="footer-stamp">
        <span>CERTIFICADO DIGITAL CHASKI</span>
      </div>
      <div>
        <span>PÁGINA 1 DE 1 &bull; ESTRICTAMENTE CONFIDENCIAL</span>
      </div>
    </footer>
  </div>
</body>
</html>
  `.trim();
}
