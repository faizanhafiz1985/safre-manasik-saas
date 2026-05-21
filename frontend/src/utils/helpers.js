import React from 'react';
import { Chip } from '@mui/material';

export const fmtCurrency = (v) => {
  const n = Number(v || 0);
  return `SAR ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const statusChip = (status) => {
  const map = {
    TENTATIVE: { label: 'Tentative', color: 'warning' },
    CONFIRMED: { label: 'Confirmed', color: 'success' },
    CANCELLED: { label: 'Cancelled', color: 'error' },
    PENDING: { label: 'Pending', color: 'default' },
    PARTIAL: { label: 'Partial', color: 'warning' },
    PAID: { label: 'Paid', color: 'success' },
  };
  const cfg = map[status] || { label: status, color: 'default' };
  return <Chip label={cfg.label} color={cfg.color} size="small" />;
};

export const vehicleTypeIcon = { BUS: '🚌', CAR: '🚗', VIP: '🏎️' };
export const mealTypeIcon = { BREAKFAST: '🌅', LUNCH: '🍽️', DINNER: '🌙' };
