// Country & city catalogue used by signup + tenant settings.
//
// Each entry: { code, name, dialCode, cities: [] }
//   code     — ISO-3166 alpha-2 (also handy as flag emoji key)
//   name     — display name
//   dialCode — international phone prefix without '+'
//   cities   — curated list of major cities for the cascading city dropdown
//
// Focused on Umrah travel source markets + GCC destinations. Add or trim as
// needed; the picker auto-renders whatever's here.

const COUNTRIES = [
  {
    code: 'SA', name: 'Saudi Arabia', dialCode: '966',
    cities: ['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Taif', 'Yanbu', 'Tabuk', 'Abha', 'Hail', 'Buraidah', 'Najran', 'Jubail'],
  },
  {
    code: 'PK', name: 'Pakistan', dialCode: '92',
    cities: ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Mardan', 'Abbottabad', 'Mirpur'],
  },
  {
    code: 'IN', name: 'India', dialCode: '91',
    cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Surat', 'Bhopal', 'Patna', 'Kochi', 'Srinagar', 'Aligarh', 'Lakhnow'],
  },
  {
    code: 'BD', name: 'Bangladesh', dialCode: '880',
    cities: ['Dhaka', 'Chattogram', 'Khulna', 'Rajshahi', 'Sylhet', 'Barishal', 'Rangpur', 'Mymensingh', 'Cumilla', 'Narayanganj'],
  },
  {
    code: 'ID', name: 'Indonesia', dialCode: '62',
    cities: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang', 'Tangerang', 'Depok', 'Bekasi', 'Yogyakarta', 'Denpasar'],
  },
  {
    code: 'MY', name: 'Malaysia', dialCode: '60',
    cities: ['Kuala Lumpur', 'George Town', 'Ipoh', 'Shah Alam', 'Petaling Jaya', 'Johor Bahru', 'Kuching', 'Kota Kinabalu', 'Malacca', 'Putrajaya'],
  },
  {
    code: 'AE', name: 'United Arab Emirates', dialCode: '971',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain'],
  },
  {
    code: 'EG', name: 'Egypt', dialCode: '20',
    cities: ['Cairo', 'Alexandria', 'Giza', 'Shubra El-Kheima', 'Port Said', 'Suez', 'Luxor', 'Mansoura', 'Tanta', 'Asyut'],
  },
  {
    code: 'TR', name: 'Turkey', dialCode: '90',
    cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Adana', 'Gaziantep', 'Konya', 'Antalya', 'Kayseri', 'Trabzon'],
  },
  {
    code: 'NG', name: 'Nigeria', dialCode: '234',
    cities: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna', 'Maiduguri', 'Zaria', 'Aba'],
  },
  {
    code: 'MA', name: 'Morocco', dialCode: '212',
    cities: ['Casablanca', 'Rabat', 'Marrakesh', 'Fes', 'Tangier', 'Agadir', 'Meknes', 'Oujda', 'Tetouan', 'Sale'],
  },
  {
    code: 'DZ', name: 'Algeria', dialCode: '213',
    cities: ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Batna', 'Setif', 'Djelfa', 'Sidi Bel Abbes', 'Biskra'],
  },
  {
    code: 'IQ', name: 'Iraq', dialCode: '964',
    cities: ['Baghdad', 'Basra', 'Mosul', 'Erbil', 'Najaf', 'Karbala', 'Sulaymaniyah', 'Kirkuk', 'Nasiriyah', 'Diwaniyah'],
  },
  {
    code: 'JO', name: 'Jordan', dialCode: '962',
    cities: ['Amman', 'Zarqa', 'Irbid', 'Russeifa', 'Sahab', 'Salt', 'Aqaba', 'Madaba', 'Karak', 'Jerash'],
  },
  {
    code: 'LB', name: 'Lebanon', dialCode: '961',
    cities: ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Zahle', 'Baalbek', 'Jounieh', 'Byblos'],
  },
  {
    code: 'KW', name: 'Kuwait', dialCode: '965',
    cities: ['Kuwait City', 'Al Ahmadi', 'Hawalli', 'As Salimiyah', 'Sabah Al Salim', 'Al Farwaniyah', 'Al Fahahil', 'Jahra'],
  },
  {
    code: 'QA', name: 'Qatar', dialCode: '974',
    cities: ['Doha', 'Al Rayyan', 'Al Wakrah', 'Umm Salal', 'Al Khor', 'Lusail', 'Mesaieed'],
  },
  {
    code: 'BH', name: 'Bahrain', dialCode: '973',
    cities: ['Manama', 'Muharraq', 'Riffa', 'Hamad Town', 'Isa Town', 'Sitra', 'Jidhafs', 'Budaiya'],
  },
  {
    code: 'OM', name: 'Oman', dialCode: '968',
    cities: ['Muscat', 'Salalah', 'Seeb', 'Bawshar', 'Sohar', 'Nizwa', 'Sur', 'Ibri', 'Buraimi'],
  },
  {
    code: 'YE', name: 'Yemen', dialCode: '967',
    cities: ['Sana\'a', 'Aden', 'Taiz', 'Al Hudaydah', 'Mukalla', 'Ibb', 'Dhamar', 'Hajjah'],
  },
  {
    code: 'AF', name: 'Afghanistan', dialCode: '93',
    cities: ['Kabul', 'Kandahar', 'Herat', 'Mazar-i-Sharif', 'Jalalabad', 'Kunduz', 'Ghazni'],
  },
  {
    code: 'IR', name: 'Iran', dialCode: '98',
    cities: ['Tehran', 'Mashhad', 'Isfahan', 'Karaj', 'Shiraz', 'Tabriz', 'Qom', 'Ahvaz', 'Kermanshah', 'Urmia'],
  },
  {
    code: 'SY', name: 'Syria', dialCode: '963',
    cities: ['Damascus', 'Aleppo', 'Homs', 'Hama', 'Latakia', 'Deir ez-Zor', 'Raqqa', 'Tartus'],
  },
  {
    code: 'PS', name: 'Palestine', dialCode: '970',
    cities: ['Gaza', 'Hebron', 'Nablus', 'Khan Yunis', 'Jenin', 'Tulkarm', 'Rafah', 'Ramallah', 'Bethlehem'],
  },
  {
    code: 'SD', name: 'Sudan', dialCode: '249',
    cities: ['Khartoum', 'Omdurman', 'Khartoum North', 'Port Sudan', 'Kassala', 'El-Obeid', 'Nyala', 'Wad Madani'],
  },
  {
    code: 'SO', name: 'Somalia', dialCode: '252',
    cities: ['Mogadishu', 'Hargeisa', 'Berbera', 'Kismayo', 'Bosaso', 'Galkayo', 'Beledweyne'],
  },
  {
    code: 'TN', name: 'Tunisia', dialCode: '216',
    cities: ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabes', 'Ariana', 'Gafsa'],
  },
  {
    code: 'LY', name: 'Libya', dialCode: '218',
    cities: ['Tripoli', 'Benghazi', 'Misrata', 'Bayda', 'Zawiya', 'Tobruk', 'Sabha'],
  },
  {
    code: 'KE', name: 'Kenya', dialCode: '254',
    cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi', 'Kitale'],
  },
  {
    code: 'TZ', name: 'Tanzania', dialCode: '255',
    cities: ['Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Morogoro', 'Tanga', 'Zanzibar'],
  },
  {
    code: 'GB', name: 'United Kingdom', dialCode: '44',
    cities: ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Leeds', 'Liverpool', 'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff', 'Belfast', 'Leicester', 'Bradford', 'Coventry'],
  },
  {
    code: 'US', name: 'United States', dialCode: '1',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Detroit', 'Boston', 'Washington', 'Atlanta', 'Miami'],
  },
  {
    code: 'CA', name: 'Canada', dialCode: '1',
    cities: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa', 'Mississauga', 'Winnipeg', 'Quebec City', 'Hamilton'],
  },
  {
    code: 'AU', name: 'Australia', dialCode: '61',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Newcastle', 'Wollongong', 'Hobart'],
  },
  {
    code: 'FR', name: 'France', dialCode: '33',
    cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille'],
  },
  {
    code: 'DE', name: 'Germany', dialCode: '49',
    cities: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen'],
  },
  {
    code: 'NL', name: 'Netherlands', dialCode: '31',
    cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Tilburg', 'Almere'],
  },
  {
    code: 'ZA', name: 'South Africa', dialCode: '27',
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'East London'],
  },
];

// Sort by name for nicer UX in the dropdown.
COUNTRIES.sort((a, b) => a.name.localeCompare(b.name));

export default COUNTRIES;

// Helper: find a country by its name (case-insensitive)
export function getCountryByName(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === n) || null;
}
