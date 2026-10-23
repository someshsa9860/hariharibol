// Calendar icons, one per kind of day. The same drawings as app/assets/calendar/*.svg —
// keep the two in step (and admin/src/lib/calendar-icons.ts). Each is the inside of a 24×24 stroke icon
// coloured by `currentColor`.

export const CALENDAR_ICONS: Record<string, string> = {
  EKADASHI: '<path d="M12 21c-3.600-1-5.600-3.700-5.600-7 2.300.2 4.300 1.300 5.600 3.200 1.300-1.900 3.300-3 5.600-3.200 0 3.300-2 6-5.600 7z"/><path d="M12 17.200c-1.600-1.400-2.400-3.200-2.400-5.300 0-1.600.9-3 2.400-4.200 1.500 1.200 2.400 2.600 2.400 4.200 0 2.100-.8 3.900-2.400 5.300z"/><path d="M7.500 2.800a4 4 0 1 0 4.700 5.200A5 5 0 0 1 7.500 2.800z"/>',
  PARANA: '<path d="M3 19h18"/><path d="M7 19a5 5 0 0 1 10 0"/><path d="M12 9.500v2M5.600 12.600l1.100 1.100M18.400 12.600l-1.100 1.100"/><path d="M8 22h8"/>',
  CHATURTHI: '<path d="M11 4c.8 1 1 1.700.9 2.600 3 .9 5.100 3.600 5.100 6.900 0 3.900-2.700 7-6 7s-6-3.100-6-7c0-3.300 2.100-6 5.100-6.900-.1-.9.100-1.600.9-2.600z" transform="translate(1 .5)"/><path d="M9.500 13.500c.7 1.500 1.500 2.500 2.500 3.200 1-.7 1.800-1.700 2.500-3.200"/><path d="M19.500 2.500a2.600 2.600 0 1 0 2 4A3.300 3.300 0 0 1 19.500 2.500z"/>',
  PURNIMA: '<circle cx="12" cy="12" r="5"/><path d="M12 2.500v2M12 19.500v2M2.500 12h2M19.500 12h2M5.300 5.300l1.400 1.400M17.300 17.300l1.400 1.400M5.300 18.700l1.400-1.400M17.300 6.700l1.400-1.400"/>',
  AMAVASYA: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="5" fill="currentColor"/>',
  PRADOSH: '<path d="M12 21V9"/><path d="M6.500 5v4.200a5.500 5.500 0 0 0 11 0V5"/><path d="M12 3v6.500"/><path d="M6.500 5 5.300 3M17.500 5l1.200-2"/><path d="M9.500 21h5"/>',
  SANKRANTI: '<circle cx="9" cy="9" r="3.500"/><path d="M9 2v1.500M2 9h1.500M4 4l1 1M14 4l-1 1M4 14l1-1"/><path d="M12 17h9M17.500 13.500 21 17l-3.500 3.500"/>',
  FESTIVAL: '<path d="M3 13h18c0 4.200-3.600 7.500-9 7.500S3 17.200 3 13z"/><path d="M12 11.500c-2.200-1.900-2.200-4.300 0-7 2.200 2.700 2.200 5.100 0 7z"/><path d="M8 2.500l.8 1.300M16 2.500l-.8 1.300"/>',
};
