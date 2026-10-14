// Statiska, aldrig från AI. Verifiera listan en gång innan demo.
export const CONTACTS = [
  { id: "emergency", name: "SOS Alarm, nödnummer", number: "112" },
  { id: "crisis_info", name: "Information vid olyckor och kriser", number: "113 13" },
  { id: "healthcare", name: "Sjukvårdsrådgivningen", number: "1177" },
  { id: "police", name: "Polisen, icke akut", number: "114 14" },
  { id: "poison", name: "Giftinformationscentralen", number: "010-456 67 00" },
  { id: "p4", name: "Sveriges Radio P4, information vid kris", url: "https://sverigesradio.se/p4" },
  { id: "krisinformation", name: "Krisinformation.se", url: "https://www.krisinformation.se" },
] as const;
