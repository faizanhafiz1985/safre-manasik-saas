import React from 'react';
import { Box, Container, Typography, Divider, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f9fafb', py: 6 }}>
      <Container maxWidth="md">
        <Box sx={{ bgcolor: 'white', borderRadius: 2, p: { xs: 3, md: 6 }, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <Typography variant="h4" fontWeight={700} color="#1B4B35" gutterBottom>
            Privacy Policy
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={4}>
            Last updated: May 2026
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>1. Who We Are</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            Safre Manasik ("we", "our", "us") is a Software-as-a-Service platform that provides
            Umrah and Hajj travel management tools to licensed travel agencies in Saudi Arabia and
            the wider GCC region. Our registered address and contact details are available on
            request at <Link href="mailto:support@safremanasik.com">support@safremanasik.com</Link>.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>2. What Data We Collect</Typography>
          <Typography variant="body1" color="text.secondary" mb={1}>We collect the following categories of personal data:</Typography>
          <Box component="ul" sx={{ pl: 3, color: 'text.secondary' }}>
            <li><Typography variant="body1" color="text.secondary"><strong>Account data:</strong> name, email address, phone number, role within your organisation.</Typography></li>
            <li><Typography variant="body1" color="text.secondary"><strong>Pilgrim / passenger data:</strong> full name, passport number, passport expiry, date of birth, nationality — required to fulfil Umrah visa and transport obligations.</Typography></li>
            <li><Typography variant="body1" color="text.secondary"><strong>Business data:</strong> Commercial Registration (CR) number, VAT number, Umrah licence number — collected from travel agencies only.</Typography></li>
            <li><Typography variant="body1" color="text.secondary"><strong>Payment records:</strong> booking amounts, payment method (PayPal reference), invoice history. We do not store card numbers.</Typography></li>
            <li><Typography variant="body1" color="text.secondary"><strong>Usage data:</strong> server logs (IP address, browser type, pages visited) retained for 90 days for security and troubleshooting.</Typography></li>
          </Box>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>3. How We Use Your Data</Typography>
          <Box component="ul" sx={{ pl: 3, color: 'text.secondary' }}>
            <li><Typography variant="body1" color="text.secondary">Providing and operating the Safre Manasik platform.</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Processing bookings and generating pilgrim vouchers.</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Sending transactional emails (booking confirmations, password resets, payment receipts).</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Complying with Saudi regulatory requirements for Umrah/Hajj operators.</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Improving the platform through anonymised analytics.</Typography></li>
          </Box>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>4. Data Sharing</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            We do not sell personal data. We share data only with:
          </Typography>
          <Box component="ul" sx={{ pl: 3, color: 'text.secondary' }}>
            <li><Typography variant="body1" color="text.secondary"><strong>Railway.app</strong> — cloud hosting and managed PostgreSQL database (data stored in the EU/US region).</Typography></li>
            <li><Typography variant="body1" color="text.secondary"><strong>Resend.com</strong> — transactional email delivery.</Typography></li>
            <li><Typography variant="body1" color="text.secondary"><strong>PayPal</strong> — payment processing (governed by PayPal's own privacy policy).</Typography></li>
            <li><Typography variant="body1" color="text.secondary"><strong>Sentry.io</strong> — error monitoring (anonymised stack traces only).</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Saudi government authorities if required by law.</Typography></li>
          </Box>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>5. Data Retention</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            Booking and passenger records are retained for 7 years to comply with Saudi tax and
            regulatory requirements. Account data is deleted within 30 days of a written deletion
            request, except where retention is required by law.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>6. Security</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            All data in transit is encrypted using TLS 1.2+. Passwords are hashed with bcrypt
            (cost factor 12). Database access is restricted to application servers only. We conduct
            regular security reviews.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>7. Your Rights</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            You may request access to, correction of, or deletion of your personal data by emailing
            <Link href="mailto:privacy@safremanasik.com" sx={{ ml: 0.5 }}>privacy@safremanasik.com</Link>.
            We will respond within 30 days.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>8. Cookies</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            We use session storage only for authentication tokens. We do not use third-party
            advertising cookies.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>9. Changes to This Policy</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            We may update this policy from time to time. Material changes will be communicated
            by email to account administrators. Continued use of the platform constitutes
            acceptance of the updated policy.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>10. Contact</Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            For privacy enquiries: <Link href="mailto:privacy@safremanasik.com">privacy@safremanasik.com</Link>
          </Typography>

          <Divider sx={{ my: 3 }} />
          <Box sx={{ display: 'flex', gap: 3 }}>
            <RouterLink to="/terms" style={{ color: '#1B4B35', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
              Terms of Service
            </RouterLink>
            <RouterLink to="/login" style={{ color: '#1B4B35', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
              Back to Login
            </RouterLink>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
