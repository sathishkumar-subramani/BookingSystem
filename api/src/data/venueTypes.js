// Default venue types. Inserted on first start (missing keys only — admin edits are never overwritten).
// Adding a new kind of business later = add a row here (or via admin) + an engine for its booking mode.

const HALL_UNITS = [
  { key: 'MORNING', label: 'Morning' },
  { key: 'EVENING', label: 'Evening' },
];

const HALL_SLOTS = [
  { key: 'MORNING', label: 'Morning muhurtham', start: '05:00', end: '13:00', units: ['MORNING'] },
  { key: 'EVENING', label: 'Evening reception', start: '16:00', end: '23:00', units: ['EVENING'] },
  { key: 'FULL_DAY', label: 'Full day', start: '05:00', end: '23:00', units: ['MORNING', 'EVENING'] },
];

export const DEFAULT_VENUE_TYPES = [
  {
    key: 'marriage-hall',
    name: 'Marriage halls',
    tamilName: 'திருமண மண்டபம்',
    description: 'Kalyana mandapams and convention halls for weddings, receptions and engagements.',
    icon: 'hall',
    bookingMode: 'EXCLUSIVE',
    enabled: true,
    sortOrder: 1,
    units: HALL_UNITS,
    slotTemplates: HALL_SLOTS,
    eventKinds: ['wedding', 'reception', 'engagement', 'seemantham', 'ear-piercing', 'birthday', 'other'],
  },
  {
    key: 'party-hall',
    name: 'Party halls',
    tamilName: 'விழா அரங்கம்',
    description: 'Smaller halls for birthdays, anniversaries and get-togethers. Same engine as marriage halls.',
    icon: 'party',
    bookingMode: 'EXCLUSIVE',
    enabled: false,
    sortOrder: 2,
    units: HALL_UNITS,
    slotTemplates: HALL_SLOTS,
    eventKinds: ['birthday', 'anniversary', 'get-together', 'other'],
  },
  {
    key: 'gym',
    name: 'Gyms',
    tamilName: 'உடற்பயிற்சி கூடம்',
    description: 'Day passes and monthly memberships.',
    icon: 'gym',
    bookingMode: 'SUBSCRIPTION',
    enabled: false,
    sortOrder: 3,
    units: [],
    slotTemplates: [],
    eventKinds: [],
  },
  {
    key: 'concert',
    name: 'Concerts & shows',
    tamilName: 'இசை நிகழ்ச்சி',
    description: 'Ticketed events with seat tiers.',
    icon: 'ticket',
    bookingMode: 'TICKETED',
    enabled: false,
    sortOrder: 4,
    units: [],
    slotTemplates: [],
    eventKinds: [],
  },
];
