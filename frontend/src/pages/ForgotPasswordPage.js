import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, Alert, Tabs, Tab,
} from '@mui/material';
import { Email, ArrowBack, CheckCircle, Person } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import BrandLogo from '../components/BrandLogo';

// ─── Shared page chrome ─────────────────────────────────────────────────────
function PageShell({ children }) {
  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0D2B1A 0%, #1B4B35 45%, #2E6B4F 100%)',
      p: 2, position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', border: '1px solid rgba(201,162,39,0.15)', top: -100, left: -100 }} />
      <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(201,162,39,0.1)', bottom: -80, right: -80 }} />

      <Box sx={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          textAlign: 'center', mb: 2.5, bgcolor: 'rgba(255,255,255,0.97)',
          borderRadius: 3, py: 2, px: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}>
          <BrandLogo variant="full" maxHeight={110} />
          <Typography variant="caption" sx={{ display: 'block', color: '#1B4B35', mt: 0.5, fontWeight: 600, letterSpacing: 0.5 }}>
            UMRAH · HAJJ · TRAVEL · ZIARAAT · TOURS
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <Box sx={{ bgcolor: '#C9A227', py: 1.2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1.5, fontSize: '0.75rem' }}>
              ACCOUNT RECOVERY
            </Typography>
          </Box>
          {children}
        </Card>
      </Box>
    </Box>
  );
}

// ─── Shared success screen ──────────────────────────────────────────────────
function SuccessScreen({ title, body, note }) {
  return (
    <Box sx={{ textAlign: 'center', p: 4 }}>
      <CheckCircle sx={{ fontSize: 56, color: '#2E9E6B', mb: 2 }} />
      <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{body}</Typography>
      {note && <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>{note}</Typography>}
      <Button
        fullWidth variant="outlined" component={Link} to="/login"
        startIcon={<ArrowBack />}
        sx={{ mt: 2, borderRadius: 2, borderColor: '#1B4B35', color: '#1B4B35', fontWeight: 700 }}
      >
        Back to Login
      </Button>
    </Box>
  );
}

// ─── Tab A: Forgot Password ─────────────────────────────────────────────────
function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email }) => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || '';
      if (status === 429 || msg.toLowerCase().includes('too many')) {
        setError('Too many attempts. Please wait 15 minutes before trying again.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally { setLoading(false); }
  };

  if (sent) return (
    <SuccessScreen
      title="Check Your Email"
      body="A password reset link has been sent to your registered email. The link expires in 1 hour."
      note="Didn't receive it? Check your spam folder, or go back and try again."
    />
  );

  return (
    <Box sx={{ p: 4, pt: 3 }}>
      <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>Forgot Password</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your registered email address and we'll send a secure link to reset your password.
        The link expires in <strong>1 hour</strong>.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <TextField
          fullWidth label="Registered Email Address" type="email" sx={{ mb: 3 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
          error={!!errors.email} helperText={errors.email?.message}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^\S+@\S+\.\S+$/i, message: 'Enter a valid email address' },
          })}
        />
        <Button
          type="submit" fullWidth variant="contained" size="large" disabled={loading}
          sx={{ py: 1.4, fontWeight: 700, borderRadius: 2, mb: 2, background: 'linear-gradient(135deg, #2E6B4F 0%, #1B4B35 100%)' }}
        >
          {loading ? 'Sending…' : 'Send Reset Link'}
        </Button>
        <Button fullWidth variant="text" component={Link} to="/login" startIcon={<ArrowBack />} sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Back to Login
        </Button>
      </form>
    </Box>
  );
}

// ─── Tab B: Forgot Username ─────────────────────────────────────────────────
function ForgotUsernameForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email }) => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-username', { email });
      setSent(true);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || '';
      if (status === 429 || msg.toLowerCase().includes('too many')) {
        setError('Too many attempts. Please wait 15 minutes before trying again.');
      } else if (status === 404 || msg.toLowerCase().includes('not exist')) {
        setError('This email address does not exist in our database.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally { setLoading(false); }
  };

  if (sent) return (
    <SuccessScreen
      title="Account Details Sent"
      body="If your email is registered, you'll receive an email with your account name shortly."
      note="Didn't receive it? Check your spam folder."
    />
  );

  return (
    <Box sx={{ p: 4, pt: 3 }}>
      <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>Forgot Username</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your registered email address and we'll send you your account name and login details.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <TextField
          fullWidth label="Registered Email Address" type="email" sx={{ mb: 3 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
          error={!!errors.email} helperText={errors.email?.message}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^\S+@\S+\.\S+$/i, message: 'Enter a valid email address' },
          })}
        />
        <Button
          type="submit" fullWidth variant="contained" size="large" disabled={loading}
          sx={{ py: 1.4, fontWeight: 700, borderRadius: 2, mb: 2, background: 'linear-gradient(135deg, #2E6B4F 0%, #1B4B35 100%)' }}
        >
          {loading ? 'Sending…' : 'Send Account Details'}
        </Button>
        <Button fullWidth variant="text" component={Link} to="/login" startIcon={<ArrowBack />} sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Back to Login
        </Button>
      </form>
    </Box>
  );
}

// ─── Main page: two-tab layout ──────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const [tab, setTab] = useState(0); // 0 = Forgot Password  1 = Forgot Username

  return (
    <PageShell>
      <CardContent sx={{ p: 0 }}>
        {/* Tab switcher */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            borderBottom: '1px solid #eee',
            '& .MuiTab-root': { fontWeight: 700, fontSize: '0.8rem', py: 1.5, textTransform: 'none', gap: 0.5 },
            '& .Mui-selected': { color: '#1B4B35' },
            '& .MuiTabs-indicator': { backgroundColor: '#1B4B35', height: 3 },
          }}
        >
          <Tab icon={<Email fontSize="small" />} iconPosition="start" label="Forgot Password" />
          <Tab icon={<Person fontSize="small" />} iconPosition="start" label="Forgot Username" />
        </Tabs>

        {tab === 0 && <ForgotPasswordForm />}
        {tab === 1 && <ForgotUsernameForm />}
      </CardContent>
    </PageShell>
  );
}
