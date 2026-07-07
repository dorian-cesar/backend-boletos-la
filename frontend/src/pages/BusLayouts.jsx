import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Eye, 
  X, 
  Loader, 
  AlertCircle,
  CheckCircle2,
  Grid,
  Sparkles,
  Info
} from 'lucide-react';

const BusLayouts = () => {
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [previewLayout, setPreviewLayout] = useState(null); // layout to preview
  
  // State del Editor
  const [name, setName] = useState('');
  const [pisos, setPisos] = useState(1);
  const [rows, setRows] = useState(10);
  const [columns, setColumns] = useState(5);
  const [tipoPiso1, setTipoPiso1] = useState('Semi Cama');
  const [tipoPiso2, setTipoPiso2] = useState('Salón Cama');
  
  // Matrices de mapas de asientos (array de arrays de strings)
  const [floor1Map, setFloor1Map] = useState([]);
  const [floor2Map, setFloor2Map] = useState([]);
  
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/bus-layout');
      setLayouts(response.data.data || []);
    } catch (err) {
      console.error('Error fetching layouts:', err);
      setError(err.response?.data?.message || 'Error al obtener los diseños de bus.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLayouts();
  }, []);

  // Inicializar o ajustar la matriz del mapa de asientos cuando cambian filas o columnas
  useEffect(() => {
    if (!modalOpen) return;
    
    const adjustMap = (currentMap, newRows, newCols) => {
      const newMap = [];
      for (let r = 0; r < newRows; r++) {
        const row = [];
        for (let c = 0; c < newCols; c++) {
          // Mantener valor existente si está en rango, de lo contrario inicializar vacío (asiento por defecto o pasillo)
          if (currentMap && currentMap[r] && currentMap[r][c] !== undefined) {
            row.push(currentMap[r][c]);
          } else {
            // Por defecto, hagamos pasillo en el medio (columna central)
            const middleCol = Math.floor(newCols / 2);
            row.push(c === middleCol ? '' : 'S');
          }
        }
        newMap.push(row);
      }
      return newMap;
    };

    setFloor1Map(prev => adjustMap(prev, rows, columns));
    setFloor2Map(prev => adjustMap(prev, rows, columns));
  }, [rows, columns, modalOpen]);

  const handleCellClick = (floor, r, c) => {
    const mapToUpdate = floor === 1 ? [...floor1Map] : [...floor2Map];
    // Alternar: si es pasillo (''), se vuelve asiento ('S'). Si es asiento, se vuelve pasillo ('')
    mapToUpdate[r] = [...mapToUpdate[r]];
    mapToUpdate[r][c] = mapToUpdate[r][c] === '' ? 'S' : '';
    
    if (floor === 1) {
      setFloor1Map(mapToUpdate);
    } else {
      setFloor2Map(mapToUpdate);
    }
  };

  const handleAutoNumber = () => {
    let seatNum = 1;
    
    // Auto numerar Piso 1
    const newFloor1 = floor1Map.map(row => 
      row.map(cell => (cell !== '' ? String(seatNum++) : ''))
    );
    setFloor1Map(newFloor1);

    // Auto numerar Piso 2 si aplica
    if (pisos === 2) {
      const newFloor2 = floor2Map.map(row => 
        row.map(cell => (cell !== '' ? String(seatNum++) : ''))
      );
      setFloor2Map(newFloor2);
    }
  };

  const handleDeleteLayout = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este diseño? Si hay buses que usan este diseño, podría causar problemas de visualización.')) return;
    try {
      await api.delete(`/bus-layout/${id}`);
      showSuccess('Diseño de bus eliminado correctamente.');
      fetchLayouts();
    } catch (err) {
      console.error('Error deleting layout:', err);
      setError(err.response?.data?.message || 'Error al eliminar diseño de bus.');
    }
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const openCreateModal = () => {
    setName('');
    setPisos(1);
    setRows(10);
    setColumns(5);
    setTipoPiso1('Semi Cama');
    setTipoPiso2('Salón Cama');
    // Inicializar mapas temporales
    setFloor1Map([]);
    setFloor2Map([]);
    setFormError(null);
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('El nombre del diseño es requerido.');
      return;
    }

    // Contar capacidad (asientos no vacíos)
    let capacidad = 0;
    const cleanMap = (map) => {
      return map.map(row => 
        row.map(cell => {
          if (cell !== '') {
            capacidad++;
            return cell;
          }
          return '';
        })
      );
    };

    const finalFloor1 = cleanMap(floor1Map);
    const finalFloor2 = pisos === 2 ? cleanMap(floor2Map) : [];

    if (capacidad === 0) {
      setFormError('Debe definir al menos un asiento en el mapa.');
      return;
    }

    // Verificar si hay asientos sin numerar (que tengan 'S')
    const hasUnnumbered = (map) => map.some(row => row.some(cell => cell === 'S'));
    if (hasUnnumbered(finalFloor1) || (pisos === 2 && hasUnnumbered(finalFloor2))) {
      setFormError('Por favor haga clic en "Auto-Numerar Asientos" antes de guardar para asignar identificadores.');
      return;
    }

    setSubmitLoading(true);

    const payload = {
      name: name.trim(),
      rows,
      columns,
      pisos,
      capacidad,
      tipo_Asiento_piso_1: tipoPiso1,
      tipo_Asiento_piso_2: pisos === 2 ? tipoPiso2 : undefined,
      floor1: { seatMap: finalFloor1 },
      floor2: pisos === 2 ? { seatMap: finalFloor2 } : undefined
    };

    try {
      await api.post('/bus-layout', payload);
      showSuccess('Diseño de bus creado exitosamente.');
      setModalOpen(false);
      fetchLayouts();
    } catch (err) {
      console.error('Error saving layout:', err);
      setFormError(err.response?.data?.message || 'Error al guardar el diseño de bus.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const renderVisualMap = (seatMap) => {
    if (!seatMap || !seatMap.length) return null;
    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 inline-block">
        <div className="flex flex-col gap-2">
          {seatMap.map((row, r) => (
            <div key={r} className="flex gap-2 justify-center">
              {row.map((cell, c) => {
                if (cell === '') {
                  return (
                    <div 
                      key={c} 
                      className="w-10 h-10 rounded border border-transparent flex items-center justify-center text-[10px] text-slate-700 bg-slate-950/20"
                    >
                      Aisle
                    </div>
                  );
                }
                return (
                  <div 
                    key={c} 
                    className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300 shadow-md shadow-indigo-500/5"
                  >
                    {cell === 'S' ? 'S' : cell}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      
      {/* Encabezado y botón Agregar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <Layers className="text-indigo-400" size={26} />
            Diseños de Buses (Layouts)
          </h1>
          <p className="text-slate-400 text-sm">Crea mapas de distribución de asientos (1 o 2 pisos) y configúralos gráficamente.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/10 text-sm self-start sm:self-auto transition-all"
        >
          <Plus size={18} />
          Diseñar Layout
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-sm">
          <AlertCircle size={20} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-950/20 border border-emerald-800/50 rounded-xl text-emerald-200 text-sm animate-fade-in">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabla de Layouts */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col justify-center items-center gap-3 text-slate-400">
            <Loader className="animate-spin text-indigo-500" size={32} />
            <span>Cargando diseños...</span>
          </div>
        ) : layouts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No hay diseños de bus registrados en el sistema.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Nombre de Plantilla</th>
                  <th className="py-4 px-6 text-center">Pisos</th>
                  <th className="py-4 px-6 text-center">Capacidad Total</th>
                  <th className="py-4 px-6">Tipo Asiento</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {layouts.map((layout) => (
                  <tr key={layout._id} className="hover:bg-slate-950/20 text-slate-300 text-sm transition-all">
                    <td className="py-4 px-6 font-semibold text-white">{layout.name}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
                        {layout.pisos} {layout.pisos === 1 ? 'Piso' : 'Pisos'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-indigo-400">{layout.capacidad} Asientos</td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {layout.pisos === 1 ? (
                        <span>{layout.tipo_Asiento_piso_1}</span>
                      ) : (
                        <div className="space-y-0.5">
                          <p>P1: {layout.tipo_Asiento_piso_1}</p>
                          <p>P2: {layout.tipo_Asiento_piso_2}</p>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setPreviewLayout(layout)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
                          title="Visualizar Mapa"
                        >
                          <Eye size={16} />
                          Ver Mapa
                        </button>
                        <button
                          onClick={() => handleDeleteLayout(layout._id)}
                          className="p-1.5 hover:bg-red-950/40 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PREVIEW LAYOUT */}
      {previewLayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <div>
                <h3 className="text-md font-bold text-white">{previewLayout.name}</h3>
                <p className="text-xs text-slate-500">Distribución física de asientos ({previewLayout.capacidad} total)</p>
              </div>
              <button onClick={() => setPreviewLayout(null)} className="text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col md:flex-row gap-8 justify-center items-start">
              {/* Piso 1 */}
              <div className="space-y-3 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Piso 1 ({previewLayout.tipo_Asiento_piso_1})</span>
                <div>{renderVisualMap(previewLayout.floor1?.seatMap)}</div>
              </div>

              {/* Piso 2 si aplica */}
              {previewLayout.pisos === 2 && previewLayout.floor2?.seatMap && (
                <div className="space-y-3 text-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Piso 2 ({previewLayout.tipo_Asiento_piso_2})</span>
                  <div>{renderVisualMap(previewLayout.floor2?.seatMap)}</div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 text-right bg-slate-950/20">
              <button
                onClick={() => setPreviewLayout(null)}
                className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all border border-slate-800"
              >
                Cerrar Vista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREADOR / DISEÑADOR DE LAYOUTS */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto py-8">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <div>
                <h3 className="text-md font-bold text-white">Diseñar Nuevo Mapa de Asientos</h3>
                <p className="text-xs text-slate-500">Modifica las dimensiones del bus y haz clic en las celdas para alternar entre Asientos y Pasillos.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
              {formError && (
                <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Controles de Configuración Básica */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/60 text-sm">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nombre de Plantilla</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Semi Cama Premium 1 Piso"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Número de Pisos</label>
                  <select
                    value={pisos}
                    onChange={(e) => setPisos(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value={1}>1 Piso</option>
                    <option value={2}>2 Pisos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tipo Asiento (P1)</label>
                  <select
                    value={tipoPiso1}
                    onChange={(e) => setTipoPiso1(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="Semi Cama">Semi Cama</option>
                    <option value="Salón Cama">Salón Cama</option>
                    <option value="Premium Cama">Premium Cama</option>
                  </select>
                </div>

                {pisos === 2 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tipo Asiento (P2)</label>
                    <select
                      value={tipoPiso2}
                      onChange={(e) => setTipoPiso2(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                    >
                      <option value="Semi Cama">Semi Cama</option>
                      <option value="Salón Cama">Salón Cama</option>
                      <option value="Premium Cama">Premium Cama</option>
                    </select>
                  </div>
                )}

                {/* Dimensiones de Grilla */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Filas (Largo)</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={rows}
                    onChange={(e) => setRows(Math.max(2, Math.min(20, Number(e.target.value))))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Columnas (Ancho)</label>
                  <input
                    type="number"
                    min={3}
                    max={6}
                    value={columns}
                    onChange={(e) => setColumns(Math.max(3, Math.min(6, Number(e.target.value))))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div className="md:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={handleAutoNumber}
                    className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold rounded-lg text-sm flex items-center justify-center gap-2 border border-indigo-500/20 hover:border-indigo-500/30 transition-all shadow-md"
                  >
                    <Sparkles size={16} />
                    Auto-Numerar Asientos
                  </button>
                </div>
              </div>

              {/* Área Gráfica del Diseñador */}
              <div className="flex flex-col md:flex-row gap-8 justify-center items-start overflow-x-auto py-2">
                {/* Piso 1 Editor */}
                <div className="space-y-3 text-center min-w-[220px]">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Diseño Piso 1</span>
                  
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 inline-block shadow-inner">
                    <div className="flex flex-col gap-2">
                      {floor1Map.map((row, r) => (
                        <div key={r} className="flex gap-2 justify-center">
                          {row.map((cell, c) => (
                            <button
                              type="button"
                              key={c}
                              onClick={() => handleCellClick(1, r, c)}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs transition-all border ${
                                cell === '' 
                                  ? 'bg-slate-900 text-slate-700 border-dashed border-slate-800 hover:bg-slate-850 hover:text-slate-500' 
                                  : cell === 'S'
                                  ? 'bg-amber-950/40 text-amber-400 border-amber-800/40 hover:bg-amber-900/40 shadow-sm'
                                  : 'bg-indigo-950 text-indigo-300 border-indigo-500/40 hover:bg-indigo-900 shadow-md'
                              }`}
                              title={cell === '' ? 'Haga clic para activar asiento' : 'Haga clic para convertir en pasillo'}
                            >
                              {cell === '' ? 'Pas' : cell}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Piso 2 Editor si aplica */}
                {pisos === 2 && (
                  <div className="space-y-3 text-center min-w-[220px]">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Diseño Piso 2</span>
                    
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 inline-block shadow-inner">
                      <div className="flex flex-col gap-2">
                        {floor2Map.map((row, r) => (
                          <div key={r} className="flex gap-2 justify-center">
                            {row.map((cell, c) => (
                              <button
                                type="button"
                                key={c}
                                onClick={() => handleCellClick(2, r, c)}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs transition-all border ${
                                  cell === '' 
                                    ? 'bg-slate-900 text-slate-700 border-dashed border-slate-800 hover:bg-slate-850 hover:text-slate-500' 
                                    : cell === 'S'
                                    ? 'bg-amber-950/40 text-amber-400 border-amber-800/40 hover:bg-amber-900/40 shadow-sm'
                                    : 'bg-violet-950 text-violet-300 border-violet-500/40 hover:bg-violet-900 shadow-md'
                                }`}
                                title={cell === '' ? 'Haga clic para activar asiento' : 'Haga clic para convertir en pasillo'}
                              >
                                {cell === '' ? 'Pas' : cell}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Nota Informativa */}
              <div className="flex items-start gap-2.5 p-3.5 bg-slate-950/30 border border-slate-800/50 rounded-xl text-slate-400 text-xs">
                <Info size={16} className="shrink-0 text-indigo-400 mt-0.5" />
                <span>
                  <strong>Tip de diseño:</strong> Los asientos con la etiqueta <span className="text-amber-400">S</span> son asientos pendientes de numerar. Para guardarlo correctamente, presione el botón <strong>"Auto-Numerar Asientos"</strong>; esto rellenará secuencialmente cada uno del 1 en adelante y determinará la capacidad exacta del bus.
                </span>
              </div>

              {/* Botones de Acción */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-sm font-semibold transition-all"
                >
                  {submitLoading && <Loader size={16} className="animate-spin" />}
                  <span>Guardar Diseño</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default BusLayouts;
