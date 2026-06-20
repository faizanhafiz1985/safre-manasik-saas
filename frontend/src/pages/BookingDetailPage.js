import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Grid, Chip, Button, Divider, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, MenuItem, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import { ArrowBack, ConfirmationNumber, Print, Add, Payment, Edit, Block } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { fmtCurrency, fmtDate, statusChip } from '../utils/helpers';
import { decimalOnly } from '../utils/validation';
import { useForm } from 'react-hook-form';

const InfoRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', py: 0.75, borderBottom: '1px solid #f1f5f9' }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160, fontWeight: 600 }}>{label}</Typography>
    <Typography variant="body2">{value || '-'}</Typography>
  </Box>
);

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isAgent } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusDialog, setStatusDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [vouchers, setVouchers] = useState([]);

  const { register: regPay, handleSubmit: hsPay, reset: resetPay } = useForm();

  const load = () => {
    setLoading(true);
    api.get(`/bookings/${id}`).then((r) => {
      setBooking(r.data);
      setNewStatus(r.data.status);
    }).catch((err) => toast.error(err.response?.data?.error || 'Failed to load booking')).finally(() => setLoading(false));
    api.get('/vouchers', { params: { bookingId: id } }).then((r) => setVouchers(r.data || [])).catch(() => {});
  };

  // A booking may hold at most one valid voucher of each type.
  const hasVoucher = (type) => vouchers.some((v) => v.type === type && v.isValid !== false);

  useEffect(() => {
    load();
    if (isAdmin || isAgent) {
      api.get('/transport/vehicles').then((r) => setVehicles(r.data || [])).catch(()=>{});
      api.get('/transport/routes').then((r) => setRoutes(r.data || [])).catch(()=>{});
      api.get('/catering/meal-plans').then((r) => setMealPlans(r.data || [])).catch(()=>{});
    }
  }, [id]);

  const handleStatusUpdate = async () => {
    try {
      await api.patch(`/bookings/${id}/status`, { status: newStatus });
      toast.success('Status updated');
      setStatusDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const openEdit = () => {
    setEditForm({
      travelDateFrom: booking.travelDateFrom ? String(booking.travelDateFrom).substring(0, 10) : '',
      travelDateTo: booking.travelDateTo ? String(booking.travelDateTo).substring(0, 10) : '',
      totalPax: booking.totalPax || 1,
      totalAmount: Number(booking.totalAmount || 0),
      notes: booking.notes || '',
    });
    setEditDialog(true);
  };

  const saveEdit = async () => {
    try {
      await api.put(`/bookings/${id}`, {
        travelDateFrom: editForm.travelDateFrom,
        travelDateTo: editForm.travelDateTo,
        totalPax: Number(editForm.totalPax),
        totalAmount: Number(editForm.totalAmount),
        notes: editForm.notes,
      });
      toast.success('Booking updated');
      setEditDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update booking');
    }
  };

  const cancelBooking = async () => {
    if (!window.confirm(`Cancel booking ${booking.bookingRef}? This sets its status to Cancelled.`)) return;
    try {
      await api.patch(`/bookings/${id}/status`, { status: 'CANCELLED' });
      toast.success('Booking cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel booking');
    }
  };

  const generateVoucher = async (type) => {
    try {
      const res = await api.post('/vouchers/generate', { bookingId: id, type });
      toast.success(`${type === 'CONFIRMED' ? 'Confirmed' : 'Tentative'} voucher generated (${res.data.voucherNo || ''})`);
      navigate('/vouchers');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate voucher');
    }
  };

  const previewVoucher = async (type) => {
    try {
      const res = await api.get(`/vouchers/preview/${id}?type=${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      toast.error('Preview failed');
    }
  };

  const onPayment = async (data) => {
    try {
      await api.post('/payments', { bookingId: id, ...data, amount: Number(data.amount) });
      toast.success('Payment recorded');
      setPaymentDialog(false);
      resetPay();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  if (!booking) return <Alert severity="error">Booking not found</Alert>;

  const makkahHotel = booking.package?.packageHotels?.find((ph) => ph.city === 'MAKKAH')?.hotel;
  const madinahHotel = booking.package?.packageHotels?.find((ph) => ph.city === 'MADINAH')?.hotel;
  const invoice = booking.invoice;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/bookings')}>Bookings</Button>
        <Typography variant="h5">Booking: {booking.bookingRef}</Typography>
        {statusChip(booking.status)}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {isAdmin && <Button variant="outlined" onClick={() => setStatusDialog(true)}>Change Status</Button>}
        {(isAdmin || isAgent) && booking.status !== 'CANCELLED' && (
          <Button variant="outlined" startIcon={<Edit />} onClick={openEdit}>Edit</Button>
        )}
        {(isAdmin || isAgent) && booking.status !== 'CANCELLED' && (
          <Button variant="outlined" color="error" startIcon={<Block />} onClick={cancelBooking}>Cancel Booking</Button>
        )}
        <Button
          variant="outlined" startIcon={<ConfirmationNumber />}
          onClick={() => generateVoucher('TENTATIVE')}
          disabled={hasVoucher('TENTATIVE')}
          title={hasVoucher('TENTATIVE') ? 'A Tentative voucher has already been generated for this booking' : ''}
          sx={{ borderColor: '#C9A227', color: '#C9A227', '&:hover': { bgcolor: '#FFF8E6', borderColor: '#C9A227' } }}
        >
          {hasVoucher('TENTATIVE') ? 'Tentative Voucher ✓' : 'Tentative Voucher'}
        </Button>
        <Button
          variant="contained" startIcon={<ConfirmationNumber />}
          onClick={() => generateVoucher('CONFIRMED')}
          disabled={hasVoucher('CONFIRMED')}
          title={hasVoucher('CONFIRMED') ? 'A Confirmed voucher has already been generated for this booking' : ''}
        >
          {hasVoucher('CONFIRMED') ? 'Confirmed Voucher ✓' : 'Confirmed Voucher'}
        </Button>
        <Button variant="outlined" startIcon={<Print />} onClick={() => previewVoucher(booking.status)}>Preview Voucher</Button>
        {(isAdmin || isAgent) && <Button variant="contained" startIcon={<Payment />} onClick={() => setPaymentDialog(true)}>Record Payment</Button>}
        <Button variant="contained" color="warning" sx={{ bgcolor: '#0070BA', '&:hover': { bgcolor: '#005EA6' } }}
          onClick={async () => {
            try {
              const balance = Math.max(0, Number(booking.invoice?.balance ?? booking.totalAmount));
              if (balance <= 0) { toast.info('No balance due'); return; }
              const { data } = await api.post('/payments/gateway/paypal/create-order', {
                bookingId: booking.id, amount: balance, currency: booking.currency || 'SAR',
              });
              if (data.approveUrl) { window.location.href = data.approveUrl; }
              else toast.error('Failed to create PayPal order');
            } catch (e) { toast.error(e.response?.data?.error || 'PayPal init failed'); }
          }}>
          Pay with PayPal
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>Customer Information</Typography>
              <InfoRow label="Customer Name" value={booking.customer?.name} />
              <InfoRow label="Email" value={booking.customer?.email} />
              <InfoRow label="Phone" value={booking.customer?.phone} />
              {booking.agent && <InfoRow label="Agent" value={booking.agent?.companyName || booking.agent?.name} />}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>Travel Details</Typography>
              <InfoRow label="Package" value={booking.package?.name} />
              <InfoRow label="Duration" value={booking.package?.durationDays ? `${booking.package.durationDays} Days` : '-'} />
              <InfoRow label="Departure" value={fmtDate(booking.travelDateFrom)} />
              <InfoRow label="Return" value={fmtDate(booking.travelDateTo)} />
              <InfoRow label="Passengers" value={booking.totalPax} />
              <InfoRow label="Total Amount" value={fmtCurrency(booking.totalAmount)} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>Hotels</Typography>
              {makkahHotel ? (
                <>
                  <Typography variant="caption" fontWeight={700} color="primary.main">MAKKAH</Typography>
                  <InfoRow label="Hotel" value={`${makkahHotel.name} ${'★'.repeat(makkahHotel.stars)}`} />
                  <InfoRow label="Address" value={makkahHotel.address} />
                </>
              ) : <Typography variant="caption" color="text.secondary">No Makkah hotel assigned</Typography>}
              <Divider sx={{ my: 1.5 }} />
              {madinahHotel ? (
                <>
                  <Typography variant="caption" fontWeight={700} color="primary.main">MADINAH</Typography>
                  <InfoRow label="Hotel" value={`${madinahHotel.name} ${'★'.repeat(madinahHotel.stars)}`} />
                  <InfoRow label="Address" value={madinahHotel.address} />
                </>
              ) : <Typography variant="caption" color="text.secondary">No Madinah hotel assigned</Typography>}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>Payment Summary</Typography>
              {invoice ? (
                <>
                  <InfoRow label="Invoice No" value={invoice.invoiceNo} />
                  <InfoRow label="Total" value={fmtCurrency(invoice.totalAmount)} />
                  <InfoRow label="Paid" value={<Typography fontWeight={700} color="success.main" component="span">{fmtCurrency(invoice.paidAmount)}</Typography>} />
                  <InfoRow label="Balance" value={<Typography fontWeight={700} color={invoice.balance > 0 ? 'error.main' : 'success.main'} component="span">{fmtCurrency(invoice.balance)}</Typography>} />
                  <InfoRow label="Status" value={statusChip(invoice.status)} />
                </>
              ) : <Typography variant="caption" color="text.secondary">No invoice</Typography>}
            </CardContent>
          </Card>
        </Grid>

        {booking.passengers?.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>Passengers ({booking.passengers.length})</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>#</TableCell><TableCell>Name</TableCell><TableCell>Passport No</TableCell><TableCell>Nationality</TableCell><TableCell>DOB</TableCell><TableCell>Gender</TableCell></TableRow></TableHead>
                  <TableBody>
                    {booking.passengers.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{p.fullName} {p.isPrimary && <Chip label="Lead" size="small" color="primary" sx={{ ml: 0.5 }} />}</TableCell>
                        <TableCell>{p.passportNo}</TableCell>
                        <TableCell>{p.nationality}</TableCell>
                        <TableCell>{fmtDate(p.dateOfBirth)}</TableCell>
                        <TableCell>{p.gender}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        )}

        {(booking.hotelTrips?.length > 0 || booking.transportTrips?.length > 0) && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>Itinerary</Typography>
                {booking.hotelTrips?.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" fontWeight={700} color="primary.main">Hotel Trips</Typography>
                    <Table size="small">
                      <TableHead><TableRow>
                        <TableCell>#</TableCell><TableCell>Hotel</TableCell><TableCell>Check-in</TableCell><TableCell>Check-out</TableCell>
                        <TableCell align="center">Rooms</TableCell><TableCell align="center">Nights</TableCell>
                        <TableCell align="right">Per Night</TableCell><TableCell align="right">Line Total</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {booking.hotelTrips.map((t, i) => (
                          <TableRow key={i}>
                            <TableCell>{i + 1}</TableCell><TableCell>{t.hotelName}</TableCell>
                            <TableCell>{fmtDate(t.checkInDate)}</TableCell><TableCell>{fmtDate(t.checkOutDate)}</TableCell>
                            <TableCell align="center">{t.rooms ?? 1}</TableCell><TableCell align="center">{t.nights ?? ''}</TableCell>
                            <TableCell align="right">{fmtCurrency(t.perNightPrice)}</TableCell><TableCell align="right">{fmtCurrency(t.lineTotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
                {booking.transportTrips?.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="primary.main">Transport Trips</Typography>
                    <Table size="small">
                      <TableHead><TableRow>
                        <TableCell>#</TableCell><TableCell>Vehicle</TableCell><TableCell>Route</TableCell>
                        <TableCell>Travel Date</TableCell><TableCell align="center">Pax</TableCell><TableCell align="right">Price</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {booking.transportTrips.map((t, i) => (
                          <TableRow key={i}>
                            <TableCell>{i + 1}</TableCell><TableCell>{t.vehicleType}</TableCell>
                            <TableCell>{t.pickupLocation} → {t.dropoffLocation}</TableCell>
                            <TableCell>{fmtDate(t.travelDate)}</TableCell>
                            <TableCell align="center">{t.passengerCount || '—'}</TableCell>
                            <TableCell align="right">{fmtCurrency(t.price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {booking.transports?.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>Transport</Typography>
                {booking.transports.map((t) => (
                  <Box key={t.id}>
                    <InfoRow label="Vehicle" value={t.vehicle?.name} />
                    <InfoRow label="Type" value={t.vehicle?.type} />
                    <InfoRow label="Driver" value={t.vehicle?.driverName} />
                    {t.route && <InfoRow label="Route" value={`${t.route.fromLocation} → ${t.route.toLocation}`} />}
                    {t.departureAt && <InfoRow label="Departure" value={fmtDate(t.departureAt)} />}
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {booking.caterings?.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>Catering</Typography>
                {booking.caterings.map((c) => (
                  <Box key={c.id} sx={{ mb: 1 }}>
                    <InfoRow label="Vendor" value={c.mealPlan?.vendor?.name} />
                    <InfoRow label="Meal Plan" value={c.mealPlan?.name} />
                    <InfoRow label="Meal Type" value={c.mealPlan?.mealType} />
                    <InfoRow label="Pax Count" value={c.paxCount} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {booking.payments?.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>Payment History</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Amount</TableCell><TableCell>Method</TableCell><TableCell>Reference</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>
                    {booking.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{fmtDate(p.paidAt)}</TableCell>
                        <TableCell fontWeight={700}>{fmtCurrency(p.amount)}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell>{p.reference || '-'}</TableCell>
                        <TableCell>{statusChip(p.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Booking</DialogTitle>
        <DialogContent>
          {editForm && (
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={6}>
                <TextField fullWidth label="Departure Date" type="date" InputLabelProps={{ shrink: true }}
                  value={editForm.travelDateFrom} onChange={(e) => setEditForm((f) => ({ ...f, travelDateFrom: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Return Date" type="date" InputLabelProps={{ shrink: true }}
                  value={editForm.travelDateTo} onChange={(e) => setEditForm((f) => ({ ...f, travelDateTo: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Total Pax" type="number" inputProps={{ min: 1 }}
                  value={editForm.totalPax} onChange={(e) => setEditForm((f) => ({ ...f, totalPax: e.target.value }))} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Total Amount (SAR)" type="number" inputProps={{ min: 0, onKeyDown: decimalOnly }}
                  value={editForm.totalAmount} onChange={(e) => setEditForm((f) => ({ ...f, totalAmount: e.target.value }))} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth multiline rows={2} label="Notes"
                  value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={statusDialog} onClose={() => setStatusDialog(false)}>
        <DialogTitle>Change Booking Status</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="New Status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} sx={{ mt: 1 }}>
            <MenuItem value="TENTATIVE">Tentative</MenuItem>
            <MenuItem value="CONFIRMED">Confirmed</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleStatusUpdate}>Update</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)}>
        <DialogTitle>Record Payment</DialogTitle>
        <form onSubmit={hsPay(onPayment)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Amount (SAR)" type="number" inputProps={{ min: 0.01, step: '0.01', onKeyDown: decimalOnly }} {...regPay('amount', { required: true, min: { value: 0.01, message: 'Amount must be positive' } })} /></Grid>
              <Grid item xs={12}><TextField fullWidth select label="Payment Method" defaultValue="CASH" {...regPay('method')}><MenuItem value="CASH">Cash</MenuItem><MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem><MenuItem value="CREDIT_CARD">Credit Card</MenuItem><MenuItem value="CHEQUE">Cheque</MenuItem></TextField></Grid>
              <Grid item xs={12}><TextField fullWidth label="Reference No" {...regPay('reference')} /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Notes" {...regPay('notes')} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="success">Record Payment</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
