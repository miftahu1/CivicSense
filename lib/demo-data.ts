import type { IssueCluster, Report } from "@/lib/types";

const ago = (days: number, hours = 9) => new Date(Date.now() - days * 86_400_000 - (24 - hours) * 3_600_000).toISOString();

const rawDemoReports = [
  {
    id: "demo-water-as", ticketNumber: "CS-26091", reporterId: "demo-student", reporterName: "Ananya Saikia",
    originalText: "আমাৰ হোষ্টেলৰ তৃতীয় মহলাত দুদিন ধৰি পানী নাই।",
    originalLanguage: "Assamese", titleEn: "Water supply out on hostel floor 3", titleAs: "হোষ্টেলৰ তৃতীয় মহলাত পানীৰ যোগান নাই",
    summaryEn: "No water has reached the third floor of the hostel for two days.", summaryAs: "হোষ্টেলৰ তৃতীয় মহলাত দুদিন ধৰি পানীৰ যোগান বন্ধ হৈ আছে।",
    category: "Water supply / plumbing", suggestedPriority: "High", confirmedPriority: "High", priorityExplanation: "An essential service is unavailable across a residential floor.",
    building: "Moirabari Hostel", area: "Third floor · north wing", status: "In progress", clusterId: "cluster-water", assignedTo: "Facilities team", department: "Facilities & plumbing", sensitive: false, analysisStatus: "complete", createdAt: ago(0, 8), updatedAt: ago(0, 10),
    events: [{ id: "e-water-1", actor: "Facilities desk", oldStatus: "Under review", newStatus: "In progress", message: "Plumbing team notified; checking the floor supply line.", createdAt: ago(0, 10) }],
  },
  {
    id: "demo-water-en", ticketNumber: "CS-26087", reporterId: "demo-student-2", reporterName: "Rohan Das",
    originalText: "There has been no water supply on the third floor of the hostel for two days.", originalLanguage: "English",
    titleEn: "Water supply out on hostel floor 3", titleAs: "হোষ্টেলৰ তৃতীয় মহলাত পানীৰ যোগান নাই",
    summaryEn: "The hostel's third floor has had no running water for two days.", summaryAs: "হোষ্টেলৰ তৃতীয় মহলাত দুদিন ধৰি পানী পোৱা হোৱা নাই।",
    category: "Water supply / plumbing", suggestedPriority: "High", confirmedPriority: null, priorityExplanation: "A prolonged interruption to water service is reported.",
    building: "Moirabari Hostel", area: "Third floor", status: "Under review", clusterId: "cluster-water", assignedTo: null, department: "Facilities & plumbing", sensitive: false, analysisStatus: "complete", createdAt: ago(1), updatedAt: ago(1),
    events: [],
  },
  {
    id: "demo-fan-as", ticketNumber: "CS-26078", reporterId: "demo-student", reporterName: "Ananya Saikia",
    originalText: "লাইব্ৰেৰীৰ চিলিং ফেনখনৰ পৰা শব্দ ওলাই আছে।", originalLanguage: "Assamese", titleEn: "Ceiling fan making noise in library", titleAs: "লাইব্ৰেৰীৰ চিলিং ফেনখনত অস্বাভাৱিক শব্দ",
    summaryEn: "A ceiling fan in the library is making an unusual noise.", summaryAs: "লাইব্ৰেৰীৰ এটা চিলিং ফেনৰ পৰা অস্বাভাৱিক শব্দ ওলাইছে।",
    category: "Library facilities", suggestedPriority: "Medium", confirmedPriority: "Medium", priorityExplanation: "A facility needs inspection; no injury or full outage is described.",
    building: "Central Library", area: "Reading room · east side", status: "Under review", clusterId: "cluster-library-fan", assignedTo: "Electrical team", department: "Electrical maintenance", sensitive: false, analysisStatus: "complete", createdAt: ago(2), updatedAt: ago(2),
    events: [],
  },
  {
    id: "demo-fan-en", ticketNumber: "CS-26074", reporterId: "demo-staff", reporterName: "M. Hazarika",
    originalText: "The ceiling fan in the library is making unusual noise.", originalLanguage: "English", titleEn: "Ceiling fan making noise in library", titleAs: "লাইব্ৰেৰীৰ চিলিং ফেনখনত অস্বাভাৱিক শব্দ",
    summaryEn: "An unusual noise is coming from a ceiling fan in the library.", summaryAs: "লাইব্ৰেৰীৰ চিলিং ফেন এখনৰ পৰা অস্বাভাৱিক শব্দ আহিছে।",
    category: "Library facilities", suggestedPriority: "Medium", confirmedPriority: null, priorityExplanation: "A maintenance issue is reported without a safety emergency.",
    building: "Central Library", area: "East reading room", status: "Under review", clusterId: "cluster-library-fan", assignedTo: null, department: "Electrical maintenance", sensitive: false, analysisStatus: "complete", createdAt: ago(3), updatedAt: ago(3),
    events: [],
  },
  {
    id: "demo-chair", ticketNumber: "CS-26069", reporterId: "demo-student-3", reporterName: "Pallavi Gogoi",
    originalText: "শ্ৰেণীকোঠা ৩ ত চকী এখন ভাঙি আছে।", originalLanguage: "Assamese", titleEn: "Broken chair in classroom 3", titleAs: "শ্ৰেণীকোঠা ৩-ত এখন ভঙা চকী",
    summaryEn: "A chair in classroom 3 is broken.", summaryAs: "শ্ৰেণীকোঠা ৩-ত এখন চকী ভাঙি আছে।", category: "Furniture", suggestedPriority: "Low", confirmedPriority: null,
    priorityExplanation: "One damaged chair is described, with no wider disruption reported.", building: "New Arts Building", area: "Classroom 3", status: "Resolved", clusterId: null, assignedTo: "Campus maintenance", department: "General maintenance", sensitive: false, analysisStatus: "complete", createdAt: ago(5), updatedAt: ago(1),
    events: [{ id: "e-chair-1", actor: "Campus maintenance", oldStatus: "In progress", newStatus: "Resolved", message: "Chair repaired and returned to the room.", createdAt: ago(1) }],
  },
  {
    id: "demo-wifi", ticketNumber: "CS-26066", reporterId: "demo-student-2", reporterName: "Rohan Das",
    originalText: "The Wi-Fi in the commerce block has been disconnecting all morning.", originalLanguage: "English", titleEn: "Unstable Wi-Fi in commerce block", titleAs: "কমাৰ্চ ব্লকত ৱাই-ফাই সংযোগ বাৰে বাৰে বিচ্ছিন্ন হৈছে",
    summaryEn: "Wi-Fi in the commerce block has repeatedly disconnected this morning.", summaryAs: "কমাৰ্চ ব্লকত আজি পুৱা ৱাই-ফাই সংযোগ বাৰে বাৰে বিচ্ছিন্ন হৈছে।", category: "Internet / network", suggestedPriority: "Medium", confirmedPriority: null,
    priorityExplanation: "Connectivity is intermittent in one building; broader impact is not yet confirmed.", building: "Commerce Block", area: "Ground floor", status: "Investigating", clusterId: null, assignedTo: "IT services", department: "IT services", sensitive: false, analysisStatus: "complete", createdAt: ago(4), updatedAt: ago(1),
    events: [{ id: "e-wifi-1", actor: "IT services", oldStatus: "Under review", newStatus: "Investigating", message: "Network team checking the access point logs.", createdAt: ago(1) }],
  },
  {
    id: "demo-canteen", ticketNumber: "CS-26059", reporterId: "demo-staff", reporterName: "M. Hazarika",
    originalText: "পশ্চিম কেণ্টিনৰ পিছফালে জমা আৱৰ্জনা পৰিষ্কাৰ হোৱা নাই।", originalLanguage: "Assamese", titleEn: "Waste needs collection behind west canteen", titleAs: "পশ্চিম কেণ্টিনৰ পিছফালে জমা আৱৰ্জনা",
    summaryEn: "Accumulated waste behind the west canteen has not been collected.", summaryAs: "পশ্চিম কেণ্টিনৰ পিছফালে জমা হোৱা আৱৰ্জনা এতিয়াও পৰিষ্কাৰ কৰা হোৱা নাই।", category: "Sanitation / waste", suggestedPriority: "Medium", confirmedPriority: null,
    priorityExplanation: "Waste collection is needed; the report does not describe an immediate hazard.", building: "West Canteen", area: "Service entrance", status: "Under review", clusterId: null, assignedTo: null, department: "Sanitation services", sensitive: false, analysisStatus: "complete", createdAt: ago(6), updatedAt: ago(6),
    events: [],
  },
  {
    id: "demo-electrical", ticketNumber: "CS-26052", reporterId: "demo-student-3", reporterName: "Pallavi Gogoi",
    originalText: "Hostel r third floor ot dudin dhori pani nai.", originalLanguage: "Romanised Assamese", titleEn: "Water supply out on hostel floor 3", titleAs: "হোষ্টেলৰ তৃতীয় মহলাত পানীৰ যোগান নাই",
    summaryEn: "The hostel's third floor has had no water for two days.", summaryAs: "হোষ্টেলৰ তৃতীয় মহলাত দুদিন ধৰি পানী নাই।", category: "Water supply / plumbing", suggestedPriority: "High", confirmedPriority: null,
    priorityExplanation: "A prolonged interruption to water supply is reported in a residential building.", building: "Moirabari Hostel", area: "Third floor · north wing", status: "Under review", clusterId: "cluster-water", assignedTo: null, department: "Facilities & plumbing", sensitive: false, analysisStatus: "complete", createdAt: ago(7), updatedAt: ago(7),
    events: [],
  },
] satisfies Report[];

export const demoReports: Report[] = rawDemoReports.map((report) => ({ ...report, isSynthetic: true }));

export const demoClusters: IssueCluster[] = [
  { id: "cluster-water", title: "Moirabari hostel · water supply", category: "Water supply / plumbing", location: "Moirabari Hostel · third floor", status: "In progress", assignedTo: "Facilities team", reportIds: ["demo-water-as", "demo-water-en", "demo-electrical"], createdAt: ago(1) },
  { id: "cluster-library-fan", title: "Central Library · ceiling fan", category: "Library facilities", location: "Central Library · east reading room", status: "Under review", assignedTo: "Electrical team", reportIds: ["demo-fan-as", "demo-fan-en"], createdAt: ago(2) },
];
