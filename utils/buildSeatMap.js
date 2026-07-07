function buildSeatMap(service, originName, destName) {
    const layout = service.layout ? (service.layout.toObject ? service.layout.toObject() : { ...service.layout }) : {};

    let originOrder = null;
    let destOrder = null;
    if (originName && destName && service.departures) {
        const depOrigin = service.departures.find(d => d.stop === originName);
        const depDest = service.departures.find(d => d.stop === destName);
        if (depOrigin && depDest) {
            originOrder = depOrigin.order;
            destOrder = depDest.order;
        }
    }

    ["floor1", "floor2"].forEach(floorKey => {
        const floorLayout = layout[floorKey];
        if (!floorLayout || !floorLayout.seatMap) return;

        layout[floorKey] = floorLayout.seatMap.map(row =>
            row.map(code => {
                // buscar el asiento correspondiente en service.seats
                const seatDoc = (service.seats || []).find(
                    s => s.code === code && s.floor === (floorKey === "floor1" ? 1 : 2)
                );
                if (!seatDoc) return { code, missing: true };

                const seat = seatDoc.toObject ? seatDoc.toObject() : { ...seatDoc };

                // Lógica de tramos segmentados
                let status = 'available';
                let isAvailable = true;
                let holdUntil = null;
                let passenger = null;

                const now = new Date();

                if (originOrder !== null && destOrder !== null && seat.reservations && seat.reservations.length > 0) {
                    const activeReservation = seat.reservations.find(r => {
                        const isActive = r.status === 'confirmed' || (r.status === 'reserved' && r.holdUntil && new Date(r.holdUntil) > now);
                        if (!isActive) return false;
                        return originOrder < r.destinationOrder && r.originOrder < destOrder;
                    });

                    if (activeReservation) {
                        status = activeReservation.status;
                        isAvailable = false;
                        holdUntil = activeReservation.holdUntil;
                        passenger = {
                            user: activeReservation.user,
                            origin: activeReservation.origin,
                            destination: activeReservation.destination
                        };
                    }
                } else if (seat.reservations && seat.reservations.length > 0) {
                    // Si no hay tramo de consulta, pero tiene alguna reserva activa en general
                    const activeReservation = seat.reservations.find(r =>
                        r.status === 'confirmed' || (r.status === 'reserved' && r.holdUntil && new Date(r.holdUntil) > now)
                    );
                    if (activeReservation) {
                        status = activeReservation.status;
                        isAvailable = false;
                        holdUntil = activeReservation.holdUntil;
                        passenger = {
                            user: activeReservation.user,
                            origin: activeReservation.origin,
                            destination: activeReservation.destination
                        };
                    }
                } else {
                    // Fallback para datos legacy
                    status = seat.status || 'available';
                    isAvailable = seat.isAvailable !== false;
                    holdUntil = seat.holdUntil || null;
                    passenger = seat.passenger || null;
                }

                return {
                    ...seat,
                    status,
                    isAvailable,
                    holdUntil,
                    passenger
                };
            })
        );
    });

    return layout;
}

module.exports = { buildSeatMap };
