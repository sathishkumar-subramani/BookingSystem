// Demo marriage halls across Tamil Nadu.
// Hall names are made up; towns, districts and coordinates are real (approximate, to a few hundred metres).
// owner: index into DEMO_OWNERS · tier: classic | premium | grand
export const DEMO_HALLS = [
  // ── Chennai & Chengalpattu ──
  { name: 'Thirumagal Kalyana Mandapam', area: 'Mylapore', city: 'Chennai', district: 'Chennai', lat: 13.0339, lng: 80.2697, owner: 0, tier: 'classic' },
  { name: 'Annapoorani Mahal', area: 'T. Nagar', city: 'Chennai', district: 'Chennai', lat: 13.0418, lng: 80.2341, owner: 0, tier: 'premium' },
  { name: 'Kalyani Convention Centre', area: 'Velachery', city: 'Chennai', district: 'Chennai', lat: 12.9791, lng: 80.2209, owner: 0, tier: 'grand' },
  { name: 'Ponni Mahal', area: 'Anna Nagar', city: 'Chennai', district: 'Chennai', lat: 13.085, lng: 80.2101, owner: 0, tier: 'premium' },
  { name: 'Senthamarai Kalyana Mandapam', area: 'Perambur', city: 'Chennai', district: 'Chennai', lat: 13.121, lng: 80.2329, owner: 0, tier: 'classic' },
  { name: 'Marutham Convention Hall', area: 'Porur', city: 'Chennai', district: 'Chennai', lat: 13.0382, lng: 80.1565, owner: 0, tier: 'premium' },
  { name: 'Vasantham Grand Halls', area: 'Thoraipakkam, OMR', city: 'Chennai', district: 'Chennai', lat: 12.9349, lng: 80.2341, owner: 0, tier: 'grand' },
  { name: 'Kaveri Mahal', area: 'Ambattur', city: 'Chennai', district: 'Chennai', lat: 13.1143, lng: 80.1548, owner: 0, tier: 'classic' },
  { name: 'Sri Varalakshmi Thirumana Maaligai', area: 'Tambaram', city: 'Tambaram', district: 'Chengalpattu', lat: 12.9249, lng: 80.1, owner: 0, tier: 'classic' },
  { name: 'Sri Ganapathy Mahal', area: 'Chromepet', city: 'Chennai', district: 'Chengalpattu', lat: 12.9516, lng: 80.1462, owner: 0, tier: 'premium' },
  { name: 'Mullai Kalyana Mandapam', area: 'Guduvanchery', city: 'Guduvanchery', district: 'Chengalpattu', lat: 12.8452, lng: 80.0606, owner: 0, tier: 'classic' },

  // ── Kongu belt ──
  { name: 'Kongu Thirumana Mandapam', area: 'R.S. Puram', city: 'Coimbatore', district: 'Coimbatore', lat: 11.0089, lng: 76.95, owner: 1, tier: 'premium' },
  { name: 'Siruvani Convention Centre', area: 'Peelamedu, Avinashi Road', city: 'Coimbatore', district: 'Coimbatore', lat: 11.0258, lng: 77.0028, owner: 1, tier: 'grand' },
  { name: 'Sri Annamalai Mahal', area: 'Saibaba Colony', city: 'Coimbatore', district: 'Coimbatore', lat: 11.0236, lng: 76.9406, owner: 1, tier: 'classic' },
  { name: 'Noyyal Kalyana Mandapam', area: 'Singanallur', city: 'Coimbatore', district: 'Coimbatore', lat: 10.9989, lng: 77.0325, owner: 1, tier: 'classic' },
  { name: 'Sri Kumaran Mahal', area: 'Avinashi Road', city: 'Tiruppur', district: 'Tiruppur', lat: 11.115, lng: 77.345, owner: 1, tier: 'premium' },
  { name: 'Bhavani Kalyana Mandapam', area: 'Perundurai Road', city: 'Erode', district: 'Erode', lat: 11.335, lng: 77.7, owner: 1, tier: 'classic' },
  { name: 'Mangalam Convention Hall', area: 'Brough Road', city: 'Erode', district: 'Erode', lat: 11.348, lng: 77.725, owner: 1, tier: 'premium' },
  { name: 'Kolli Kalyana Mandapam', area: 'Salem Road', city: 'Namakkal', district: 'Namakkal', lat: 11.2189, lng: 78.1674, owner: 1, tier: 'classic' },

  // ── Madurai region ──
  { name: 'Vaigai Mahal', area: 'Anna Nagar', city: 'Madurai', district: 'Madurai', lat: 9.93, lng: 78.145, owner: 2, tier: 'premium' },
  { name: 'Meenakshi Sundaram Kalyana Mandapam', area: 'Thirunagar', city: 'Madurai', district: 'Madurai', lat: 9.88, lng: 78.07, owner: 2, tier: 'classic' },
  { name: 'Pandian Convention Centre', area: 'K.K. Nagar', city: 'Madurai', district: 'Madurai', lat: 9.9389, lng: 78.1349, owner: 2, tier: 'grand' },
  { name: 'Kundram Kalyana Mandapam', area: 'Thiruparankundram', city: 'Madurai', district: 'Madurai', lat: 9.8787, lng: 78.0719, owner: 2, tier: 'classic' },
  { name: 'Malaikottai Mahal', area: 'Palani Road', city: 'Dindigul', district: 'Dindigul', lat: 10.3624, lng: 77.9695, owner: 2, tier: 'classic' },
  { name: 'Periyar Mahal', area: 'Madurai Road', city: 'Theni', district: 'Theni', lat: 10.0104, lng: 77.4768, owner: 2, tier: 'classic' },

  // ── Cauvery delta ──
  { name: 'Rangam Kalyana Mandapam', area: 'Srirangam', city: 'Tiruchirappalli', district: 'Tiruchirappalli', lat: 10.856, lng: 78.693, owner: 3, tier: 'classic' },
  { name: 'Rockfort Convention Centre', area: 'Thillai Nagar', city: 'Tiruchirappalli', district: 'Tiruchirappalli', lat: 10.825, lng: 78.683, owner: 3, tier: 'grand' },
  { name: 'Kollidam Mahal', area: 'Cantonment', city: 'Tiruchirappalli', district: 'Tiruchirappalli', lat: 10.798, lng: 78.685, owner: 3, tier: 'premium' },
  { name: 'Rajarajan Mahal', area: 'New Bus Stand', city: 'Thanjavur', district: 'Thanjavur', lat: 10.787, lng: 79.1378, owner: 3, tier: 'premium' },
  { name: 'Thamarai Kalyana Mandapam', area: 'Medical College Road', city: 'Thanjavur', district: 'Thanjavur', lat: 10.76, lng: 79.12, owner: 3, tier: 'classic' },
  { name: 'Mahamaham Mahal', area: 'Kumbakonam', city: 'Kumbakonam', district: 'Thanjavur', lat: 10.9617, lng: 79.3881, owner: 3, tier: 'classic' },
  { name: 'Sivapuri Mahal', area: 'East Main Street', city: 'Pudukkottai', district: 'Pudukkottai', lat: 10.3797, lng: 78.8205, owner: 3, tier: 'classic' },

  // ── South ──
  { name: 'Thamirabarani Mahal', area: 'Palayamkottai', city: 'Tirunelveli', district: 'Tirunelveli', lat: 8.72, lng: 77.74, owner: 4, tier: 'premium' },
  { name: 'Nellai Kalyana Mandapam', area: 'Junction', city: 'Tirunelveli', district: 'Tirunelveli', lat: 8.73, lng: 77.71, owner: 4, tier: 'classic' },
  { name: 'Muthunagar Convention Centre', area: 'Palayamkottai Road', city: 'Thoothukudi', district: 'Thoothukudi', lat: 8.7642, lng: 78.1348, owner: 4, tier: 'grand' },
  { name: 'Kumari Kalyana Mandapam', area: 'Vadasery', city: 'Nagercoil', district: 'Kanyakumari', lat: 8.1833, lng: 77.4119, owner: 4, tier: 'classic' },
  { name: 'Kuttralam Mahal', area: 'Courtallam Road', city: 'Tenkasi', district: 'Tenkasi', lat: 8.9594, lng: 77.3157, owner: 4, tier: 'classic' },
  { name: 'Sivakasi Kalyana Mandapam', area: 'Sattur Road', city: 'Sivakasi', district: 'Virudhunagar', lat: 9.4533, lng: 77.8024, owner: 4, tier: 'premium' },

  // ── North & West ──
  { name: 'Palar Mahal', area: 'Katpadi', city: 'Vellore', district: 'Vellore', lat: 12.969, lng: 79.144, owner: 5, tier: 'premium' },
  { name: 'Fort City Convention Centre', area: 'Sathuvachari', city: 'Vellore', district: 'Vellore', lat: 12.94, lng: 79.16, owner: 5, tier: 'grand' },
  { name: 'Pattu Nagar Kalyana Mandapam', area: 'Gandhi Road', city: 'Kancheepuram', district: 'Kancheepuram', lat: 12.8342, lng: 79.7036, owner: 5, tier: 'classic' },
  { name: 'Shevaroy Convention Hall', area: 'Fairlands', city: 'Salem', district: 'Salem', lat: 11.675, lng: 78.13, owner: 5, tier: 'premium' },
  { name: 'Thirumani Kalyana Mandapam', area: 'Ammapet', city: 'Salem', district: 'Salem', lat: 11.654, lng: 78.172, owner: 5, tier: 'classic' },
  { name: 'Hosur Grand Mahal', area: 'Bagalur Road', city: 'Hosur', district: 'Krishnagiri', lat: 12.7409, lng: 77.8253, owner: 5, tier: 'premium' },
  { name: 'Arunachala Kalyana Mandapam', area: 'Girivalam Road', city: 'Tiruvannamalai', district: 'Tiruvannamalai', lat: 12.2253, lng: 79.0747, owner: 5, tier: 'classic' },
  { name: 'Gadilam Mahal', area: 'Manjakuppam', city: 'Cuddalore', district: 'Cuddalore', lat: 11.748, lng: 79.7714, owner: 5, tier: 'classic' },

  // ── Waiting for admin review (owner not approved yet) ──
  { name: 'Amaravathi Mahal', area: 'Kovai Road', city: 'Karur', district: 'Karur', lat: 10.9601, lng: 78.0766, owner: 6, tier: 'premium', status: 'pending' },
];

// Phone numbers are placeholders in an obviously fake 90000001xx series.
export const DEMO_OWNERS = [
  { name: 'Murugan Raja', email: 'owner@arangam.demo', business: 'Sri Murugan Mahals', city: 'Chennai', phone: '9000000101', status: 'approved' },
  { name: 'Senthil Kumar', email: 'owner.kovai@arangam.demo', business: 'Kovai Kalyana Mandapams', city: 'Coimbatore', phone: '9000000102', status: 'approved' },
  { name: 'Lakshmi Narayanan', email: 'owner.madurai@arangam.demo', business: 'Meenakshi Halls', city: 'Madurai', phone: '9000000103', status: 'approved' },
  { name: 'Rajeswari Venkatesan', email: 'owner.delta@arangam.demo', business: 'Cauvery Delta Mahals', city: 'Tiruchirappalli', phone: '9000000104', status: 'approved' },
  { name: 'Anthony Selvaraj', email: 'owner.south@arangam.demo', business: 'Southern Convention Centres', city: 'Tirunelveli', phone: '9000000105', status: 'approved' },
  { name: 'Kavitha Arumugam', email: 'owner.north@arangam.demo', business: 'Vellore Palace Halls', city: 'Vellore', phone: '9000000106', status: 'approved' },
  { name: 'Dinesh Babu', email: 'owner.new@arangam.demo', business: 'Amaravathi Events', city: 'Karur', phone: '9000000107', status: 'pending' },
];

export const DEMO_CUSTOMERS = [
  { name: 'Priya Raman', email: 'user@arangam.demo', phone: '9000000108' },
  { name: 'Karthik Subramanian', email: 'karthik@arangam.demo', phone: '9000000109' },
  { name: 'Divya Krishnan', email: 'divya@arangam.demo', phone: '9000000110' },
  { name: 'Arun Prakash', email: 'arun@arangam.demo', phone: '9000000111' },
  { name: 'Meena Sundaram', email: 'meena@arangam.demo', phone: '9000000112' },
  { name: 'Vignesh Ramasamy', email: 'vignesh@arangam.demo', phone: '9000000113' },
  { name: 'Lavanya Ganesan', email: 'lavanya@arangam.demo', phone: '9000000114' },
  { name: 'Sathya Moorthy', email: 'sathya@arangam.demo', phone: '9000000115' },
];
