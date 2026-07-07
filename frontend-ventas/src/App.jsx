import React, { useState, useEffect } from 'react';
import api from './api';
import { 
  Search, 
  MapPin, 
  Calendar, 
  Clock, 
  Bus, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  CreditCard, 
  Sparkles, 
  AlertCircle, 
  Loader, 
  Ticket, 
  Printer, 
  User, 
  Mail, 
  CheckCircle2,
  RefreshCw,
  Info
} from 'lucide-react';

function App() {
  const [step, setStep] = useState(1); // 1: Buscar, 2: Seleccionar, 3: Asiento/Datos, 4: Pago, 5: Boleto
  
  // Catálogos
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(true);
  
  // Parámetros de Búsqueda
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [services, setServices] = useState([]);
  const [searchedParams, setSearchedParams] = useState(null);

  // Selección de Servicio y Detalles
  const [selectedService, setSelectedService] = useState(null);
  const [loadingService, setLoadingService] = useState(false);
  const [serviceDetailError, setServiceDetailError] = useState(null);
  
  // Piso activo en mapa de asientos (para buses de 2 pisos)
  const [activeFloor, setActiveFloor] = useState(1);
  const [selectedSeat, setSelectedSeat] = useState(null);

  // Pasajero
  const [rut, setRut] = useState('');
  const [passengerName, setPassengerName] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [searchingPassenger, setSearchingPassenger] = useState(false);
  const [passengerExists, setPassengerExists] = useState(false);
  const [passengerError, setPassengerError] = useState(null);

  // Reserva hold
  const [reserving, setReserving] = useState(false);
  const [holdUntil, setHoldUntil] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  
  // Pago
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [paymentError, setPaymentError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [paymentStepText, setPaymentStepText] = useState('');

  // Boleto Final
  const [confirmedTicket, setConfirmedTicket] = useState(null);

  // Cargar ciudades al montar
  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoadingCities(true);
        // Esperar un momento corto por si se está realizando el login silencioso
        const response = await api.get('/cities');
        setCities(response.data.data || []);
      } catch (err) {
        console.error('Error cargando ciudades:', err);
        setSearchError('Error de conexión al cargar ciudades. El servidor podría estar iniciando.');
      } finally {
        setLoadingCities(false);
      }
    };
    fetchCities();
  }, []);

  // Timer para la reserva temporal
  useEffect(() => {
    if (!holdUntil) {
      setTimeRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(holdUntil) - new Date());
      if (remaining === 0) {
        clearInterval(interval);
        // Expiró
        handleReleaseSeat(true);
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [holdUntil]);

  // Formateador de precios
  const formatPrice = (val) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(val);
  };

  // Buscar servicios
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!origin || !destination || !date) {
      setSearchError('Por favor complete todos los campos de búsqueda.');
      return;
    }
    if (origin === destination) {
      setSearchError('El origen y el destino no pueden ser iguales.');
      return;
    }

    setSearchError(null);
    setSearching(true);
    setServices([]);

    try {
      const response = await api.get(`/services/filter`, {
        params: { date, origin, destination }
      });
      
      const foundServices = response.data.services || [];
      setServices(foundServices);
      setSearchedParams({ origin, destination, date });
      
      if (foundServices.length === 0) {
        setSearchError('No se encontraron servicios para esta combinación de ciudades y fecha.');
      } else {
        setStep(2);
      }
    } catch (err) {
      console.error(err);
      setSearchError(err.response?.data?.message || 'Error al buscar viajes. Verifique los parámetros o intente más tarde.');
    } finally {
      setSearching(false);
    }
  };

  // Calcular precio del tramo
  const getSegmentPrice = (service) => {
    if (!searchedParams) return 0;
    const originStop = service.departures.find(d => d.stop === searchedParams.origin);
    const destStop = service.departures.find(d => d.stop === searchedParams.destination);
    if (!originStop || !destStop) return 0;

    let destPrice = destStop.price;
    const maxOrder = Math.max(...service.departures.map(d => d.order));
    const isFinalStop = destStop.order === maxOrder;

    // Si es parada final y el precio marca 0 (inicialización por defecto en el backend)
    if (isFinalStop && destPrice === 0) {
      const otherPrices = service.departures
        .filter(d => d.price > 0)
        .map(d => d.price);
      const maxPrevPrice = otherPrices.length > 0 ? Math.max(...otherPrices) : 0;
      destPrice = maxPrevPrice > 0 ? maxPrevPrice + 2000 : 12000;
    }

    return Math.max(2000, destPrice - originStop.price);
  };

  // Seleccionar Servicio y pedir detalles actualizados (asientos)
  const handleSelectService = async (service) => {
    setServiceDetailError(null);
    setLoadingService(true);
    setSelectedSeat(null);
    setSelectedService(null);
    setRut('');
    setPassengerName('');
    setPassengerEmail('');
    setPassengerExists(false);

    try {
      const response = await api.get(`/services/${service._id}`, {
        params: {
          origin: searchedParams.origin,
          destination: searchedParams.destination
        }
      });
      setSelectedService(response.data.service);
      setStep(3);
      setActiveFloor(1);
    } catch (err) {
      console.error('Error cargando detalles del servicio:', err);
      setServiceDetailError('No se pudieron obtener la disponibilidad de asientos actual. Intente de nuevo.');
    } finally {
      setLoadingService(false);
    }
  };

  // Verificar RUT de pasajero
  const handleVerifyRut = async () => {
    if (!rut.trim()) {
      setPassengerError('Ingrese un RUT válido para buscar.');
      return;
    }
    setPassengerError(null);
    setSearchingPassenger(true);
    setPassengerExists(false);

    try {
      const response = await api.get(`/users`, {
        params: { search: rut.trim() }
      });
      
      const items = response.data.items || [];
      const match = items.find(u => u.rut.replace(/[^0-9kK]/g, '').toLowerCase() === rut.replace(/[^0-9kK]/g, '').toLowerCase());
      
      if (match) {
        setPassengerName(match.name);
        setPassengerEmail(match.email);
        setPassengerExists(true);
      } else {
        setPassengerError('El RUT ingresado no está registrado. Por favor complete los datos para registrarlo.');
      }
    } catch (err) {
      console.error('Error buscando pasajero:', err);
      setPassengerError('No se pudo verificar el RUT en el servidor. Complete los datos manualmente.');
    } finally {
      setSearchingPassenger(false);
    }
  };

  // Reservar asiento temporalmente (Hold)
  const handleReserveSeat = async (e) => {
    e.preventDefault();
    if (!selectedSeat) {
      setPassengerError('Debe seleccionar un asiento en el mapa del bus.');
      return;
    }
    if (!rut.trim() || !passengerName.trim() || !passengerEmail.trim()) {
      setPassengerError('Complete todos los campos del pasajero.');
      return;
    }

    setPassengerError(null);
    setReserving(true);

    try {
      // 1. Si el pasajero no existe en la BD, lo registramos "en caliente"
      if (!passengerExists) {
        await api.post('/users', {
          name: passengerName.trim(),
          rut: rut.trim(),
          email: passengerEmail.trim().toLowerCase(),
          password: 'pasajero-' + rut.trim(), // contraseña genérica
          role: 'usuario',
          activo: true
        });
      }

      // Obtener IDs de origen y destino del buscador
      const originCityObj = cities.find(c => c.name === searchedParams.origin);
      const destinationCityObj = cities.find(c => c.name === searchedParams.destination);

      if (!originCityObj || !destinationCityObj) {
        throw new Error('Ciudades de origen o destino no válidas.');
      }

      // 2. Realizar hold temporal en el backend
      const response = await api.post('/seats/reserve', {
        serviceId: selectedService._id,
        seatCode: selectedSeat.code,
        rut: rut.trim(),
        originCityId: originCityObj._id,
        destinationCityId: destinationCityObj._id
      });

      setHoldUntil(response.data.holdUntil);
      setStep(4);
    } catch (err) {
      console.error('Error reservando asiento:', err);
      setPassengerError(err.response?.data?.message || 'Error al reservar el asiento. Podría haber sido ocupado recientemente.');
    } finally {
      setReserving(false);
    }
  };

  // Cancelar reserva / Liberar Hold
  const handleReleaseSeat = async (isAutomaticExpired = false) => {
    if (!selectedService || !selectedSeat) return;

    try {
      await api.post('/seats/release', {
        serviceId: selectedService._id,
        seatCode: selectedSeat.code,
        rut: rut.trim()
      });
    } catch (err) {
      console.error('Error al liberar asiento:', err);
    }

    setHoldUntil(null);
    setSelectedSeat(null);
    
    if (isAutomaticExpired) {
      alert('Tu reserva de asiento de 10 minutos ha expirado. Por favor, selecciona tu asiento de nuevo.');
      setStep(3);
    } else {
      setStep(3);
    }
  };

  // Confirmar y pagar (Simulado)
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (cardNumber.replace(/\s/g, '').length < 16) {
      setPaymentError('Ingrese un número de tarjeta de 16 dígitos válido.');
      return;
    }
    if (!cardExpiry || !cardCvv || !cardName.trim()) {
      setPaymentError('Complete todos los datos de la tarjeta.');
      return;
    }

    setPaymentError(null);
    setPaying(true);

    // Animación interactiva de carga secuencial
    const steps = [
      'Contactando con la entidad bancaria...',
      'Verificando validez de tarjeta y fondos...',
      'Procesando transferencia segura...',
      'Confirmando asiento con la aerolínea/bus...'
    ];

    for (let i = 0; i < steps.length; i++) {
      setPaymentStepText(steps[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      const response = await api.post('/seats/confirm', {
        serviceId: selectedService._id,
        seatCode: selectedSeat.code,
        rut: rut.trim()
      });

      setConfirmedTicket({
        service: selectedService,
        seat: response.data.seat,
        price: getSegmentPrice(selectedService),
        passenger: {
          name: passengerName,
          rut: rut,
          email: passengerEmail
        },
        origin: searchedParams.origin,
        destination: searchedParams.destination,
        date: searchedParams.date,
        ticketNumber: `TK-${Math.floor(100000 + Math.random() * 900000)}`
      });

      setHoldUntil(null); // Limpiar timer
      setStep(5);
    } catch (err) {
      console.error('Error confirmando pago:', err);
      setPaymentError(err.response?.data?.message || 'Error al confirmar la reserva del asiento. Intente de nuevo.');
    } finally {
      setPaying(false);
    }
  };

  // Imprimir Boleto
  const handlePrint = () => {
    window.print();
  };

  // Volver a iniciar todo
  const handleReset = () => {
    setStep(1);
    setOrigin('');
    setDestination('');
    setDate('');
    setServices([]);
    setSelectedService(null);
    setSelectedSeat(null);
    setConfirmedTicket(null);
    setRut('');
    setPassengerName('');
    setPassengerEmail('');
    setPassengerExists(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      
      {/* Header Premium */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-md sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/25">
              B
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-wider text-white">PASAJES PARAGUAY</span>
              <span className="text-[10px] block text-indigo-400 font-semibold tracking-widest uppercase">Portal de Ventas</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Conectado al Servidor
          </div>
        </div>
      </header>

      {/* Flujo de Pasos / Progress bar */}
      <section className="bg-gray-900/35 py-4 border-b border-gray-800/50 no-print">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between text-xs sm:text-sm font-medium text-gray-400">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-400 font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 1 ? 'border-indigo-500 bg-indigo-950/50' : 'border-gray-700'}`}>1</span>
            <span className="hidden sm:inline">Buscar</span>
          </div>
          <div className="h-[1px] bg-gray-800 flex-1 mx-3" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-400 font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 2 ? 'border-indigo-500 bg-indigo-950/50' : 'border-gray-700'}`}>2</span>
            <span className="hidden sm:inline">Viaje</span>
          </div>
          <div className="h-[1px] bg-gray-800 flex-1 mx-3" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-indigo-400 font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 3 ? 'border-indigo-500 bg-indigo-950/50' : 'border-gray-700'}`}>3</span>
            <span className="hidden sm:inline">Asiento</span>
          </div>
          <div className="h-[1px] bg-gray-800 flex-1 mx-3" />
          <div className={`flex items-center gap-2 ${step >= 4 ? 'text-indigo-400 font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 4 ? 'border-indigo-500 bg-indigo-950/50' : 'border-gray-700'}`}>4</span>
            <span className="hidden sm:inline">Pago</span>
          </div>
          <div className="h-[1px] bg-gray-800 flex-1 mx-3" />
          <div className={`flex items-center gap-2 ${step === 5 ? 'text-emerald-400 font-bold' : ''}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border ${step === 5 ? 'border-emerald-500 bg-emerald-950/50' : 'border-gray-700'}`}>5</span>
            <span className="hidden sm:inline">Boleto</span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        
        {/* Reservation expiry banner (when seat is reserved) */}
        {timeRemaining && (
          <div className="mb-6 flex items-center justify-between p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-2xl text-amber-200 text-sm no-print animate-pulse">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <span>Tu asiento seleccionado {selectedSeat?.code} está bloqueado temporalmente.</span>
            </div>
            <div className="font-mono font-bold bg-amber-900/60 px-3 py-1 rounded-xl text-amber-300">
              Expira en: {timeRemaining}
            </div>
          </div>
        )}

        {/* STEP 1: FORMULARIO DE BUSQUEDA */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto w-full bg-gray-900 border border-gray-800/80 rounded-3xl shadow-2xl p-6 sm:p-10 relative overflow-hidden no-print">
            <div className="absolute top-[-30%] left-[-20%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="text-center mb-8 relative z-10">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="text-indigo-400" size={28} />
                Encuentra tu Próximo Viaje
              </h1>
              <p className="text-gray-400 text-sm mt-2">Busca servicios activos, reserva tus asientos preferidos y compra al instante.</p>
            </div>

            {searchError && (
              <div className="mb-6 flex items-center gap-3 p-4 bg-red-950/20 border border-red-800/50 rounded-2xl text-red-200 text-sm">
                <AlertCircle size={20} className="shrink-0 text-red-400" />
                <span>{searchError}</span>
              </div>
            )}

            {loadingCities ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
                <Loader className="animate-spin text-indigo-500" size={32} />
                <span>Iniciando el portal de ventas...</span>
              </div>
            ) : (
              <form onSubmit={handleSearch} className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Origen */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ciudad Origen</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <MapPin size={18} />
                      </span>
                      <select
                        required
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-2xl text-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                      >
                        <option value="" className="bg-gray-900 text-gray-400">Seleccione origen...</option>
                        {cities.map(c => (
                          <option key={c._id} value={c.name} className="bg-gray-900 text-gray-100">{c.name} ({c.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Destino */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ciudad Destino</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <MapPin size={18} />
                      </span>
                      <select
                        required
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-2xl text-gray-200 focus:outline-none focus:border-indigo-500 text-sm"
                      >
                        <option value="" className="bg-gray-900 text-gray-400">Seleccione destino...</option>
                        {cities.filter(c => c.name !== origin).map(c => (
                          <option key={c._id} value={c.name} className="bg-gray-900 text-gray-100">{c.name} ({c.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Fecha */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fecha de Salida</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                      <Calendar size={18} />
                    </span>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-2xl text-gray-200 focus:outline-none focus:border-indigo-500 text-sm font-semibold cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-indigo-600/10 flex justify-center items-center gap-2 text-sm mt-8"
                >
                  {searching ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      <span>Buscando servicios...</span>
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      <span>Buscar Salidas Disponibles</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: LISTADO DE SERVICIOS */}
        {step === 2 && (
          <div className="max-w-4xl mx-auto w-full space-y-6 no-print">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-all font-semibold"
              >
                <ArrowLeft size={16} /> Volver a buscar
              </button>
              <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                {searchedParams?.origin} → {searchedParams?.destination} ({new Date(searchedParams?.date).toLocaleDateString()})
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Seleccione su Horario</h2>

            <div className="space-y-4">
              {services.map((service) => {
                const depOrigin = service.departures.find(d => d.stop === searchedParams.origin);
                const depDest = service.departures.find(d => d.stop === searchedParams.destination);
                const price = getSegmentPrice(service);
                const availableSeats = (service.seats || []).filter(s => s.isAvailable).length;

                return (
                  <div 
                    key={service._id} 
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-gray-700/80 transition-all shadow-lg"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-900/60 font-mono">
                          {service.bus?.patente || 'BUS ELEGIDO'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {service.layout?.tipo_Asiento_piso_1} {service.layout?.pisos === 2 ? `+ ${service.layout?.tipo_Asiento_piso_2}` : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-center">
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Salida</p>
                          <p className="text-lg font-bold text-white">
                            {depOrigin ? new Date(depOrigin.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '00:00'} hrs
                          </p>
                          <p className="text-xs text-gray-400 truncate">{searchedParams.origin}</p>
                        </div>
                        <div className="hidden sm:block text-center text-gray-500 relative">
                          <span className="text-[10px] absolute top-[-14px] left-1/2 -translate-x-1/2">
                            {depOrigin && depDest ? Math.round((new Date(depDest.time) - new Date(depOrigin.time)) / 60000) : 0} min
                          </span>
                          <div className="h-[1px] bg-gray-800 w-full" />
                          <ArrowRight size={14} className="mx-auto text-indigo-500 mt-1" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Llegada</p>
                          <p className="text-lg font-bold text-white">
                            {depDest ? new Date(depDest.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '00:00'} hrs
                          </p>
                          <p className="text-xs text-gray-400 truncate">{searchedParams.destination}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col justify-between items-center md:items-end w-full md:w-auto border-t md:border-t-0 border-gray-800 pt-4 md:pt-0 gap-4">
                      <div className="text-left md:text-right">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Precio por Pasaje</p>
                        <p className="text-xl font-black text-emerald-400 font-mono">{formatPrice(price)}</p>
                        <span className="text-xs text-gray-400 font-medium">
                          {availableSeats > 0 ? `${availableSeats} Asientos libres` : 'Completo'}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleSelectService(service)}
                        disabled={availableSeats === 0}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 font-bold rounded-xl text-xs flex items-center gap-1 transition-all shadow-md"
                      >
                        Seleccionar Asiento
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: SELECCIÓN DE ASIENTO Y DATOS DE PASAJERO */}
        {step === 3 && selectedService && (
          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
            
            {/* Lado Izquierdo: Mapa de Asientos */}
            <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-6 flex flex-col items-center">
              
              <div className="w-full flex items-center justify-between border-b border-gray-800 pb-4">
                <div>
                  <h3 className="font-bold text-lg text-white">Mapa de Asientos</h3>
                  <p className="text-xs text-gray-400">Distribución física del bus. Escoja su asiento.</p>
                </div>
                <button 
                  onClick={() => setStep(2)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft size={14} /> Volver a horarios
                </button>
              </div>

              {serviceDetailError && (
                <div className="w-full flex items-center gap-3 p-4 bg-red-950/20 border border-red-800/50 rounded-2xl text-red-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{serviceDetailError}</span>
                </div>
              )}

              {/* Selector de Piso (Solo si tiene 2 pisos) */}
              {selectedService.layout?.pisos === 2 && (
                <div className="grid grid-cols-2 bg-gray-950 p-1 rounded-xl border border-gray-800 w-full max-w-xs">
                  <button
                    onClick={() => setActiveFloor(1)}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      activeFloor === 1 ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Piso 1 ({selectedService.layout?.tipo_Asiento_piso_1})
                  </button>
                  <button
                    onClick={() => setActiveFloor(2)}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      activeFloor === 2 ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Piso 2 ({selectedService.layout?.tipo_Asiento_piso_2})
                  </button>
                </div>
              )}

              {/* Layout del Bus con el volante en la parte superior/delantera */}
              <div className="bg-gray-955 p-6 rounded-3xl border border-gray-800 relative w-full max-w-sm shadow-inner flex flex-col items-center">
                
                {/* Delantera del Bus (Cabina Chofer) */}
                <div className="w-full border-b-2 border-dashed border-gray-800 pb-4 mb-6 flex justify-between items-center text-gray-500 px-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Bus size={18} className="text-gray-400" />
                    <span>FRENTE</span>
                  </div>
                  {/* Icono Volante */}
                  <div className="w-8 h-8 rounded-full border-2 border-gray-700 flex items-center justify-center relative">
                    <div className="w-4 h-4 rounded-full border border-gray-700 flex items-center justify-center">
                      <div className="h-full w-[1px] bg-gray-700 absolute" />
                      <div className="w-full h-[1px] bg-gray-700 absolute" />
                    </div>
                  </div>
                </div>

                {/* Grid de Asientos */}
                <div className="flex flex-col gap-3 w-full">
                  {((activeFloor === 1 ? selectedService.layout?.floor1 : selectedService.layout?.floor2) || []).map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-2 justify-center w-full">
                      {row.map((cell, cIdx) => {
                        const isAisle = cell.code === '' || cell.missing;
                        if (isAisle) {
                          return (
                            <div 
                              key={cIdx} 
                              className="w-10 h-10 flex items-center justify-center text-[10px] text-gray-700 font-bold select-none"
                            >
                              -
                            </div>
                          );
                        }

                        // Verificar disponibilidad
                        const now = new Date();
                        const isOccupied = cell.status === 'confirmed' || (cell.status === 'reserved' && cell.holdUntil && new Date(cell.holdUntil) > now);
                        const isChosen = selectedSeat && selectedSeat.code === cell.code && selectedSeat.floor === cell.floor;

                        return (
                          <button
                            type="button"
                            key={cIdx}
                            disabled={isOccupied}
                            onClick={() => setSelectedSeat(cell)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-all border ${
                              isOccupied
                                ? 'bg-gray-800/60 text-gray-600 border-gray-800 cursor-not-allowed'
                                : isChosen
                                ? 'bg-yellow-500 text-gray-950 border-yellow-400 font-extrabold scale-110 shadow-lg shadow-yellow-500/20'
                                : 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30 hover:bg-indigo-900/60 shadow'
                            }`}
                            title={`Asiento ${cell.code} - ${cell.type}`}
                          >
                            {cell.code}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Trasera del Bus */}
                <div className="w-full border-t-2 border-dashed border-gray-800 mt-6 pt-3 text-center text-[10px] font-bold text-gray-600 tracking-widest">
                  TRASERA
                </div>
              </div>

              {/* Leyenda del Mapa */}
              <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-indigo-950/40 border border-indigo-500/30"></span>
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-yellow-500 border border-yellow-400"></span>
                  <span>Seleccionado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-gray-800 border border-gray-800"></span>
                  <span>Ocupado</span>
                </div>
              </div>
            </div>

            {/* Lado Derecho: Datos del Pasajero */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg text-white mb-2">Datos del Pasajero</h3>
                <p className="text-xs text-gray-400">Ingrese el RUT para consultar sus datos y registrar la reserva.</p>
                <div className="h-[1px] bg-gray-850 w-full my-4" />

                {passengerError && (
                  <div className="mb-4 flex items-center gap-2.5 p-3 bg-red-950/20 border border-red-800/40 rounded-xl text-red-200 text-xs">
                    <AlertCircle size={15} className="shrink-0 text-red-400" />
                    <span>{passengerError}</span>
                  </div>
                )}

                <form onSubmit={handleReserveSeat} className="space-y-4">
                  {/* RUT */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">RUT / Identificación *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="12345678-9"
                        value={rut}
                        onChange={(e) => setRut(e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyRut}
                        disabled={searchingPassenger || !rut.trim()}
                        className="px-3 bg-indigo-950 border border-indigo-900 hover:bg-indigo-900 disabled:opacity-40 text-indigo-300 font-semibold rounded-xl text-xs transition-all flex items-center gap-1 focus:outline-none"
                      >
                        {searchingPassenger ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        <span>Verificar</span>
                      </button>
                    </div>
                  </div>

                  {/* Nombre */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Nombre Completo *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <User size={14} />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Juan Pérez"
                        value={passengerName}
                        onChange={(e) => setPassengerName(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Correo Electrónico *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <Mail size={14} />
                      </span>
                      <input
                        type="email"
                        required
                        placeholder="ejemplo@correo.com"
                        value={passengerEmail}
                        onChange={(e) => setPassengerEmail(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {passengerExists && (
                    <div className="flex items-center gap-2 p-2 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-emerald-300 text-xs">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span>Pasajero registrado encontrado.</span>
                    </div>
                  )}

                  {/* Detalle de selección */}
                  <div className="bg-gray-950/60 p-4 border border-gray-850 rounded-2xl space-y-3 mt-6">
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Resumen de Pasaje</h4>
                    <div className="space-y-1.5 text-xs text-gray-300 font-medium">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Servicio:</span>
                        <span>{searchedParams.origin} → {searchedParams.destination}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Fecha:</span>
                        <span>{new Date(searchedParams.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Asiento Seleccionado:</span>
                        <span className={selectedSeat ? 'text-yellow-400 font-bold' : 'text-gray-500'}>
                          {selectedSeat ? `${selectedSeat.code} (${selectedSeat.type})` : 'Ninguno'}
                        </span>
                      </div>
                      <div className="h-[1px] bg-gray-850 my-2" />
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Total a pagar:</span>
                        <span className="text-emerald-400 font-black font-mono">
                          {formatPrice(getSegmentPrice(selectedService))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={reserving || !selectedSeat}
                    className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 font-bold rounded-2xl transition-all shadow-md flex justify-center items-center gap-1.5 text-xs"
                  >
                    {reserving ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        <span>Bloqueando asiento...</span>
                      </>
                    ) : (
                      <>
                        <span>Continuar al Pago</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

        {/* STEP 4: SIMULACIÓN DE PAGO */}
        {step === 4 && selectedService && selectedSeat && (
          <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 no-print">
            
            {/* Lado Izquierdo: Simulación Tarjeta */}
            <div className="flex flex-col justify-center items-center gap-6">
              
              {/* Tarjeta de Crédito Premium Flotante */}
              <div className="w-full max-w-sm h-52 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-700 to-pink-500 p-6 flex flex-col justify-between text-white shadow-2xl relative overflow-hidden transform hover:scale-105 transition-all">
                {/* Efecto de luz */}
                <div className="absolute top-[-30%] right-[-20%] w-48 h-48 bg-white/10 rounded-full blur-[40px]" />
                
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs font-semibold tracking-widest text-white/80">VISA SIMULADO</span>
                  {/* Microchip */}
                  <div className="w-10 h-8 rounded-lg bg-yellow-400/90 border border-yellow-300 shadow-inner flex flex-col gap-1 p-1">
                    <div className="h-[2px] bg-yellow-600/40 w-full" />
                    <div className="h-[2px] bg-yellow-600/40 w-full" />
                    <div className="h-[2px] bg-yellow-600/40 w-full" />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Card Number */}
                  <p className="font-mono text-lg sm:text-xl font-bold tracking-widest">
                    {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                  </p>
                  
                  <div className="flex justify-between text-xs font-mono">
                    <div>
                      <p className="text-[9px] uppercase text-white/60">Titular</p>
                      <p className="font-bold uppercase truncate max-w-[160px]">{cardName || 'NOMBRE COMPLETO'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-white/60">Vence</p>
                      <p className="font-bold">{cardExpiry || 'MM/YY'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen */}
              <div className="w-full max-w-sm bg-gray-900 border border-gray-800 p-5 rounded-2xl space-y-3 shadow-md">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Pasaje Seleccionado</h4>
                <div className="space-y-2 text-xs font-medium text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pasajero:</span>
                    <span className="text-white font-bold">{passengerName} ({rut})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tramo:</span>
                    <span>{searchedParams.origin} → {searchedParams.destination}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Asiento:</span>
                    <span className="text-yellow-400 font-bold">N° {selectedSeat.code}</span>
                  </div>
                  <div className="h-[1px] bg-gray-850 my-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total a debitar:</span>
                    <span className="text-emerald-400 font-black font-mono">{formatPrice(getSegmentPrice(selectedService))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lado Derecho: Formulario de Pago */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6">
              
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <div>
                  <h3 className="font-bold text-lg text-white">Pasarela de Pago</h3>
                  <p className="text-xs text-gray-400">Ingrese sus credenciales de tarjeta de crédito.</p>
                </div>
                <button
                  onClick={() => handleReleaseSeat(false)}
                  disabled={paying}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold disabled:opacity-40"
                >
                  Cancelar reserva
                </button>
              </div>

              {paymentError && (
                <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800/50 rounded-2xl text-red-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{paymentError}</span>
                </div>
              )}

              {paying ? (
                /* Pantalla de carga animada */
                <div className="py-12 flex flex-col justify-center items-center gap-4 text-center">
                  <Loader className="animate-spin text-indigo-500" size={36} />
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-white">Procesando Transacción...</p>
                    <p className="text-xs text-indigo-400 font-mono tracking-wider animate-pulse">{paymentStepText}</p>
                  </div>
                  <div className="w-full max-w-xs bg-gray-950 h-1.5 rounded-full overflow-hidden border border-gray-800 mt-4">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full animate-loading-bar" style={{width: '60%'}}></div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmPayment} className="space-y-4">
                  {/* Titular */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Titular de Tarjeta *</label>
                    <input
                      type="text"
                      required
                      placeholder="JUAN PEREZ"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-indigo-500 uppercase font-mono"
                    />
                  </div>

                  {/* Número Tarjeta */}
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Número de Tarjeta *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        <CreditCard size={14} />
                      </span>
                      <input
                        type="text"
                        required
                        maxLength={16}
                        placeholder="4500000000000000"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-8 pr-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Expiración */}
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Expiración *</label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length > 2) {
                            val = val.slice(0, 2) + '/' + val.slice(2, 4);
                          }
                          setCardExpiry(val);
                        }}
                        className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-indigo-500 font-mono text-center"
                      />
                    </div>

                    {/* CVV */}
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Código CVV *</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-gray-200 text-xs focus:outline-none focus:border-indigo-500 font-mono text-center"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-gray-950/40 border border-gray-850 rounded-xl text-[10px] text-gray-500 mt-4">
                    <Info size={14} className="shrink-0 text-indigo-400" />
                    <span>Esto es una simulación de transacción bancaria de prueba. Ningún fondo real será transferido o deducido de su cuenta.</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-4 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-600/10 flex justify-center items-center gap-1.5 text-xs"
                  >
                    <span>Simular Pago Seguro</span>
                    <Check size={16} />
                  </button>
                </form>
              )}
            </div>

          </div>
        )}

        {/* STEP 5: EMISIÓN E IMPRESIÓN DE BOLETO */}
        {step === 5 && confirmedTicket && (
          <div className="max-w-xl mx-auto w-full space-y-6">
            
            {/* Cabecera éxito no-print */}
            <div className="text-center space-y-3 no-print">
              <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-md">
                <Check size={32} />
              </div>
              <h2 className="text-2xl font-extrabold text-white">¡Compra Realizada con Éxito!</h2>
              <p className="text-xs text-gray-400">El boleto se ha registrado y el asiento está confirmado. Puede imprimir su pase de viaje.</p>
            </div>

            {/* Boleto de Abordaje Premium (Es lo que se imprimirá) */}
            <div id="printable-ticket" className="bg-white text-gray-950 rounded-3xl overflow-hidden shadow-2xl border border-gray-200">
              
              {/* Encabezado del Ticket */}
              <div className="bg-indigo-650 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white border border-white/20">B</div>
                  <div>
                    <h3 className="font-black text-md leading-none">PASAJES PARAGUAY</h3>
                    <span className="text-[9px] uppercase tracking-wider text-indigo-200">Boleto Electrónico de Bus</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase text-indigo-200">N° de Boleto</p>
                  <p className="font-mono font-bold text-sm tracking-wide">{confirmedTicket.ticketNumber}</p>
                </div>
              </div>

              {/* Cuerpo del Ticket */}
              <div className="p-6 space-y-6">
                
                {/* Tramo Principal */}
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">Salida</p>
                    <p className="text-md font-extrabold text-gray-900">{confirmedTicket.origin}</p>
                    <p className="text-xs text-gray-600 font-semibold">{new Date(confirmedTicket.date).toLocaleDateString()}</p>
                  </div>
                  
                  <div className="flex flex-col items-center text-indigo-650 font-bold px-4">
                    <ArrowRight size={20} />
                    <span className="text-[9px] uppercase text-gray-400 mt-1">Viaje Directo</span>
                  </div>

                  <div className="text-right">
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">Destino</p>
                    <p className="text-md font-extrabold text-gray-900">{confirmedTicket.destination}</p>
                    <p className="text-xs text-gray-600 font-semibold">T+ Estimado</p>
                  </div>
                </div>

                {/* Detalles del Pasajero y Asiento */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs border-b border-gray-150 pb-5">
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Pasajero</p>
                    <p className="font-bold text-gray-900">{confirmedTicket.passenger.name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">RUT Pasajero</p>
                    <p className="font-mono font-bold text-gray-900">{confirmedTicket.passenger.rut}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Asiento Asignado</p>
                    <p className="font-bold text-indigo-650 text-sm">N° {confirmedTicket.seat.code} ({confirmedTicket.seat.type})</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Piso</p>
                    <p className="font-bold text-gray-900">Piso {confirmedTicket.seat.floor}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Bus / Patente</p>
                    <p className="font-mono font-bold text-gray-900">{confirmedTicket.service.bus?.patente || 'CON PATENTE'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest">Monto Pagado</p>
                    <p className="font-mono font-bold text-emerald-650 text-sm">{formatPrice(confirmedTicket.price)}</p>
                  </div>
                </div>

                {/* QR Code Simulado y Condiciones */}
                <div className="flex justify-between items-center pt-2">
                  <div className="space-y-1 max-w-[280px]">
                    <p className="text-[9px] text-gray-450 uppercase tracking-widest">Términos del Viaje</p>
                    <p className="text-[9px] text-gray-500 leading-tight">Preséntese en el terminal 15 minutos antes de la hora estipulada de salida. Lleve consigo su boleto impreso o digital y su cédula de identidad.</p>
                  </div>

                  {/* QR Box */}
                  <div className="w-16 h-16 bg-gray-50 border border-gray-200 rounded-xl p-1.5 flex flex-col justify-between items-center shadow-inner shrink-0">
                    {/* Dibujo QR Simulado */}
                    <div className="grid grid-cols-4 gap-[2px] w-full h-full">
                      {[1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0].map((v, i) => (
                        <div key={i} className={`rounded-[1px] ${v === 1 ? 'bg-gray-950' : 'bg-transparent'}`} />
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Acciones No-Print */}
            <div className="flex gap-4 no-print justify-center pt-4">
              <button
                onClick={handlePrint}
                className="px-6 py-3 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-2xl text-xs flex items-center gap-2 transition-all shadow-md"
              >
                <Printer size={16} />
                <span>Imprimir Boleto (window.print)</span>
              </button>
              
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-850 font-bold rounded-2xl text-xs transition-all"
              >
                Vender Otro Pasaje
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer no-print */}
      <footer className="border-t border-gray-900 bg-gray-950 py-6 text-center text-xs text-gray-600 no-print mt-auto">
        <p>© 2026 Pasajes Paraguay S.A. Todos los derechos reservados. Módulo de Venta Directa.</p>
      </footer>

    </div>
  );
}

export default App;
