import React from 'react';
import { Box, Container, Typography, Divider, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function TermsOfServicePage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f9fafb', py: 6 }}>
      <Container maxWidth="md">
        <Box sx={{ bgcolor: 'white', borderRadius: 2, p: { xs: 3, md: 6 }, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <Typography variant="h4" fontWeight={700} color="#1B4B35" gutterBottom>
            Terms of Service
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={4}>
            Last updated: May 2026
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>1. Acceptance</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            By creating an account or using the Safre Manasik platform ("Platform"), you agree
            to these Terms of Service ("Terms") on behalf of yourself and the travel agency you
            represent ("Customer"). If you do not agree, do not use the Platform.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>2. Service Description</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            Safre Manasik provides a cloud-based management system for Umrah and Hajj travel
            packages, including booking management, pilgrim records, transport scheduling,
            catering coordination, hotel assignments, and payment tracking. The Platform is
            provided on a subscription basis.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>3. Eligibility</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            The Platform is intended for licensed Umrah and Hajj travel operators. By applying
            for an account, you represent that your agency holds all required government licences
            and complies with all applicable Saudi regulations governing Umrah services.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>4. Accounts and Security</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            You are responsible for maintaining the confidentiality of your account credentials.
            You must notify us immediately at <Link href="mailto:support@safremanasik.com">support@safremanasik.com</Link> of
            any unauthorised access. We reserve the right to suspend accounts where security
            is compromised.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>5. Acceptable Use</Typography>
          <Typography variant="body1" color="text.secondary" mb={1}>You agree not to:</Typography>
          <Box component="ul" sx={{ pl: 3, color: 'text.secondary' }}>
            <li><Typography variant="body1" color="text.secondary">Use the Platform for any unlawful purpose or in violation of Saudi law.</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Enter false, misleading, or fraudulent pilgrim or booking data.</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Attempt to reverse-engineer, scrape, or disrupt the Platform.</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Share your credentials with parties outside your organisation.</Typography></li>
            <li><Typography variant="body1" color="text.secondary">Use the Platform to process bookings for travel not authorised under your Umrah licence.</Typography></li>
          </Box>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>6. Subscription and Payment</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            Subscriptions are invoiced monthly or annually based on the plan selected at signup.
            All fees are in SAR unless otherwise stated. Subscriptions automatically renew unless
            cancelled at least 7 days before the renewal date. Refunds are not provided for
            partial periods.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>7. Data Ownership</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            You retain ownership of all data you enter into the Platform. We process your data
            solely to provide the services described in these Terms. On termination, you may
            request a data export within 30 days; after that period data may be permanently deleted.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>8. Uptime and Support</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            We target 99.5% monthly uptime excluding scheduled maintenance. Support is available
            via email at <Link href="mailto:support@safremanasik.com">support@safremanasik.com</Link> with
            a response time of 1 business day for standard issues.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>9. Limitation of Liability</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            To the maximum extent permitted by law, Safre Manasik's liability for any claim
            arising from use of the Platform is limited to the fees paid by the Customer in the
            12 months preceding the claim. We are not liable for indirect, consequential, or
            incidental damages.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>10. Termination</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            Either party may terminate by providing 30 days' written notice. We may suspend or
            terminate immediately for material breach of these Terms, non-payment, or regulatory
            requirements.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>11. Governing Law</Typography>
          <Typography variant="body1" color="text.secondary" mb={2}>
            These Terms are governed by the laws of the Kingdom of Saudi Arabia. Any disputes
            shall be submitted to the competent courts in Riyadh.
          </Typography>

          <Typography variant="h6" fontWeight={600} mt={3} mb={1}>12. Changes to Terms</Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            We may update these Terms with 30 days' notice by email. Continued use of the
            Platform after the effective date constitutes acceptance of the updated Terms.
          </Typography>

          <Divider sx={{ my: 3 }} />
          <Box sx={{ display: 'flex', gap: 3 }}>
            <RouterLink to="/privacy" style={{ color: '#1B4B35', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
              Privacy Policy
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
