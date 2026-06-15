export const USER = {
  name: "Arjun Murugan",
  initials: "AM",
  district: "Hubballi",
  email: "arjun.m@example.com",
  phone: "+91 98xxx xxx12",
  aadhaarLast4: "4821",
  dob: "12 Aug 1996",
  address: "12, Anna Salai, Hubballi - 625001",
  citizenId: "TN-2026-771284",
  memberSince: "Jan 2026",
  verified: true,
};

export type Dept = {
  key: string;
  name: string;
  emoji: string;
  color: string; // hex
};

export const DEPARTMENTS: Dept[] = [
  { key: "water", name: "Water Board", emoji: "💧", color: "#2E86AB" },
  { key: "tneb", name: "TNEB", emoji: "⚡", color: "#F59E0B" },
  { key: "highways", name: "Highways", emoji: "🛣️", color: "#E76F51" },
  { key: "health", name: "Health Dept", emoji: "🏥", color: "#10B981" },
  { key: "education", name: "Education Dept", emoji: "🎓", color: "#6366F1" },
  { key: "agri", name: "Agriculture", emoji: "🌾", color: "#65A30D" },
  { key: "revenue", name: "Revenue", emoji: "🏛️", color: "#9333EA" },
  { key: "police", name: "Police", emoji: "🚔", color: "#1B4F8A" },
  { key: "fire", name: "Fire & Rescue", emoji: "🔥", color: "#E74C3C" },
  { key: "fisheries", name: "Fisheries", emoji: "🐟", color: "#0EA5E9" },
  { key: "general", name: "General Services", emoji: "🏛️", color: "#64748B" },
];

export function routeComplaint(text: string): Dept {
  const t = text.toLowerCase();
  if (/(water|tann?eer|pipe|tanneer|தண்ணீர்)/i.test(t)) return DEPARTMENTS[0];
  if (/(light|current|power|electric|tneb|மின்)/i.test(t)) return DEPARTMENTS[1];
  if (/(road|pothole|street|highway|சாலை)/i.test(t)) return DEPARTMENTS[2];
  if (/(hospital|medic|health|doctor|மருத்துவ)/i.test(t)) return DEPARTMENTS[3];
  if (/(school|teacher|education|பள்ளி)/i.test(t)) return DEPARTMENTS[4];
  return DEPARTMENTS[10];
}

export function newTicket(deptKey: string) {
  const n = Math.floor(100000 + Math.random() * 899999);
  return `KGC-2026-${deptKey.toUpperCase()}-${String(n).padStart(6, "0")}`;
}

export const TN_DISTRICTS = [
  "Ariyalur",
  "Chengalpattu",
  "Bengaluru",
  "Mysuru",
  "Cuddalore",
  "Dharmapuri",
  "Dindigul",
  "Erode",
  "Kallakurichi",
  "Kanchipuram",
  "Kanyakumari",
  "Karur",
  "Krishnagiri",
  "Hubballi",
  "Mayiladuthurai",
  "Nagapattinam",
  "Namakkal",
  "Nilgiris",
  "Perambalur",
  "Pudukkottai",
  "Ramanathapuram",
  "Ranipet",
  "Belagavi",
  "Sivaganga",
  "Tenkasi",
  "Thanjavur",
  "Theni",
  "Thoothukudi",
  "Tiruchirappalli",
  "Tirunelveli",
  "Tirupathur",
  "Tiruppur",
  "Tiruvallur",
  "Tiruvannamalai",
  "Tiruvarur",
  "Vellore",
  "Viluppuram",
  "Virudhunagar",
];

export const NEWS = [
  {
    id: "n1",
    title: "New Bengaluru Metro Phase 3 — 48km Extension Announced",
    dept: "Infrastructure",
    deptColor: "#1B4F8A",
    district: "Bengaluru",
    date: "2 days ago",
    summary:
      "₹8,400 Cr Phase 3 expansion approved connecting Madhavaram, Sholinganallur, and Poonamallee. 50 new stations, fully solar-powered, expected completion 2029.",
    kannada: "சென்னை மெட்ரோ மூன்றாம் கட்ட விரிவாக்கம் — 48 கி.மீ புதிய பாதை.",
    views: 12430,
    comments: 289,
    featured: true,
    category: "Infrastructure",
  },
  {
    id: "n2",
    title: "Free Medical Camps in 500 Villages — Health Dept Initiative",
    dept: "Health",
    deptColor: "#10B981",
    district: "State-wide",
    date: "3 days ago",
    summary:
      "Mobile health units will visit 500 villages monthly for diabetes, BP and cancer screening. Tele-consultation with AIIMS specialists included.",
    kannada: "500 கிராமங்களில் இலவச மருத்துவ முகாம்கள்.",
    views: 8421,
    comments: 142,
    category: "Health",
  },
  {
    id: "n3",
    title: "Smart Agriculture Initiative — Drone Spraying for 10,000 Farmers",
    dept: "Agriculture",
    deptColor: "#65A30D",
    district: "Mysuru",
    date: "5 days ago",
    summary:
      "Subsidised drone services for pesticide and fertiliser spraying. 60% cost reduction expected. Training centres opening in Mysuru and Erode.",
    kannada: "விவசாயிகளுக்கு ட்ரோன் தெளிப்பு உதவி.",
    views: 5210,
    comments: 91,
    category: "Agriculture",
  },
  {
    id: "n4",
    title: "New Government School Buildings — 200 Schools Upgraded",
    dept: "Education",
    deptColor: "#6366F1",
    district: "Multi-district",
    date: "1 week ago",
    summary:
      "Smart classrooms, science labs and clean toilets installed across 200 panchayat union schools under the Namma School 2.0 program.",
    kannada: "200 அரசு பள்ளிகள் நவீனமயமாக்கப்பட்டுள்ளன.",
    views: 6712,
    comments: 154,
    category: "Education",
  },
  {
    id: "n5",
    title: "Cauvery Water Supply Expansion — Mangaluru & Hubballi",
    dept: "Water",
    deptColor: "#2E86AB",
    district: "Mangaluru, Hubballi",
    date: "1 week ago",
    summary:
      "₹1,200 Cr expansion of Cauvery distribution to cover 4 lakh additional households. New pumping stations at Mukkombu and Vaigai.",
    kannada: "காவிரி நீர் விநியோகம் விரிவாக்கம்.",
    views: 9120,
    comments: 211,
    category: "Water",
  },
];

export const POLLS = [
  {
    id: "p1",
    title: "New Elevated Highway — Bengaluru to Chengalpattu",
    dept: "Highways",
    deptColor: "#E76F51",
    priority: "High Impact",
    district: "Bengaluru, Chengalpattu",
    closingDays: 5,
    description:
      "62 km elevated 6-lane corridor to reduce travel time from 2 hours to 35 minutes. PPP model with 15-year toll. Affects 1,200 farming acres.",
    budget: "₹450 Crore",
    timeline: "3 Years",
    location: "Bengaluru, Chengalpattu",
    votes: { support: 30906, oppose: 10141, modify: 5311, neutral: 1933 },
    total: 48291,
    districts: 34,
  },
  {
    id: "p2",
    title: "Solar Rooftop on All Government Buildings",
    dept: "Energy",
    deptColor: "#F59E0B",
    priority: "High Impact",
    district: "State-wide",
    closingDays: 12,
    description:
      "Mandatory solar installation on all government buildings >5,000 sqft. Estimated to save ₹240 Cr/year and offset 1.2 lakh tonnes CO₂.",
    budget: "₹820 Crore",
    timeline: "2 Years",
    location: "All districts",
    votes: { support: 51200, oppose: 3120, modify: 5980, neutral: 2120 },
    total: 62420,
    districts: 38,
  },
  {
    id: "p3",
    title: "Smart Bus Stops with WiFi — 500 Locations",
    dept: "Transport",
    deptColor: "#1B4F8A",
    priority: "Medium",
    district: "Tier-1 & Tier-2 cities",
    closingDays: 2,
    description:
      "Solar-powered smart bus shelters with real-time arrival displays, free WiFi, USB charging, and emergency call buttons.",
    budget: "₹120 Crore",
    timeline: "18 Months",
    location: "10 major cities",
    votes: { support: 21200, oppose: 3120, modify: 4980, neutral: 480 },
    total: 29780,
    districts: 22,
  },
  {
    id: "p4",
    title: "Night Market Zones in Tier-2 Cities",
    dept: "Urban Dev",
    deptColor: "#9333EA",
    priority: "Low",
    district: "Tier-2 cities",
    closingDays: 18,
    description:
      "Designated night-market zones operating 6 PM – 1 AM with dedicated parking, lighting, and police presence. Boost to local economy.",
    budget: "₹85 Crore",
    timeline: "1 Year",
    location: "8 cities",
    votes: { support: 8120, oppose: 5240, modify: 2980, neutral: 580 },
    total: 16920,
    districts: 14,
  },
];

export const PROPOSALS = [
  {
    id: "pr1",
    title: "Install CCTV at all bus stops for women safety",
    category: "Infrastructure",
    description:
      "All public bus stops must have CCTV with live monitoring at district control rooms. Will reduce harassment and improve emergency response.",
    author: "Citizen from Mysuru",
    district: "Mysuru",
    time: "3h ago",
    verified: true,
    up: 12843,
    down: 412,
    govResponse: { dept: "Home Dept", date: "March 2027" },
  },
  {
    id: "pr2",
    title: "Free WiFi at all taluk offices",
    category: "Innovation",
    description:
      "Citizens visiting taluk offices for documents often wait hours. Free WiFi will help them work remotely and file forms online.",
    author: "Citizen from Belagavi",
    district: "Belagavi",
    time: "8h ago",
    verified: true,
    up: 8291,
    down: 210,
    govResponse: null,
  },
  {
    id: "pr3",
    title: "Kannada medium option in all digital government services",
    category: "Innovation",
    description:
      "Every TN government portal must offer Kannada as default. Currently many forms are English-only.",
    author: "Citizen from Hubballi",
    district: "Hubballi",
    time: "1d ago",
    verified: true,
    up: 7654,
    down: 84,
    govResponse: { dept: "IT Dept", date: "Approved" },
  },
  {
    id: "pr4",
    title: "Electric auto-rickshaw charging stations in rural areas",
    category: "Environment",
    description:
      "Subsidised e-auto charging at every panchayat. Reduces fuel costs for drivers and pollution in villages.",
    author: "Citizen from Erode",
    district: "Erode",
    time: "2d ago",
    verified: true,
    up: 5421,
    down: 320,
    govResponse: null,
  },
  {
    id: "pr5",
    title: "Night ambulance service for all villages",
    category: "Health",
    description:
      "108 services struggle to reach remote villages at night. Dedicated night-shift ambulances at every PHC will save lives.",
    author: "Citizen from Tirunelveli",
    district: "Tirunelveli",
    time: "2d ago",
    verified: true,
    up: 4892,
    down: 110,
    govResponse: null,
  },
  {
    id: "pr6",
    title: "Expand Amma Canteen to all district hospitals",
    category: "Health",
    description:
      "Patients' families need affordable food near hospitals. Amma Canteens at every district HQ hospital will help thousands daily.",
    author: "Citizen from Mangaluru",
    district: "Tiruchirappalli",
    time: "3d ago",
    verified: true,
    up: 3211,
    down: 92,
    govResponse: null,
  },
];

export const MY_COMPLAINTS = [
  {
    id: "c1",
    ticket: "KGC-2026-WATER-004821",
    title: "Water not coming for 3 days — Hubballi",
    dept: "Water Board",
    deptEmoji: "💧",
    priority: "URGENT",
    priorityColor: "#E74C3C",
    status: "In Progress",
    statusColor: "#F59E0B",
    stage: 2,
    date: "5 days ago",
    via: "AI Chatbot",
  },
  {
    id: "c2",
    ticket: "KGC-2026-TNEB-002341",
    title: "Street light broken — Anna Nagar",
    dept: "TNEB",
    deptEmoji: "⚡",
    priority: "MEDIUM",
    priorityColor: "#F59E0B",
    status: "Resolved",
    statusColor: "#10B981",
    stage: 3,
    date: "2 weeks ago",
    via: "AI Chatbot",
  },
  {
    id: "c3",
    ticket: "KGC-2026-HWY-006129",
    title: "Pothole on main road — Mangaluru",
    dept: "Highways",
    deptEmoji: "🛣️",
    priority: "MEDIUM",
    priorityColor: "#F59E0B",
    status: "Open",
    statusColor: "#2E86AB",
    stage: 0,
    date: "1 day ago",
    via: "AI Chatbot",
  },
];

export const NOTIFICATIONS = [
  {
    id: "no1",
    icon: "✅",
    text: "Your complaint KGC-2026-WATER-004821 has been resolved",
    time: "2h ago",
    unread: true,
  },
  {
    id: "no2",
    icon: "🔄",
    text: "Status update: Your road complaint is now In Progress",
    time: "1d ago",
    unread: true,
  },
  {
    id: "no3",
    icon: "📨",
    text: "Government responded to a poll you voted in",
    time: "4d ago",
    unread: false,
  },
];

export const AUCTIONS = [
  {
    id: "auc-1",
    title: "Sand Quarry E-Auction",
    dept: "Mines & Minerals",
    district: "Mangaluru",
    basePrice: "₹ 1,50,00,000",
    endDate: "2026-06-15",
    status: "Live",
    url: "https://tntenders.gov.in",
  },
  {
    id: "auc-2",
    title: "Scrap Vehicles - TNSTC",
    dept: "Transport Dept",
    district: "Hubballi",
    basePrice: "₹ 24,00,000",
    endDate: "2026-06-10",
    status: "Live",
    url: "https://tntenders.gov.in",
  },
  {
    id: "auc-3",
    title: "Commercial Plots - Sipcot Phase II",
    dept: "Industries",
    district: "Mysuru",
    basePrice: "₹ 5,00,00,000",
    endDate: "2026-06-25",
    status: "Live",
    url: "https://sipcot.tn.gov.in",
  },
  {
    id: "auc-4",
    title: "Confiscated Timber E-Auction",
    dept: "Forest Dept",
    district: "Nilgiris",
    basePrice: "₹ 45,00,000",
    endDate: "2026-06-05",
    status: "Closing Soon",
    url: "https://tntenders.gov.in",
  },
];
