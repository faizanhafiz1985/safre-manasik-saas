const prisma = require('../config/database');
const { getVoucherHtml } = require('../services/voucherService');

const bookingInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  agent: { select: { id: true, name: true, companyName: true } },
  package: { include: { priceTiers: true, packageHotels: { include: { hotel: true } } } },
  passengers: true,
  transports: { include: { vehicle: true, route: true } },
  caterings: { include: { mealPlan: { include: { vendor: true } } } },
};

const generateVoucherNo = async (type) => {
  const prefix = type === 'CONFIRMED' ? 'CON' : 'TEN';
  const today = new Date();
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const pattern = `${prefix}-${datePart}-`;

  const count = await prisma.voucher.count({
    where: { voucherNo: { startsWith: pattern } },
  });

  const seq = String(count + 1).padStart(4, '0');
  return `${pattern}${seq}`;
};

const getVouchers = async (req, res, next) => {
  try {
    const { bookingId } = req.query;
    const where = bookingId ? { bookingId } : {};

    if (req.user.role === 'CUSTOMER') where.booking = { customerId: req.user.id };
    if (req.user.role === 'AGENT') where.booking = { agentId: req.user.id };

    const vouchers = await prisma.voucher.findMany({
      where,
      include: { booking: { include: { customer: { select: { name: true } }, package: { select: { name: true } } } } },
      orderBy: { generatedAt: 'desc' },
    });
    res.json(vouchers);
  } catch (err) {
    next(err);
  }
};

const generateVoucher = async (req, res, next) => {
  try {
    const { bookingId, type } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'Booking ID is required' });

    const booking = await prisma.booking.findFirst({ where: { id: bookingId }, include: bookingInclude });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const voucherType = (type || booking.status).toUpperCase();
    if (!['CONFIRMED', 'TENTATIVE'].includes(voucherType))
      return res.status(400).json({ error: 'Voucher type must be CONFIRMED or TENTATIVE' });
    const voucherNo = await generateVoucherNo(voucherType);

    const voucher = await prisma.voucher.create({
      data: { bookingId, type: voucherType, voucherNo },
    });

    res.json({ ...voucher, booking });
  } catch (err) {
    next(err);
  }
};

const downloadVoucher = async (req, res, next) => {
  try {
    const voucher = await prisma.voucher.findFirst({
      where: { id: req.params.id },
      include: { booking: { include: bookingInclude } },
    });
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });

    const html = await getVoucherHtml(voucher.booking, voucher.type, voucher.voucherNo);
    const typeLabel = voucher.type === 'CONFIRMED' ? 'confirmed-voucher' : 'tentative-voucher';
    const filename = `${typeLabel}-${voucher.voucherNo || voucher.booking.bookingRef}`;

    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
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

const previewVoucher = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({ where: { id: req.params.bookingId }, include: bookingInclude });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const type = (req.query.type || booking.status).toUpperCase();
    const voucherNo = req.query.voucherNo || null;
    const html = await getVoucherHtml(booking, type, voucherNo);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
};

module.exports = { getVouchers, generateVoucher, downloadVoucher, previewVoucher };
