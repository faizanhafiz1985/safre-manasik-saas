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

const IMPORT_SCHEMAS = {
  customers: {
    model: 'customer',
    label: 'Customers',
    roles: ['ADMIN', 'AGENT'],
    columns: [
      { key: 'type', header: 'Type (B2C/B2B)', type: 'enum', enumValues: ['B2C', 'B2B'], default: 'B2C', example: 'B2C' },
      { key: 'firstName', header: 'First Name', type: 'string', required: true, example: 'Ahmed' },
      { key: 'lastName', header: 'Last Name', type: 'string', required: true, example: 'Khan' },
      { key: 'mobile', header: 'Mobile (966XXXXXXXXX)', type: 'digits', required: true, example: '966500000001' },
      { key: 'whatsapp', header: 'WhatsApp (966XXXXXXXXX)', type: 'digits', required: true, example: '966500000001' },
      { key: 'gender', header: 'Gender (Male/Female)', type: 'enum', enumValues: ['Male', 'Female'], example: 'Male' },
      { key: 'passport', header: 'Passport #', type: 'string', example: 'AB1234567' },
      { key: 'email', header: 'Email', type: 'string', example: 'ahmed@example.com' },
      { key: 'companyName', header: 'Company Name (B2B only)', type: 'string', example: '' },
      { key: 'crNumber', header: 'CR # (B2B, 10 digits)', type: 'digits', len: 10, example: '' },
      { key: 'nationalAddress', header: 'National Address (B2B only)', type: 'string', example: '' },
    ],
    validateRow: (d) => {
      if (d.type === 'B2B') {
        if (!d.companyName) return 'Company Name is required for B2B customers';
        if (!d.crNumber) return 'CR # (10 digits) is required for B2B customers';
        if (!d.nationalAddress) return 'National Address is required for B2B customers';
      } else {
        d.companyName = null; d.crNumber = null; d.nationalAddress = null;
      }
      return null;
    },
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
