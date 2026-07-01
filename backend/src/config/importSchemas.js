// ─────────────────────────────────────────────────────────────────────────
// Bulk-import registry.
//
// One source of truth for both the downloadable template (column headers +
// example row) and the server-side validation of an uploaded file. Each entry
// maps an import "entity" key to a Prisma model accessor, the roles allowed to
// import it, and a typed column list.
//
// Column `type`:
//   string  — trimmed text (optional maxLen)
//   int     — whole number (optional min/max)
//   decimal — number (>= 0)
//   bool    — true/false/yes/no/1/0
//   enum    — must match one of enumValues (case-insensitive, normalised)
//   digits  — strips non-digits; if `len` set, must be exactly that many
//   list    — splits on ; or | into a string[] (for array columns)
//
// `transform(value)` (optional) runs after coercion. `validateRow(data)`
// (optional) does cross-field checks and may mutate the row; return an error
// string to reject, or null to accept.
// ─────────────────────────────────────────────────────────────────────────

// Lazily required inside createRow to avoid any load-order coupling with the
// controller layer (the controller has no dependency back on this registry).
const buildVoucherRow = (type) => async (data, { req }) => {
  const { createVoucherRecord } = require('../controllers/formVoucherController');
  const common = {
    firstName: data.firstName, lastName: data.lastName, companyName: data.companyName,
    mobile: data.mobile, whatsapp: data.whatsapp, passport: data.passport,
  };
  const trip = type === 'HOTEL'
    ? {
        hotelName: data.hotelName, checkInDate: data.checkInDate, checkOutDate: data.checkOutDate,
        rooms: data.rooms, roomType: data.roomType, passengerCount: data.passengerCount,
        perNightPrice: data.perNightPrice,
      }
    : {
        vehicleType: data.vehicleType, pickupLocation: data.pickupLocation, dropoffLocation: data.dropoffLocation,
        travelDate: data.travelDate, passengerCount: data.passengerCount, price: data.price,
      };
  // createVoucherRecord re-runs the full voucher validation (same rules/messages
  // as the single-create path) and throws { status:400 } on any bad row.
  await createVoucherRecord({ type, ...common, trips: [trip] }, req.user);
};

const IMPORT_SCHEMAS = {
  hotel_vouchers: {
    label: 'Direct Vouchers — Hotel',
    roles: ['ADMIN', 'AGENT'],
    createRow: buildVoucherRow('HOTEL'),
    columns: [
      { key: 'firstName', header: 'First Name', type: 'string', required: true, example: 'Abdullah' },
      { key: 'lastName', header: 'Last Name', type: 'string', required: true, example: 'Khan' },
      { key: 'companyName', header: 'Company (optional)', type: 'string', example: '' },
      { key: 'mobile', header: 'Mobile (12 digits, 966XXXXXXXXX)', type: 'digits', len: 12, required: true, example: '966501234567' },
      { key: 'whatsapp', header: 'WhatsApp (12 digits, optional)', type: 'digits', len: 12, example: '' },
      { key: 'passport', header: 'Passport #', type: 'string', required: true, example: 'A1234567' },
      { key: 'hotelName', header: 'Hotel Name', type: 'string', required: true, example: 'Hilton Makkah Convention' },
      { key: 'checkInDate', header: 'Check-in (YYYY-MM-DD)', type: 'date', required: true, example: '2026-08-01' },
      { key: 'checkOutDate', header: 'Check-out (YYYY-MM-DD)', type: 'date', required: true, example: '2026-08-05' },
      { key: 'rooms', header: 'Rooms', type: 'int', min: 1, default: 1, example: '1' },
      { key: 'roomType', header: 'Room Type (Sharing/Double/Triple/Quad/Quint)', type: 'enum', enumValues: ['Sharing', 'Double', 'Triple', 'Quad', 'Quint'], example: 'Double' },
      { key: 'passengerCount', header: 'Passengers (optional)', type: 'int', min: 1, example: '2' },
      { key: 'perNightPrice', header: 'Per-night Price', type: 'decimal', required: true, example: '450' },
    ],
  },

  transport_vouchers: {
    label: 'Direct Vouchers — Transport',
    roles: ['ADMIN', 'AGENT'],
    createRow: buildVoucherRow('TRANSPORT'),
    columns: [
      { key: 'firstName', header: 'First Name', type: 'string', required: true, example: 'Abdullah' },
      { key: 'lastName', header: 'Last Name', type: 'string', required: true, example: 'Khan' },
      { key: 'companyName', header: 'Company (optional)', type: 'string', example: '' },
      { key: 'mobile', header: 'Mobile (12 digits, 966XXXXXXXXX)', type: 'digits', len: 12, required: true, example: '966501234567' },
      { key: 'whatsapp', header: 'WhatsApp (12 digits, optional)', type: 'digits', len: 12, example: '' },
      { key: 'passport', header: 'Passport #', type: 'string', required: true, example: 'A1234567' },
      { key: 'vehicleType', header: 'Vehicle Type', type: 'string', required: true, example: 'SUV (GMC)' },
      { key: 'pickupLocation', header: 'Pickup Location', type: 'string', required: true, example: 'Jeddah Airport (JED)' },
      { key: 'dropoffLocation', header: 'Drop-off Location', type: 'string', required: true, example: 'Makkah Hotel' },
      { key: 'travelDate', header: 'Travel Date (YYYY-MM-DD)', type: 'date', required: true, example: '2026-08-01' },
      { key: 'passengerCount', header: 'Passengers (optional)', type: 'int', min: 1, example: '3' },
      { key: 'price', header: 'Price', type: 'decimal', required: true, example: '600' },
    ],
  },

  hotels: {
    model: 'hotel',
    label: 'Hotels',
    roles: ['ADMIN'],
    columns: [
      { key: 'name', header: 'Hotel Name', type: 'string', required: true, example: 'Hilton Makkah Convention' },
      { key: 'city', header: 'City (MAKKAH/MADINAH/JEDDAH/TAIF)', type: 'enum', enumValues: ['MAKKAH', 'MADINAH', 'JEDDAH', 'TAIF'], required: true, example: 'MAKKAH' },
      { key: 'stars', header: 'Stars (1-5)', type: 'int', min: 1, max: 5, default: 3, example: '5' },
      { key: 'distanceToHaramMeters', header: 'Distance To Haram (meters)', type: 'int', min: 0, example: '250' },
      { key: 'pricePerNight', header: 'Price Per Night', type: 'decimal', example: '450' },
      { key: 'amenities', header: 'Amenities (separate with ;)', type: 'list', example: 'WiFi;Breakfast;Shuttle' },
      { key: 'address', header: 'Address', type: 'string', example: 'Ibrahim Al Khalil Rd' },
      { key: 'description', header: 'Description', type: 'string', example: '' },
      { key: 'isActive', header: 'Active (true/false)', type: 'bool', default: true, example: 'true' },
    ],
  },

  vehicles: {
    model: 'vehicle',
    label: 'Vehicles (Transport)',
    roles: ['ADMIN'],
    columns: [
      { key: 'name', header: 'Vehicle Name', type: 'string', required: true, example: 'Coaster A1' },
      { key: 'plateNumber', header: 'Plate Number', type: 'string', required: true, example: 'ABC1234' },
      { key: 'type', header: 'Type (e.g. BUS/CAR/VAN)', type: 'string', required: true, transform: (v) => String(v).toUpperCase().slice(0, 40), example: 'BUS' },
      { key: 'capacity', header: 'Capacity', type: 'int', min: 1, required: true, example: '20' },
      { key: 'driverName', header: 'Driver Name', type: 'string', required: true, example: 'Mohammed Ali' },
      { key: 'driverPhone', header: 'Driver Phone (966XXXXXXXXX)', type: 'digits', required: true, example: '966500000002' },
      { key: 'driverIqama', header: 'Driver Iqama # (10 digits)', type: 'digits', len: 10, required: true, example: '2123456789' },
      { key: 'driverLicense', header: 'Driver License', type: 'string', example: 'DL-998877' },
      { key: 'initialOdometer', header: 'Initial Odometer (km)', type: 'int', min: 0, default: 0, example: '0' },
      { key: 'oilChangeIntervalKm', header: 'Oil Change Interval (km)', type: 'int', min: 0, default: 5000, example: '5000' },
      { key: 'isAvailable', header: 'Available (true/false)', type: 'bool', default: true, example: 'true' },
      { key: 'notes', header: 'Notes', type: 'string', example: '' },
    ],
    // currentOdometer starts at the initial baseline (mirrors single create).
    validateRow: (d) => { d.currentOdometer = d.initialOdometer || 0; return null; },
  },

  packages: {
    model: 'package',
    label: 'Packages',
    roles: ['ADMIN'],
    columns: [
      { key: 'name', header: 'Package Name', type: 'string', required: true, example: '7-Day Umrah Economy' },
      { key: 'durationDays', header: 'Duration (days)', type: 'int', min: 1, required: true, example: '7' },
      { key: 'description', header: 'Description', type: 'string', example: '' },
      { key: 'transportIncluded', header: 'Transport Included (true/false)', type: 'bool', default: true, example: 'true' },
      { key: 'cateringIncluded', header: 'Catering Included (true/false)', type: 'bool', default: true, example: 'true' },
      { key: 'visaIncluded', header: 'Visa Included (true/false)', type: 'bool', default: false, example: 'false' },
      { key: 'airportTransfer', header: 'Airport Transfer (true/false)', type: 'bool', default: true, example: 'true' },
      { key: 'isActive', header: 'Active (true/false)', type: 'bool', default: true, example: 'true' },
    ],
  },

  catering: {
    model: 'cateringVendor',
    label: 'Catering Vendors',
    roles: ['ADMIN'],
    columns: [
      { key: 'name', header: 'Vendor Name', type: 'string', required: true, example: 'Al Khair Catering' },
      { key: 'contactName', header: 'Contact Name', type: 'string', example: 'Yousef' },
      { key: 'phone', header: 'Phone', type: 'string', example: '966500000003' },
      { key: 'email', header: 'Email', type: 'string', example: 'info@vendor.com' },
      { key: 'speciality', header: 'Speciality', type: 'string', example: 'South Asian' },
      { key: 'address', header: 'Address', type: 'string', example: 'Aziziyah, Makkah' },
      { key: 'isActive', header: 'Active (true/false)', type: 'bool', default: true, example: 'true' },
    ],
  },

  routes: {
    model: 'route',
    label: 'Transport Routes',
    roles: ['ADMIN'],
    columns: [
      { key: 'name', header: 'Route Name', type: 'string', required: true, example: 'Jeddah Airport to Makkah Hotel' },
      { key: 'fromLocation', header: 'From', type: 'string', required: true, example: 'Jeddah Airport (JED)' },
      { key: 'toLocation', header: 'To', type: 'string', required: true, example: 'Makkah Hotel' },
      { key: 'description', header: 'Description', type: 'string', example: '' },
    ],
  },
};

module.exports = { IMPORT_SCHEMAS };
