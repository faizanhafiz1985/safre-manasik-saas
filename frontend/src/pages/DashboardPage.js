import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Card, CardContent, Typography, Box, Chip, CircularProgress, Avatar, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { BookOnline, People, CardTravel, AttachMoney, TrendingUp, CheckCircle, HourglassEmpty, Cancel } from '@mui/icons-material';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { fmtCurrency, fmtDate, statusChip } from '../utils/helpers';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const StatCard = ({ title, value, icon, color, sub }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>{title}</Typography>
          <Typography variant="h4" fontWeight={800}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </Box>
        <Avatar sx={{ bgcolor: color + '22', width: 48, height: 48 }}>{React.cloneElement(icon, { sx: { color } })}</Avatar>
      </Box>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const { user, isCustomer } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isCustomer) { setLoading(false); return; }
    api.get('/dashboard/stats').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [isCustomer]);

  if (isCustomer) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>Welcome, {user?.name}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Manage your Umrah bookings and view travel details.</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}><Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }} onClick={() => navigate('/bookings')}><CardContent sx={{ textAlign: 'center', py: 4 }}><BookOnline sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} /><Typography variant="h6">My Bookings</Typography></CardContent></Card></Grid>
          <Grid item xs={12} sm={6}><Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }} onClick={() => navigate('/packages')}><CardContent sx={{ textAlign: 'center', py: 4 }}><CardTravel sx={{ fontSize: 48, color: 'secondary.main', mb: 1 }} /><Typography variant="h6">Browse Packages</Typography></CardContent></Card></Grid>
          <Grid item xs={12} sm={6}><Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }} onClick={() => navigate('/vouchers')}><CardContent sx={{ textAlign: 'center', py: 4 }}><CheckCircle sx={{ fontSize: 48, color: 'warning.main', mb: 1 }} /><Typography variant="h6">My Vouchers</Typography></CardContent></Card></Grid>
        </Grid>
      </Box>
    );
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const stats = data?.stats || {};
  const chartData = {
    labels: (data?.bookingsByMonth || []).map((b) => b.month),
    datasets: [{ label: 'Bookings', data: (data?.bookingsByMonth || []).map((b) => Number(b.count)), backgroundColor: '#1B4B35', borderRadius: 6 }],
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1B4B35">Dashboard</Typography>
        <Typography color="text.secondary">Welcome back, {user?.name}. Here's your system overview.</Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Total Bookings" value={stats.totalBookings || 0} icon={<BookOnline />} color="#1B4B35" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Confirmed" value={stats.confirmedBookings || 0} icon={<CheckCircle />} color="#16a34a" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Tentative" value={stats.tentativeBookings || 0} icon={<HourglassEmpty />} color="#C9A227" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Cancelled" value={stats.cancelledBookings || 0} icon={<Cancel />} color="#DC2626" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Total Revenue" value={fmtCurrency(stats.totalRevenue)} icon={<AttachMoney />} color="#2E6B4F" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Customers" value={stats.totalCustomers || 0} icon={<People />} color="#C9A227" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Agents" value={stats.totalAgents || 0} icon={<TrendingUp />} color="#1B4B35" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title="Active Packages" value={stats.totalPackages || 0} icon={<CardTravel />} color="#2E6B4F" /></Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>Bookings - Last 6 Months</Typography>
              <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>Recent Bookings</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Customer</TableCell><TableCell>Package</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>
                    {(data?.recentBookings || []).map((b) => (
                      <TableRow key={b.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/${b.id}`)}>
                        <TableCell>{b.customer?.name}</TableCell>
                        <TableCell><Typography variant="caption">{b.package?.name?.substring(0, 20)}...</Typography></TableCell>
                        <TableCell>{statusChip(b.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
