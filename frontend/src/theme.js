import { createTheme } from '@mui/material/styles';

const BRAND = {
  green:       '#1B4B35',
  greenDark:   '#0D2B1A',
  greenMid:    '#2E6B4F',
  greenLight:  '#EAF2EE',
  greenPale:   '#F3F8F5',
  gold:        '#C9A227',
  goldDark:    '#9B7A1A',
  goldLight:   '#FFF8E6',
  cream:       '#F7F2E8',
};

const theme = createTheme({
  palette: {
    primary:    { main: BRAND.green, light: BRAND.greenLight, dark: BRAND.greenDark, contrastText: '#fff' },
    secondary:  { main: BRAND.gold,  light: BRAND.goldLight,  dark: BRAND.goldDark,  contrastText: '#fff' },
    warning:    { main: '#EA580C', light: '#FFF7ED' },
    error:      { main: '#DC2626', light: '#FEF2F2' },
    success:    { main: '#16A34A', light: '#F0FDF4' },
    background: { default: BRAND.cream, paper: '#FFFFFF' },
    text:       { primary: BRAND.greenDark, secondary: '#4B7060' },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    h4: { fontWeight: 700, color: BRAND.greenDark },
    h5: { fontWeight: 700, color: BRAND.greenDark },
    h6: { fontWeight: 700, color: BRAND.greenDark },
    subtitle1: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        containedPrimary: {
          background: `linear-gradient(135deg, ${BRAND.greenMid} 0%, ${BRAND.green} 100%)`,
          boxShadow: '0 2px 8px rgba(27,75,53,0.35)',
          '&:hover': { boxShadow: '0 4px 14px rgba(27,75,53,0.45)', background: `linear-gradient(135deg, ${BRAND.green} 0%, ${BRAND.greenDark} 100%)` },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${BRAND.gold} 0%, ${BRAND.goldDark} 100%)`,
          boxShadow: '0 2px 8px rgba(201,162,39,0.35)',
          color: '#fff',
        },
        outlinedPrimary: { borderColor: BRAND.green, color: BRAND.green, '&:hover': { background: BRAND.greenLight } },
      },
    },
    MuiAppBar:    { styleOverrides: { root: { background: '#fff', color: BRAND.greenDark, boxShadow: `0 2px 8px rgba(27,75,53,0.12)` } } },
    MuiDrawer:    { styleOverrides: { paper: { background: BRAND.greenDark, color: '#fff', borderRight: 'none' } } },
    MuiCard:      { styleOverrides: { root: { borderRadius: 12, boxShadow: '0 1px 4px rgba(27,75,53,0.1), 0 1px 2px rgba(27,75,53,0.06)' } } },
    MuiChip:      { styleOverrides: { root: { fontWeight: 600, borderRadius: 6 } } },
    MuiTableHead: { styleOverrides: { root: { '& .MuiTableCell-root': { fontWeight: 700, background: BRAND.greenLight, color: BRAND.green, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' } } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiDialogTitle: { styleOverrides: { root: { background: BRAND.green, color: '#fff', fontWeight: 700, padding: '14px 24px' } } },
    MuiTab: { styleOverrides: { root: { fontWeight: 600, '&.Mui-selected': { color: BRAND.green } } } },
    MuiTabs: { styleOverrides: { indicator: { background: BRAND.gold, height: 3 } } },
    MuiLinearProgress: { styleOverrides: { bar: { background: BRAND.gold } } },
  },
});

export default theme;
