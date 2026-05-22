// ─── Payment Gateway Controller ──────────────────────────────────────────
// Supports PayPal (primary, configured) and Moyasar (legacy stub).
// PayPal flow:
//   1. POST /api/payments/gateway/paypal/create-order   → returns PayPal orderId
//   2. Browser shows PayPal button → customer approves on PayPal
//   3. POST /api/payments/gateway/paypal/capture-order  → captures + records Payment + updates Invoice
//   4. (optional) Webhook for async events

const prisma = require('../config/database');
const { getTenantId } = require('../config/tenantContext');
const { paypal, getPaypalForTenant } = require('../services/paypalClient');

// ──────────────────────────────────────────────────────────────────────────
// PAYPAL: Create order
// ──────────────────────────────────────────────────────────────────────────
const paypalCreateOrder = async (req, res, next) => {
  try {
    const { bookingId, amount, currency } = req.body;
    if (!bookingId || !amount) return res.status(400).json({ error: 'bookingId and amount are required' });

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId },
      include: { tenant: { select: { name: true, currency: true } } },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const orderCurrency = currency || booking.currency || booking.tenant?.currency || 'USD';
    // PayPal supports limited currencies. SAR is NOT in the PayPal supported list,
    // so default-charge in USD if currency is SAR. The exchange rate is
    // applied locally at booking creation time and stored in the Payment record.
    const finalCurrency = orderCurrency === 'SAR' ? 'USD' : orderCurrency;
    const finalAmount = orderCurrency === 'SAR'
      ? Math.round((Number(amount) / 3.75) * 100) / 100   // rough SAR→USD peg
      : Number(amount);

    // Look up THIS tenant's PayPal client (or platform fallback, or stub).
    const { client: paypalClient, stubMode, mode: paypalMode } = await getPaypalForTenant(booking.tenantId);

    if (stubMode) {
      const stubOrderId = `STUB-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      return res.json({
        orderId: stubOrderId,
        mode: 'stub',
        amount: finalAmount,
        currency: finalCurrency,
        approveUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/stub?intent=${stubOrderId}&bookingId=${bookingId}&amount=${finalAmount}&currency=${finalCurrency}`,
      });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: bookingId,
        description: `Safre Manasik booking ${booking.bookingRef}`,
        custom_id: bookingId,
        amount: {
          currency_code: finalCurrency,
          value: finalAmount.toFixed(2),
        },
      }],
      application_context: {
        brand_name: booking.tenant?.name || 'Safre Manasik',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/paypal/success?bookingId=${bookingId}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/bookings/${bookingId}`,
      },
    });

    const order = await paypalClient.execute(request);
    const approveLink = order.result.links.find((l) => l.rel === 'approve')?.href;

    res.json({
      orderId: order.result.id,
      mode: paypalMode,
      amount: finalAmount,
      currency: finalCurrency,
      approveUrl: approveLink,
      status: order.result.status,
    });
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// PAYPAL: Capture order (called after customer approves on PayPal)
// ──────────────────────────────────────────────────────────────────────────
const paypalCaptureOrder = async (req, res, next) => {
  try {
    const { orderId, bookingId } = req.body;
    if (!orderId || !bookingId) return res.status(400).json({ error: 'orderId and bookingId are required' });

    const booking = await prisma.booking.findFirst({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    let captureResult, capturedAmount, capturedCurrency, gatewayRef;

    const { client: paypalClient, stubMode } = await getPaypalForTenant(booking.tenantId);

    if (stubMode || orderId.startsWith('STUB-')) {
      // Stub mode: trust the input
      capturedAmount = Number(req.body.amount || booking.totalAmount);
      capturedCurrency = req.body.currency || booking.currency || 'SAR';
      gatewayRef = orderId;
      captureResult = { status: 'COMPLETED', mode: 'stub' };
    } else {
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});
      const capture = await paypalClient.execute(request);
      const unit = capture.result.purchase_units[0];
      const payments = unit.payments;
      const cap = payments.captures[0];
      capturedAmount = Number(cap.amount.value);
      capturedCurrency = cap.amount.currency_code;
      gatewayRef = cap.id;
      captureResult = {
        status: capture.result.status,
        captureId: cap.id,
        payer: capture.result.payer?.email_address,
      };
    }

    // Record the payment (in tenant's display currency — store both if different)
    const displayCurrency = booking.currency || 'SAR';
    const displayAmount = (capturedCurrency === 'USD' && displayCurrency === 'SAR')
      ? Math.round((capturedAmount * 3.75) * 100) / 100
      : capturedAmount;

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount: displayAmount,
        currency: displayCurrency,
        method: 'PAYPAL',
        status: 'PAID',
        reference: orderId,
        gatewayRef,
        notes: `PayPal payment — ${capturedAmount} ${capturedCurrency} (gateway ref: ${gatewayRef})`,
      },
    });

    // Update invoice
    const invoice = await prisma.invoice.findFirst({ where: { bookingId } });
    if (invoice) {
      const allPaid = await prisma.payment.aggregate({ where: { bookingId }, _sum: { amount: true } });
      const totalPaid = Number(allPaid._sum.amount || 0);
      const balance = Math.max(0, Number(invoice.totalAmount) - totalPaid);
      const newStatus = balance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'PENDING';
      await prisma.invoice.updateMany({
        where: { bookingId }, data: { paidAmount: totalPaid, balance, status: newStatus },
      });
    }

    res.json({
      message: 'Payment captured successfully',
      payment,
      capture: captureResult,
    });
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────────────────────────────────
// PAYPAL: Webhook (async event notifications from PayPal)
// ──────────────────────────────────────────────────────────────────────────
const paypalWebhook = async (req, res) => {
  // PayPal webhook signature verification is best done with their SDK in production.
  // For now: log the event and respond 200 so PayPal doesn't retry.
  try {
    const event = req.body;
    console.log('[PayPal Webhook]', event.event_type, event.resource?.id);

    // Common events:
    //   PAYMENT.CAPTURE.COMPLETED — already handled by capture-order endpoint
    //   PAYMENT.CAPTURE.REFUNDED  — record a refund
    //   PAYMENT.CAPTURE.DENIED    — mark payment as failed

    if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
      const captureId = event.resource?.id;
      const payment = await prisma.payment.findFirst({ where: { gatewayRef: captureId } });
      if (payment) {
        await prisma.payment.updateMany({
          where: { id: payment.id },
          data: { status: 'PENDING', notes: `${payment.notes || ''}\nREFUNDED via webhook` },
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[PayPal Webhook Error]', err);
    res.status(200).json({ received: true, error: err.message });  // 200 prevents retry storms
  }
};

// ──────────────────────────────────────────────────────────────────────────
// PAYPAL: Get config for the frontend (client ID for PayPal JS SDK)
// ──────────────────────────────────────────────────────────────────────────
const paypalConfig = async (req, res) => {
  // If the user is authenticated, use their tenant's config; otherwise fall
  // back to the platform-level config (mostly useful for the marketing site).
  const tenantId = req.user?.tenantId || null;
  const cfg = await getPaypalForTenant(tenantId);
  res.json({
    clientId: cfg.clientId || '',
    mode: cfg.mode,
    stubMode: cfg.stubMode,
    source: cfg.source,        // 'tenant' | 'platform' | 'stub' — useful for the UI
    currency: 'USD',           // PayPal doesn't support SAR; FE converts at display time
  });
};

// ──────────────────────────────────────────────────────────────────────────
// Legacy Moyasar stub (kept for compatibility — webhook handler used by stub UI)
// ──────────────────────────────────────────────────────────────────────────
const moyasarCreateIntent = async (req, res, next) => {
  try {
    const { bookingId, amount, currency = 'SAR' } = req.body;
    if (!bookingId || !amount) return res.status(400).json({ error: 'bookingId and amount are required' });
    const booking = await prisma.booking.findFirst({ where: { id: bookingId } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const stubId = `moyasar_stub_${Date.now()}`;
    res.json({
      provider: 'moyasar-stub',
      intentId: stubId,
      hostedPaymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/stub?intent=${stubId}&bookingId=${bookingId}&amount=${amount}&currency=${currency}`,
      amount, currency,
    });
  } catch (err) { next(err); }
};

const moyasarWebhook = async (req, res, next) => {
  try {
    const { intentId, bookingId, amount, status, gatewayRef } = req.body;
    if (status !== 'paid') return res.json({ message: 'No-op (status != paid)' });
    const payment = await prisma.payment.create({
      data: {
        bookingId, amount: Number(amount), method: 'MOYASAR', status: 'PAID',
        reference: intentId, gatewayRef: gatewayRef || intentId,
        notes: 'Online payment via Moyasar (stub)',
      },
    });
    const invoice = await prisma.invoice.findFirst({ where: { bookingId } });
    if (invoice) {
      const allPaid = await prisma.payment.aggregate({ where: { bookingId }, _sum: { amount: true } });
      const totalPaid = Number(allPaid._sum.amount || 0);
      const balance = Math.max(0, Number(invoice.totalAmount) - totalPaid);
      const newStatus = balance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'PENDING';
      await prisma.invoice.updateMany({ where: { bookingId }, data: { paidAmount: totalPaid, balance, status: newStatus } });
    }
    res.json({ message: 'Payment recorded', paymentId: payment.id });
  } catch (err) { next(err); }
};

module.exports = {
  // PayPal
  paypalConfig, paypalCreateOrder, paypalCaptureOrder, paypalWebhook,
  // Moyasar legacy stub
  moyasarCreateIntent, moyasarWebhook,
  // Old names (back-compat)
  createIntent: moyasarCreateIntent,
  webhook: moyasarWebhook,
};
