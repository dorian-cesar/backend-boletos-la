require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const client = require('../gds/providers/delta/client');
const mapper = require('../gds/providers/delta/mapper');

function getCalidadText(code) {
  if (!code) return 'Estándar';
  const c = String(code).toUpperCase().trim();
  const map = {
    CO: 'Común',
    CA: 'Cama',
    SE: 'Semicama',
    CI: 'Coche Integral',
    EC: 'Ejecutivo',
    PL: 'Pullman'
  };
  return map[c] || c;
}

async function run() {
  console.log('=== Generador de Reporte de Servicios Delta (1 al 7 de Agosto 2026) ===');
  const t0 = Date.now();

  // 1. Obtener catálogo de paradas homologadas de Delta
  console.log('Obteniendo catálogo de paradas homologadas de Delta...');
  const stopsXml = await client.obtenerParadasHomologadas();
  const stops = mapper.parseDataSet(stopsXml);
  console.log(`✓ Se cargaron ${stops.length} ciudades/paradas.`);

  // Identificar los 5 hubs principales de la red Delta en Paraguay y Argentina
  const primaryHubs = ['184', '162', '240', '244', '172']; // Asunción, Retiro, Santani, PJC, Villarrica
  const probePairs = [];
  stops.forEach(s => {
    primaryHubs.forEach(hId => {
      if (s.Id !== hId) {
        probePairs.push({ orig: s.Id, dest: hId });
        probePairs.push({ orig: hId, dest: s.Id });
      }
    });
  });

  const dates = [
    '2026-08-01',
    '2026-08-02',
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07'
  ];

  console.log(`\nEscaneando los 7 días (${dates[0]} al ${dates[dates.length - 1]}) mediante los ${probePairs.length} pares conectores principales...`);

  const allServicesMap = new Map(); // key `${date}_${serviceId}`
  const CONCURRENCY = 50;

  for (let dIdx = 0; dIdx < dates.length; dIdx++) {
    const date = dates[dIdx];
    const dateT0 = Date.now();
    const dayServicesMap = new Map();

    const scanWorker = async (batch) => {
      for (const pair of batch) {
        try {
          const xml = await client.obtenerServicios({
            IdParadas_Origen: pair.orig,
            IdParadas_Destino: pair.dest,
            Fecha: date
          });
          const rows = mapper.parseDataSet(xml, 'ServiciosxDiaId');
          if (rows && rows.length > 0) {
            for (const r of rows) {
              if (r.Id && !dayServicesMap.has(r.Id)) {
                dayServicesMap.set(r.Id, {
                  fecha: date,
                  serviceId: r.Id,
                  empresa: r.Emp || 'N/A',
                  codigo: r.Cod || 'N/A',
                  embarque: r.Embarque || '',
                  desembarque: r.Desembarque || '',
                  fechaEmbarque: r.FechaEmbarque || '',
                  calidad: r.Calidad || '',
                  libres: parseInt(r.Libres || '0'),
                  tarifa: parseFloat(r.Tarifa || '0'),
                  textoTarifas: r.TextoTarifas || ''
                });
              }
            }
          }
        } catch (e) {}
      }
    };

    const scanBuckets = Array.from({ length: CONCURRENCY }, () => []);
    probePairs.forEach((p, idx) => scanBuckets[idx % CONCURRENCY].push(p));
    await Promise.all(scanBuckets.map(b => scanWorker(b)));

    const sec = ((Date.now() - dateT0)/1000).toFixed(1);
    console.log(`✓ [${dIdx+1}/${dates.length}] Día ${date}: ${dayServicesMap.size} servicios encontrados en ${sec}s.`);

    for (const [sId, sObj] of dayServicesMap.entries()) {
      allServicesMap.set(`${date}_${sId}`, sObj);
    }
  }

  console.log(`\nTotal de servicios únicos detectados en la semana: ${allServicesMap.size}`);

  // 2. Obtener recorridos completos (serviciosRecorrido) para cada servicio único
  console.log('Obteniendo itinerarios/recorridos completos (serviciosRecorrido)...');
  const routeCache = new Map();
  const uniqueServiceIds = Array.from(new Set(Array.from(allServicesMap.values()).map(s => s.serviceId)));

  const routeWorker = async (batch) => {
    for (const sId of batch) {
      try {
        const xml = await client.serviciosRecorrido({ IdServicios: sId });
        const routeStops = mapper.parseDataSet(xml);
        routeCache.set(sId, routeStops);
      } catch (err) {
        routeCache.set(sId, []);
      }
    }
  };

  const routeBuckets = Array.from({ length: 15 }, () => []);
  uniqueServiceIds.forEach((id, idx) => routeBuckets[idx % 15].push(id));
  await Promise.all(routeBuckets.map(b => routeWorker(b)));

  console.log(`✓ Se obtuvieron ${routeCache.size} itinerarios de recorridos.`);

  // 3. Generar filas estructuradas
  console.log('Formateando y enriqueciendo registros...');
  const resumenServiciosRows = [];
  const combinacionesViajesRows = [];

  for (const [key, s] of allServicesMap.entries()) {
    const routeStops = routeCache.get(s.serviceId) || [];
    
    let origenPrimerParada = '';
    let horaSalidaOrigen = s.embarque || '';
    let destinoUltimaParada = '';
    let horaLlegadaDestino = s.desembarque || '';
    let itinerarioTexto = '';

    if (routeStops.length > 0) {
      origenPrimerParada = routeStops[0].Parada || '';
      destinoUltimaParada = routeStops[routeStops.length - 1].Parada || '';
      if (routeStops[0].Horario) horaSalidaOrigen = routeStops[0].Horario;
      if (routeStops[routeStops.length - 1].Horario) horaLlegadaDestino = routeStops[routeStops.length - 1].Horario;
      
      itinerarioTexto = routeStops.map(rs => `${rs.Parada} (${rs.Horario || 'S/H'})`).join(' -> ');
    }

    resumenServiciosRows.push({
      Fecha: s.fecha,
      ID_Servicio: s.serviceId,
      Empresa: s.empresa,
      Codigo_Servicio: s.codigo,
      Origen_Inicio: origenPrimerParada || 'N/A',
      Hora_Salida_Origen: horaSalidaOrigen,
      Destino_Final: destinoUltimaParada || 'N/A',
      Hora_Llegada_Destino: horaLlegadaDestino,
      Calidad_Codigo: s.calidad,
      Calidad_Nombre: getCalidadText(s.calidad),
      Asientos_Libres: s.libres,
      Tarifa_Base_PYG: s.tarifa,
      Cantidad_Paradas: routeStops.length,
      Itinerario_Completo: itinerarioTexto
    });

    if (routeStops.length >= 2) {
      for (let i = 0; i < routeStops.length; i++) {
        for (let j = i + 1; j < routeStops.length; j++) {
          const origStop = routeStops[i];
          const destStop = routeStops[j];
          combinacionesViajesRows.push({
            Fecha: s.fecha,
            ID_Servicio: s.serviceId,
            Empresa: s.empresa,
            Codigo_Servicio: s.codigo,
            Origen_Orden: parseInt(origStop.Orden || (i + 1)),
            Origen_Nombre: origStop.Parada,
            Hora_Salida: origStop.Horario || s.embarque,
            Destino_Orden: parseInt(destStop.Orden || (j + 1)),
            Destino_Nombre: destStop.Parada,
            Hora_Llegada: destStop.Horario || s.desembarque,
            Calidad_Codigo: s.calidad,
            Calidad_Nombre: getCalidadText(s.calidad),
            Asientos_Libres: s.libres,
            Tarifa_Estimada_PYG: s.tarifa
          });
        }
      }
    }
  }

  // 4. Ordenamiento
  console.log('Ordenando registros por Fecha, Hora de Salida, Origen y Destino...');
  resumenServiciosRows.sort((a, b) => {
    if (a.Fecha !== b.Fecha) return a.Fecha.localeCompare(b.Fecha);
    if (a.Hora_Salida_Origen !== b.Hora_Salida_Origen) return a.Hora_Salida_Origen.localeCompare(b.Hora_Salida_Origen);
    return a.Origen_Inicio.localeCompare(b.Origen_Inicio);
  });

  combinacionesViajesRows.sort((a, b) => {
    if (a.Fecha !== b.Fecha) return a.Fecha.localeCompare(b.Fecha);
    if (a.Hora_Salida !== b.Hora_Salida) return a.Hora_Salida.localeCompare(b.Hora_Salida);
    if (a.Origen_Nombre !== b.Origen_Nombre) return a.Origen_Nombre.localeCompare(b.Origen_Nombre);
    return a.Destino_Nombre.localeCompare(b.Destino_Nombre);
  });

  // 5. Guardar Archivos CSV y XLSX
  const outputDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const artifactDir = 'C:\\Users\\diego\\.gemini\\antigravity-ide\\brain\\728429e2-02e5-484a-be2b-f049e726f800';
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  function generateCSV(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const csvLines = [headers.join(',')];
    rows.forEach(r => {
      const line = headers.map(h => {
        let val = String(r[h] !== undefined && r[h] !== null ? r[h] : '');
        val = val.replace(/"/g, '""');
        return `"${val}"`;
      }).join(',');
      csvLines.push(line);
    });
    return '\ufeff' + csvLines.join('\r\n');
  }

  const csvServiciosData = generateCSV(resumenServiciosRows);
  const csvViajesData = generateCSV(combinacionesViajesRows);

  const filePaths = {
    csvServiciosLocal: path.join(outputDir, 'servicios_delta_01_07_agosto_2026.csv'),
    csvViajesLocal: path.join(outputDir, 'viajes_ciudades_delta_01_07_agosto_2026.csv'),
    xlsxLocal: path.join(outputDir, 'servicios_delta_01_07_agosto_2026.xlsx'),
    csvServiciosArtifact: path.join(artifactDir, 'servicios_delta_01_07_agosto_2026.csv'),
    csvViajesArtifact: path.join(artifactDir, 'viajes_ciudades_delta_01_07_agosto_2026.csv'),
    xlsxArtifact: path.join(artifactDir, 'servicios_delta_01_07_agosto_2026.xlsx')
  };

  fs.writeFileSync(filePaths.csvServiciosLocal, csvServiciosData, 'utf8');
  fs.writeFileSync(filePaths.csvViajesLocal, csvViajesData, 'utf8');
  fs.writeFileSync(filePaths.csvServiciosArtifact, csvServiciosData, 'utf8');
  fs.writeFileSync(filePaths.csvViajesArtifact, csvViajesData, 'utf8');

  const wb = XLSX.utils.book_new();
  const wsServicios = XLSX.utils.json_to_sheet(resumenServiciosRows);
  const wsViajes = XLSX.utils.json_to_sheet(combinacionesViajesRows);
  XLSX.utils.book_append_sheet(wb, wsServicios, 'Resumen_Servicios');
  XLSX.utils.book_append_sheet(wb, wsViajes, 'Viajes_por_Ciudad');

  XLSX.writeFile(wb, filePaths.xlsxLocal);
  XLSX.writeFile(wb, filePaths.xlsxArtifact);

  const totalTime = ((Date.now() - t0)/1000).toFixed(1);
  console.log(`\n======================================================`);
  console.log(`✓ Archivos generados exitosamente en ${totalTime}s:`);
  console.log(`  - CSV Resumen Servicios: ${filePaths.csvServiciosLocal}`);
  console.log(`  - CSV Viajes entre Ciudades: ${filePaths.csvViajesLocal}`);
  console.log(`  - Libro Excel (XLSX): ${filePaths.xlsxLocal}`);
  console.log(`======================================================`);
  console.log(`Registros Resumen Servicios: ${resumenServiciosRows.length}`);
  console.log(`Registros Combinaciones Viajes por Ciudad: ${combinacionesViajesRows.length}`);
}

run().catch(err => {
  console.error('Error al generar reportes Delta:', err);
  process.exit(1);
});
