import React from 'react';
import {
  Box, Typography, Button, Card, Chip, Grid, TextField, MenuItem,
  InputAdornment, IconButton, Divider,
} from '@mui/material';
import { Add, Delete, Hotel as HotelIcon, DirectionsBus } from '@mui/icons-material';
import { fmtCurrency } from '../utils/helpers';
import { numericOnly, decimalOnly } from '../utils/validation';

export const VEHICLE_TYPES = ['Sedan', 'SUV (GMC)', 'Van (Hiace)', 'Coaster', 'Bus (50-seater)', 'VIP'];
export const EMPTY_HOTEL_TRIP = { hotelId: '', hotelName: '', checkInDate: '', checkOutDate: '', rooms: '1', perNightPrice: '' };
export const EMPTY_TRANSPORT_TRIP = { vehicleType: '', pickupLocation: '', dropoffLocation: '', travelDate: '', passengerCount: '', price: '' };

export function tripNights(ci, co) {
  if (!ci || !co) return 0;
  const a = new Date(ci), b = new Date(co);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  const d = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  return d > 0 ? d : 0;
}
export const hotelLine = (t) => Math.max(1, Number(t.rooms || 1)) * tripNights(t.checkInDate, t.checkOutDate) * Number(t.perNightPrice || 0);
export const transportLine = (t) => Number(t.price || 0);
export const computeTripsTotal = (hotelTrips, transportTrips) =>
  (hotelTrips || []).reduce((s, t) => s + hotelLine(t), 0) + (transportTrips || []).reduce((s, t) => s + transportLine(t), 0);

// Shared hotel + transport itinerary editor used by both the booking create form
// (BookingsPage) and the booking edit dialog (BookingDetailPage). The parent owns
// the trip arrays and passes setters so behaviour stays identical across both.
export default function BookingTripsEditor({ hotelTrips, setHotelTrips, transportTrips, setTransportTrips, hotels = [], showTotal = true }) {
  const addHotelTrip = () => setHotelTrips((a) => [...a, { ...EMPTY_HOTEL_TRIP }]);
  const updateHotelTrip = (i, patch) => setHotelTrips((a) => a.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeHotelTrip = (i) => setHotelTrips((a) => a.filter((_, idx) => idx !== i));
  const onHotelPick = (i, hotelId) => {
    const h = hotels.find((x) => x.id === hotelId);
    updateHotelTrip(i, { hotelId, hotelName: h?.name || '', perNightPrice: h?.pricePerNight != null ? String(h.pricePerNight) : hotelTrips[i].perNightPrice });
  };
  const addTransportTrip = () => setTransportTrips((a) => [...a, { ...EMPTY_TRANSPORT_TRIP }]);
  const updateTransportTrip = (i, patch) => setTransportTrips((a) => a.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeTransportTrip = (i) => setTransportTrips((a) => a.filter((_, idx) => idx !== i));

  const tripsTotal = computeTripsTotal(hotelTrips, transportTrips);
  const count = (hotelTrips?.length || 0) + (transportTrips?.length || 0);

  return (
    <>
      {/* ── Hotel Trips ─────────────────────────────────────────── */}
      <Divider sx={{ mb: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <HotelIcon fontSize="small" /> Hotel Trips ({hotelTrips.length})
        </Typography>
        <Button size="small" startIcon={<Add />} variant="outlined" onClick={addHotelTrip}>Add Hotel</Button>
      </Box>
      {hotelTrips.map((t, i) => (
        <Card key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Chip size="small" label={`Hotel ${i + 1}`} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {fmtCurrency(hotelLine(t))} ({Math.max(1, Number(t.rooms || 1))} rm × {tripNights(t.checkInDate, t.checkOutDate)} n)
              </Typography>
              <IconButton size="small" color="error" onClick={() => removeHotelTrip(i)}><Delete fontSize="small" /></IconButton>
            </Box>
          </Box>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth size="small" label="Hotel" value={t.hotelId} onChange={(e) => onHotelPick(i, e.target.value)}>
                {hotels.length === 0 && <MenuItem value="" disabled>No hotels — add hotels first</MenuItem>}
                {hotels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}{h.city ? ` — ${h.city}` : ''}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Per Night Price"
                InputProps={{ startAdornment: <InputAdornment position="start">SAR</InputAdornment> }}
                inputProps={{ onKeyDown: decimalOnly }} value={t.perNightPrice}
                onChange={(e) => updateHotelTrip(i, { perNightPrice: e.target.value })} />
            </Grid>
            <Grid item xs={4} sm={4}>
              <TextField fullWidth size="small" type="number" label="Rooms" inputProps={{ min: 1, onKeyDown: numericOnly }}
                value={t.rooms} onChange={(e) => updateHotelTrip(i, { rooms: e.target.value })} />
            </Grid>
            <Grid item xs={8} sm={4}>
              <TextField fullWidth size="small" type="date" label="Check-in" InputLabelProps={{ shrink: true }}
                value={t.checkInDate} onChange={(e) => updateHotelTrip(i, { checkInDate: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="Check-out" InputLabelProps={{ shrink: true }}
                inputProps={{ min: t.checkInDate || undefined }}
                value={t.checkOutDate} onChange={(e) => updateHotelTrip(i, { checkOutDate: e.target.value })} />
            </Grid>
          </Grid>
        </Card>
      ))}

      {/* ── Transport Trips ─────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, mt: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <DirectionsBus fontSize="small" /> Transport Trips ({transportTrips.length})
        </Typography>
        <Button size="small" startIcon={<Add />} variant="outlined" onClick={addTransportTrip}>Add Transport</Button>
      </Box>
      {transportTrips.map((t, i) => (
        <Card key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Chip size="small" label={`Transport ${i + 1}`} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">{fmtCurrency(transportLine(t))}</Typography>
              <IconButton size="small" color="error" onClick={() => removeTransportTrip(i)}><Delete fontSize="small" /></IconButton>
            </Box>
          </Box>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth size="small" label="Vehicle Type" value={t.vehicleType}
                onChange={(e) => updateTransportTrip(i, { vehicleType: e.target.value })}>
                {VEHICLE_TYPES.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" type="date" label="Travel Date" InputLabelProps={{ shrink: true }}
                value={t.travelDate} onChange={(e) => updateTransportTrip(i, { travelDate: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Pickup Location" value={t.pickupLocation}
                onChange={(e) => updateTransportTrip(i, { pickupLocation: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Drop-off Location" value={t.dropoffLocation}
                onChange={(e) => updateTransportTrip(i, { dropoffLocation: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={6}>
              <TextField fullWidth size="small" type="number" label="No. of Passengers" inputProps={{ min: 1, onKeyDown: numericOnly }}
                value={t.passengerCount} onChange={(e) => updateTransportTrip(i, { passengerCount: e.target.value })} />
            </Grid>
            <Grid item xs={6} sm={6}>
              <TextField fullWidth size="small" label="Trip Price"
                InputProps={{ startAdornment: <InputAdornment position="start">SAR</InputAdornment> }}
                inputProps={{ onKeyDown: decimalOnly }} value={t.price}
                onChange={(e) => updateTransportTrip(i, { price: e.target.value })} />
            </Grid>
          </Grid>
        </Card>
      ))}

      {showTotal && count > 0 && (
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#0D2B1A', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Typography variant="body2">Itinerary Total ({count} item{count > 1 ? 's' : ''})</Typography>
          <Typography variant="h6" sx={{ color: '#C9A227', fontWeight: 800 }}>{fmtCurrency(tripsTotal)}</Typography>
        </Box>
      )}
    </>
  );
}
