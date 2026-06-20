const prisma = require('../config/database');
const { getReceiptHtml } = require('../services/voucherService');
const push = require('../services/pushService');

const bookingInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  agent:    { select: { id: true, name: true, companyName: true } },
  package:  { select: { name: true, durationDays: true } },
  invoice:  true,
};

const generateReceiptNo = async () => {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `SAFMREC${year}${month}`;
  const count  = await prisma.payment.count({ where: { paidAt: { gte: new Date(year, now.getMonth(), 1) } } });
  return `${prefix}${String(count).padStart(4, '0')}`;
};

const getPayments = async (req, res, next) => {
  try {
    const { bookingId } = req.query;
    const where = bookingId ? { bookingId } : {};

    if (req.user.role === 'CUSTOMER') where.booking = { customerId: req.user.id };
    if (req.user.role === 'AGENT') where.booking = { agentId: req.user.id };

    const payments = await prisma.payment.findMany({
      where,
      include: { booking: { select: { bookingRef: true, customer: { select: { name: true } } } } },
      orderBy: { paidAt: 'desc' },
    });
    res.json(payments);
  } catch (err) {
    next(err);
  }
};

const recordPayment = async (req, res, next) => {
  try {
    const { bookingId, amount, method, reference, notes } = req.body;

    if (!bookingId) return res.status(400).json({ error: 'Booking is required' });
    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0)
      return res.status(400).json({ error: 'Amount must be a positive number' });
    if (!method) return res.status(400).json({ error: 'Payment method is required' });

    // Verify booking belongs to tenant
    const booking = await prisma.booking.findFirst({ where: { id: bookingId }, select: { id: true, customerId: true, bookingRef: true, currency: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const payment = await prisma.payment.create({
      data: { bookingId, amount: parsedAmount, method, status: 'PAID', reference, notes },
    });

    // Notify the customer's mobile devices that a payment was received.
    if (booking.customerId) {
      push.notifyUser(booking.customerId, {
        title: 'Payment received',
        body: `${booking.currency || 'SAR'} ${parsedAmount.toLocaleString()} recorded for booking ${booking.bookingRef}.`,
        data: { type: 'payment_received', bookingId: booking.id, amount: String(parsedAmount) },
      }).catch(() => {});
    }

    const allPayments = await prisma.payment.aggregate({
      where: { bookingId },
      _sum: { amount: true },
    });
    const totalPaid = allPayments._sum.amount || 0;

    const invoice = await prisma.invoice.findFirst({ where: { bookingId } });
    if (!invoice) {
      return res.status(201).json(payment);
    }
    const balance = Number(invoice.totalAmount) - Number(totalPaid);
    const status = balance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'PENDING';

    await prisma.invoice.updateMany({
      where: { bookingId },
      data: { paidAmount: totalPaid, balance: Math.max(0, balance), status },
    });

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
};

const getInvoice = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { bookingId: req.params.bookingId },
      include: {
        booking: {
          include: {
            customer: { select: { name: true, email: true, phone: true } },
            package: { select: { name: true } },
            payments: true,
          },
        },
      },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
};

const tenantSelect = { select: { name: true, vatNumber: true, crNumber: true, contactPhone: true, contactEmail: true } };

const getTenant = async (booking) =>
  booking?.tenantId ? (await prisma.tenant.findUnique({ where: { id: booking.tenantId }, ...tenantSelect })) || {} : {};

const previewReceipt = async (req, res, next) => {
  try {
    const payment = await prisma.payment.findFirst({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    const booking = await prisma.booking.findFirst({ where: { id: payment.bookingId }, include: bookingInclude });
    const tenant  = await getTenant(booking);
    const receiptNo = await generateReceiptNo();
    const html = await getReceiptHtml(payment, booking, receiptNo, tenant);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
};

const downloadReceipt = async (req, res, next) => {
  try {
    const payment = await prisma.payment.findFirst({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    const booking = await prisma.booking.findFirst({ where: { id: payment.bookingId }, include: bookingInclude });
    const tenant  = await getTenant(booking);
    const receiptNo = await generateReceiptNo();
    const html = await getReceiptHtml(payment, booking, receiptNo, tenant);
    const filename = `receipt-${receiptNo}`;
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(pdf);
    } catch {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
      res.send(html);
    }
  } catch (err) {
    next(err);
  }
};

module.exports = { getPayments, recordPayment, getInvoice, previewReceipt, downloadReceipt };
