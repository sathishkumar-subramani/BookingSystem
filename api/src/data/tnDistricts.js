// The 38 districts of Tamil Nadu with an approximate headquarters coordinate.
// Used for the district filter and as the fallback map centre until Google Maps is wired in.
// Coordinates are approximate (good to a few km) — fine for "near me" ordering, not for navigation.
export const TN_DISTRICTS = [
  { name: 'Ariyalur', lat: 11.1401, lng: 79.0786 },
  { name: 'Chengalpattu', lat: 12.6921, lng: 79.9707 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Coimbatore', lat: 11.0168, lng: 76.9558 },
  { name: 'Cuddalore', lat: 11.748, lng: 79.7714 },
  { name: 'Dharmapuri', lat: 12.1211, lng: 78.1582 },
  { name: 'Dindigul', lat: 10.3624, lng: 77.9695 },
  { name: 'Erode', lat: 11.341, lng: 77.7172 },
  { name: 'Kallakurichi', lat: 11.738, lng: 78.959 },
  { name: 'Kancheepuram', lat: 12.8342, lng: 79.7036 },
  { name: 'Kanyakumari', lat: 8.1833, lng: 77.4119 },
  { name: 'Karur', lat: 10.9601, lng: 78.0766 },
  { name: 'Krishnagiri', lat: 12.5186, lng: 78.2137 },
  { name: 'Madurai', lat: 9.9252, lng: 78.1198 },
  { name: 'Mayiladuthurai', lat: 11.1018, lng: 79.652 },
  { name: 'Nagapattinam', lat: 10.7672, lng: 79.8449 },
  { name: 'Namakkal', lat: 11.2189, lng: 78.1674 },
  { name: 'Nilgiris', lat: 11.4102, lng: 76.695 },
  { name: 'Perambalur', lat: 11.2342, lng: 78.8807 },
  { name: 'Pudukkottai', lat: 10.3797, lng: 78.8205 },
  { name: 'Ramanathapuram', lat: 9.3639, lng: 78.8395 },
  { name: 'Ranipet', lat: 12.9224, lng: 79.3333 },
  { name: 'Salem', lat: 11.6643, lng: 78.146 },
  { name: 'Sivaganga', lat: 9.8433, lng: 78.4809 },
  { name: 'Tenkasi', lat: 8.9594, lng: 77.3157 },
  { name: 'Thanjavur', lat: 10.787, lng: 79.1378 },
  { name: 'Theni', lat: 10.0104, lng: 77.4768 },
  { name: 'Thoothukudi', lat: 8.7642, lng: 78.1348 },
  { name: 'Tiruchirappalli', lat: 10.7905, lng: 78.7047 },
  { name: 'Tirunelveli', lat: 8.7139, lng: 77.7567 },
  { name: 'Tirupathur', lat: 12.495, lng: 78.573 },
  { name: 'Tiruppur', lat: 11.1085, lng: 77.3411 },
  { name: 'Tiruvallur', lat: 13.1231, lng: 79.912 },
  { name: 'Tiruvannamalai', lat: 12.2253, lng: 79.0747 },
  { name: 'Tiruvarur', lat: 10.7661, lng: 79.6344 },
  { name: 'Vellore', lat: 12.9165, lng: 79.1325 },
  { name: 'Viluppuram', lat: 11.9401, lng: 79.4861 },
  { name: 'Virudhunagar', lat: 9.568, lng: 77.9624 },
];

export const DISTRICT_NAMES = TN_DISTRICTS.map((d) => d.name);

export const AMENITIES = [
  { key: 'ac', label: 'Air-conditioned hall' },
  { key: 'dining', label: 'Separate dining hall' },
  { key: 'parking', label: 'Car parking' },
  { key: 'rooms', label: 'Guest rooms' },
  { key: 'bridal-room', label: 'Bride & groom rooms' },
  { key: 'generator', label: 'Power backup' },
  { key: 'lift', label: 'Lift' },
  { key: 'kitchen', label: 'Kitchen (outside caterers allowed)' },
  { key: 'in-house-catering', label: 'In-house catering' },
  { key: 'stage', label: 'Decorated stage' },
  { key: 'sound', label: 'Sound system' },
  { key: 'valet', label: 'Valet parking' },
  { key: 'wheelchair', label: 'Wheelchair access' },
];

export const AMENITY_KEYS = AMENITIES.map((a) => a.key);
