import type { Language } from "@/lib/types";

export const matchingCases: Array<{ id: string; language: Language; text: string; building: string; area: string }> = [
  { id: "AS-01", language: "Assamese", text: "আমাৰ হোষ্টেলৰ তৃতীয় মহলাত দুদিন ধৰি পানী নাই।", building: "Student Hostel", area: "Third floor" },
  { id: "AS-02", language: "Assamese", text: "লাইব্ৰেৰীৰ চিলিং ফেনখনৰ পৰা শব্দ ওলাই আছে।", building: "Central Library", area: "East reading room" },
  { id: "AS-03", language: "Romanised Assamese", text: "Library r fan tu beya hui ase.", building: "Central Library", area: "East reading room" },
  { id: "EN-01", language: "English", text: "There has been no water supply on the third floor of the hostel for two days.", building: "Student Hostel", area: "Third floor" },
  { id: "EN-02", language: "English", text: "The ceiling fan in the library is making unusual noise.", building: "Central Library", area: "East reading room" },
  { id: "EN-03", language: "English", text: "The Wi-Fi in the commerce building has been disconnecting all morning.", building: "Commerce Building", area: "Ground floor" },
];

export const expectedMatches: Array<[string, string]> = [["AS-01", "EN-01"], ["AS-02", "EN-02"], ["AS-03", "EN-02"]];
export const expectedNonMatches: Array<[string, string]> = [["AS-01", "EN-03"], ["AS-02", "EN-03"], ["AS-01", "AS-02"]];
