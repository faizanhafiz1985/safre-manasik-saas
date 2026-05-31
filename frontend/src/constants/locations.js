// Country and city lists for CRM lead capture.
// Focused on the major Umrah/Hajj source markets. City lists are the main
// departure/residence cities per country. Both fields use Autocomplete with
// freeSolo on the city so agents can type a city that is not in the list.

export const COUNTRIES = [
  'Saudi Arabia', 'Pakistan', 'India', 'Bangladesh', 'Indonesia', 'Malaysia',
  'United Kingdom', 'United States', 'Canada', 'Egypt', 'Turkey', 'Nigeria',
  'United Arab Emirates', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan',
  'Morocco', 'Algeria', 'Tunisia', 'South Africa', 'Kenya', 'Sudan',
  'Sri Lanka', 'Afghanistan', 'Iran', 'Iraq', 'Yemen', 'France', 'Germany',
  'Netherlands', 'Australia', 'Singapore', 'Philippines', 'Other',
];

export const CITIES_BY_COUNTRY = {
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Taif', 'Tabuk', 'Abha', 'Buraidah', 'Hail', 'Jubail', 'Yanbu'],
  'Pakistan': ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Gujranwala', 'Sialkot', 'Hyderabad', 'Bahawalpur'],
  'India': ['Mumbai', 'Delhi', 'Hyderabad', 'Bangalore', 'Kolkata', 'Chennai', 'Lucknow', 'Ahmedabad', 'Pune', 'Jaipur', 'Srinagar', 'Kozhikode'],
  'Bangladesh': ['Dhaka', 'Chittagong', 'Sylhet', 'Khulna', 'Rajshahi', 'Comilla'],
  'Indonesia': ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Yogyakarta'],
  'Malaysia': ['Kuala Lumpur', 'Johor Bahru', 'Penang', 'Ipoh', 'Kuching', 'Kota Kinabalu', 'Shah Alam'],
  'United Kingdom': ['London', 'Birmingham', 'Manchester', 'Bradford', 'Leicester', 'Leeds', 'Glasgow', 'Luton', 'Blackburn'],
  'United States': ['New York', 'Chicago', 'Houston', 'Los Angeles', 'Detroit', 'Dallas', 'Philadelphia', 'Atlanta', 'Washington DC'],
  'Canada': ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 'Mississauga'],
  'Egypt': ['Cairo', 'Alexandria', 'Giza', 'Mansoura', 'Tanta', 'Asyut'],
  'Turkey': ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Konya', 'Adana'],
  'Nigeria': ['Lagos', 'Kano', 'Abuja', 'Kaduna', 'Ibadan', 'Sokoto', 'Maiduguri'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Al Ain', 'Ras Al Khaimah'],
  'Qatar': ['Doha', 'Al Rayyan', 'Al Wakrah'],
  'Kuwait': ['Kuwait City', 'Hawalli', 'Al Ahmadi', 'Salmiya'],
  'Bahrain': ['Manama', 'Riffa', 'Muharraq'],
  'Oman': ['Muscat', 'Salalah', 'Sohar', 'Nizwa'],
  'Jordan': ['Amman', 'Zarqa', 'Irbid', 'Aqaba'],
  'Morocco': ['Casablanca', 'Rabat', 'Fez', 'Marrakesh', 'Tangier'],
  'Algeria': ['Algiers', 'Oran', 'Constantine', 'Annaba'],
  'Tunisia': ['Tunis', 'Sfax', 'Sousse'],
  'South Africa': ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria'],
  'Kenya': ['Nairobi', 'Mombasa', 'Nakuru'],
  'Sudan': ['Khartoum', 'Omdurman', 'Port Sudan'],
  'Sri Lanka': ['Colombo', 'Kandy', 'Galle'],
  'Afghanistan': ['Kabul', 'Kandahar', 'Herat', 'Mazar-i-Sharif'],
  'Iran': ['Tehran', 'Mashhad', 'Isfahan', 'Shiraz'],
  'Iraq': ['Baghdad', 'Basra', 'Mosul', 'Erbil', 'Najaf'],
  'Yemen': ['Sanaa', 'Aden', 'Taiz', 'Hodeidah'],
  'France': ['Paris', 'Marseille', 'Lyon', 'Lille', 'Strasbourg'],
  'Germany': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt'],
  'Netherlands': ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
  'Singapore': ['Singapore'],
  'Philippines': ['Manila', 'Cebu', 'Davao', 'Zamboanga', 'Marawi'],
  'Other': [],
};
