import type { PostType, Region } from "@/lib/types";

/**
 * Overseas footprint adapted from the Sept 2023 staffing deck (locations and
 * staffing patterns only, no incumbents). Pattern entries are grades, with an
 * optional specialty after a colon: "02:Standards", "04:IPEF", "MC:Regional".
 *
 * [city, country, region, subregion, lat, lng, type, hardship %, language, pattern, id?]
 */
type Row = [string, string, Region, string, number, number, PostType, number, string | null, string, string?];

const MEA: Region = "Middle East & Africa";
const ASIA: Region = "Asia";
const EUR: Region = "Europe";
const WH: Region = "Western Hemisphere";

export const POST_ROWS: Row[] = [
  // Middle East & Africa: North Africa & Levant
  ["Cairo", "Egypt", MEA, "North Africa & Levant", 30.0444, 31.2357, "E", 20, "Arabic", "MC:Regional,01,03,04"],
  ["Algiers", "Algeria", MEA, "North Africa & Levant", 36.7538, 3.0588, "E", 25, "Arabic", "02"],
  ["Tunis", "Tunisia", MEA, "North Africa & Levant", 36.8065, 10.1815, "E", 15, "Arabic", "03"],
  ["Amman", "Jordan", MEA, "North Africa & Levant", 31.9539, 35.9106, "E", 10, "Arabic", "02"],
  ["Casablanca", "Morocco", MEA, "North Africa & Levant", 33.5731, -7.5898, "C", 5, "French", "01"],
  ["Tel Aviv", "Israel", MEA, "North Africa & Levant", 32.0853, 34.7818, "E", 10, "Hebrew", "OC,02"],
  // Gulf
  ["Abu Dhabi", "United Arab Emirates", MEA, "Gulf", 24.4539, 54.3773, "E", 0, "Arabic", "MC,01,03"],
  ["Dubai", "United Arab Emirates", MEA, "Gulf", 25.2048, 55.2708, "C", 0, "Arabic", "01,03"],
  ["Riyadh", "Saudi Arabia", MEA, "Gulf", 24.7136, 46.6753, "E", 15, "Arabic", "OC,02,02:Standards,03"],
  ["Jeddah", "Saudi Arabia", MEA, "Gulf", 21.4858, 39.1925, "C", 20, "Arabic", "02"],
  ["Dhahran", "Saudi Arabia", MEA, "Gulf", 26.2361, 50.0393, "C", 15, "Arabic", "02"],
  ["Doha", "Qatar", MEA, "Gulf", 25.2854, 51.531, "E", 5, "Arabic", "01,03"],
  ["Kuwait City", "Kuwait", MEA, "Gulf", 29.3759, 47.9774, "E", 10, "Arabic", "02"],
  // Sub-Saharan Africa
  ["Johannesburg", "South Africa", MEA, "Sub-Saharan Africa", -26.2041, 28.0473, "C", 15, null, "MC:Regional,01,02:Standards,04,04"],
  ["Cape Town", "South Africa", MEA, "Sub-Saharan Africa", -33.9249, 18.4241, "C", 5, null, "02"],
  ["Abidjan", "Côte d'Ivoire", MEA, "Sub-Saharan Africa", 5.3197, -4.0167, "E", 20, "French", "02"],
  ["Abidjan (AfDB)", "Côte d'Ivoire", MEA, "Sub-Saharan Africa", 5.33, -4.02, "M", 20, "French", "02:AfDB", "AFDB"],
  ["Lagos", "Nigeria", MEA, "Sub-Saharan Africa", 6.5244, 3.3792, "C", 30, null, "01,03"],
  ["Accra", "Ghana", MEA, "Sub-Saharan Africa", 5.6037, -0.187, "E", 20, null, "01,03"],
  ["Dakar", "Senegal", MEA, "Sub-Saharan Africa", 14.7167, -17.4677, "E", 20, "French", "03"],
  ["Addis Ababa", "Ethiopia", MEA, "Sub-Saharan Africa", 9.03, 38.74, "E", 25, null, "01,03"],
  ["Dar es Salaam", "Tanzania", MEA, "Sub-Saharan Africa", -6.7924, 39.2083, "E", 20, null, "02"],
  ["Luanda", "Angola", MEA, "Sub-Saharan Africa", -8.839, 13.2894, "E", 30, "Portuguese", "02"],
  ["Maputo", "Mozambique", MEA, "Sub-Saharan Africa", -25.9692, 32.5732, "E", 25, "Portuguese", "01,03"],
  ["Nairobi", "Kenya", MEA, "Sub-Saharan Africa", -1.2921, 36.8219, "E", 20, null, "01,03"],
  ["Lusaka", "Zambia", MEA, "Sub-Saharan Africa", -15.3875, 28.3228, "E", 20, null, "02"],

  // Asia: Northeast & Oceania
  ["Seoul", "South Korea", ASIA, "Northeast Asia & Oceania", 37.5665, 126.978, "E", 10, "Korean", "OC,01,02,03,04,04:IPEF"],
  ["Sydney", "Australia", ASIA, "Northeast Asia & Oceania", -33.8688, 151.2093, "C", 0, null, "OC,02,03:IPEF"],
  ["Auckland", "New Zealand", ASIA, "Northeast Asia & Oceania", -36.8485, 174.7633, "C", 0, null, "02"],
  ["Taipei", "Taiwan", ASIA, "Northeast Asia & Oceania", 25.033, 121.5654, "E", 0, "Mandarin", "OC,01,02,02,03"],
  ["Tokyo", "Japan", ASIA, "Northeast Asia & Oceania", 35.6762, 139.6503, "E", 0, "Japanese", "MC,OC,02,02,02:IPEF,03,03,04"],
  ["Osaka-Kobe", "Japan", ASIA, "Northeast Asia & Oceania", 34.6937, 135.5023, "C", 0, "Japanese", "01,03"],
  // Southeast
  ["Singapore", "Singapore", ASIA, "Southeast Asia", 1.3521, 103.8198, "E", 0, null, "MC:Regional,01:IPEF,03,04"],
  ["Bangkok", "Thailand", ASIA, "Southeast Asia", 13.7563, 100.5018, "E", 10, "Thai", "OC,02,03"],
  ["Jakarta", "Indonesia", ASIA, "Southeast Asia", -6.2088, 106.8456, "E", 15, "Indonesian", "OC,02,04,04"],
  ["Kuala Lumpur", "Malaysia", ASIA, "Southeast Asia", 3.139, 101.6869, "E", 5, "Malay", "01,03"],
  ["Manila", "Philippines", ASIA, "Southeast Asia", 14.5995, 120.9842, "E", 20, null, "01,03,04:IPEF"],
  ["Manila (ADB)", "Philippines", ASIA, "Southeast Asia", 14.5886, 121.0567, "M", 20, null, "02:ADB", "ADB"],
  ["Hanoi", "Vietnam", ASIA, "Southeast Asia", 21.0278, 105.8342, "E", 15, "Vietnamese", "OC,02,04:IPEF"],
  ["Ho Chi Minh City", "Vietnam", ASIA, "Southeast Asia", 10.8231, 106.6297, "C", 15, "Vietnamese", "01,03"],
  ["Phnom Penh", "Cambodia", ASIA, "Southeast Asia", 11.5564, 104.9282, "E", 25, "Khmer", "03"],
  // South
  ["New Delhi", "India", ASIA, "South Asia", 28.6139, 77.209, "E", 20, "Hindi", "MC,OC,01,03,03,04"],
  ["Mumbai", "India", ASIA, "South Asia", 19.076, 72.8777, "C", 20, "Hindi", "OC,02,04,04"],
  ["Chennai", "India", ASIA, "South Asia", 13.0827, 80.2707, "C", 20, null, "02"],
  ["Hyderabad", "India", ASIA, "South Asia", 17.385, 78.4867, "C", 20, null, "02"],
  ["Dhaka", "Bangladesh", ASIA, "South Asia", 23.8103, 90.4125, "E", 30, "Bengali", "02"],
  ["Islamabad", "Pakistan", ASIA, "South Asia", 33.6844, 73.0479, "E", 35, "Urdu", "01"],
  ["Colombo", "Sri Lanka", ASIA, "South Asia", 6.9271, 79.8612, "E", 15, null, "03"],
  // China
  ["Beijing", "China", ASIA, "China", 39.9042, 116.4074, "E", 15, "Mandarin", "MC,OC,OC,01,01,02,02:Standards,03,03:IT,04,04"],
  ["Shanghai", "China", ASIA, "China", 31.2304, 121.4737, "C", 10, "Mandarin", "OC,01,03,04,04"],
  ["Guangzhou", "China", ASIA, "China", 23.1291, 113.2644, "C", 15, "Mandarin", "01,03,04"],
  ["Shenyang", "China", ASIA, "China", 41.8057, 123.4315, "C", 20, "Mandarin", "02"],
  ["Wuhan", "China", ASIA, "China", 30.5928, 114.3055, "C", 20, "Mandarin", "02"],
  ["Hong Kong", "China", ASIA, "China", 22.3193, 114.1694, "C", 0, "Cantonese", "01,03"],

  // Europe
  ["Brussels (USEU)", "Belgium", EUR, "USEU", 50.842, 4.37, "M", 0, "French", "MC,OC,02,02,02:Standards,04", "USEU"],
  ["Berlin", "Germany", EUR, "Central Europe", 52.52, 13.405, "E", 0, "German", "MC,OC,03"],
  ["Frankfurt", "Germany", EUR, "Central Europe", 50.1109, 8.6821, "C", 0, "German", "02"],
  ["Munich", "Germany", EUR, "Central Europe", 48.1351, 11.582, "C", 0, "German", "02"],
  ["Düsseldorf", "Germany", EUR, "Central Europe", 51.2277, 6.7735, "C", 0, "German", "02"],
  ["Warsaw", "Poland", EUR, "Central Europe", 52.2297, 21.0122, "E", 0, "Polish", "OC,02,04"],
  ["Prague", "Czech Republic", EUR, "Central Europe", 50.0755, 14.4378, "E", 0, "Czech", "02"],
  ["Vienna", "Austria", EUR, "Central Europe", 48.2082, 16.3738, "E", 0, "German", "02"],
  ["Budapest", "Hungary", EUR, "Central Europe", 47.4979, 19.0402, "E", 0, "Hungarian", "02"],
  ["London", "United Kingdom", EUR, "Northern Europe", 51.5074, -0.1278, "E", 0, null, "MC,01,03"],
  ["London (EBRD)", "United Kingdom", EUR, "Northern Europe", 51.5226, -0.083, "M", 0, null, "02:EBRD", "EBRD"],
  ["Stockholm", "Sweden", EUR, "Northern Europe", 59.3293, 18.0686, "E", 0, "Swedish", "02"],
  ["Copenhagen", "Denmark", EUR, "Northern Europe", 55.6761, 12.5683, "E", 0, "Danish", "02"],
  ["Helsinki", "Finland", EUR, "Northern Europe", 60.1699, 24.9384, "E", 0, "Finnish", "02"],
  ["Bucharest", "Romania", EUR, "Southeast Europe", 44.4268, 26.1025, "E", 5, "Romanian", "OC,01,03"],
  ["Athens", "Greece", EUR, "Southeast Europe", 37.9838, 23.7275, "E", 0, "Greek", "01,03"],
  ["Sofia", "Bulgaria", EUR, "Southeast Europe", 42.6977, 23.3219, "E", 5, "Bulgarian", "01,03"],
  ["Belgrade", "Serbia", EUR, "Southeast Europe", 44.7866, 20.4489, "E", 10, "Serbian", "02"],
  ["Paris", "France", EUR, "Western & Southern Europe", 48.8566, 2.3522, "E", 0, "French", "MC,01,03"],
  ["Rome", "Italy", EUR, "Western & Southern Europe", 41.9028, 12.4964, "E", 0, "Italian", "OC,02"],
  ["Milan", "Italy", EUR, "Western & Southern Europe", 45.4642, 9.19, "C", 0, "Italian", "02"],
  ["Madrid", "Spain", EUR, "Western & Southern Europe", 40.4168, -3.7038, "E", 0, "Spanish", "01,03"],
  ["Lisbon", "Portugal", EUR, "Western & Southern Europe", 38.7223, -9.1393, "E", 0, "Portuguese", "02"],
  ["Brussels", "Belgium", EUR, "Western & Southern Europe", 50.8503, 4.3517, "E", 0, "French", "02"],
  ["Ankara", "Türkiye", EUR, "Eurasia", 39.9334, 32.8597, "E", 10, "Turkish", "MC,OC,04"],
  ["Istanbul", "Türkiye", EUR, "Eurasia", 41.0082, 28.9784, "C", 5, "Turkish", "01,03,02:Regional"],
  ["Almaty", "Kazakhstan", EUR, "Eurasia", 43.222, 76.8512, "C", 15, "Russian", "01,04"],
  ["Kyiv", "Ukraine", EUR, "Eurasia", 50.4501, 30.5234, "E", 35, "Ukrainian", "01,03"],
  ["Tbilisi", "Georgia", EUR, "Eurasia", 41.7151, 44.8271, "E", 15, "Russian", "03"],

  // Western Hemisphere
  ["Mexico City", "Mexico", WH, "North America", 19.4326, -99.1332, "E", 10, "Spanish", "MC,OC,01,02:Standards,03,04"],
  ["Guadalajara", "Mexico", WH, "North America", 20.6597, -103.3496, "C", 10, "Spanish", "02"],
  ["Monterrey", "Mexico", WH, "North America", 25.6866, -100.3161, "C", 15, "Spanish", "02"],
  ["Ottawa", "Canada", WH, "North America", 45.4215, -75.6972, "E", 0, "French", "MC,01"],
  ["Toronto", "Canada", WH, "North America", 43.6532, -79.3832, "C", 0, null, "01,03"],
  ["Calgary", "Canada", WH, "North America", 51.0447, -114.0719, "C", 0, null, "02"],
  ["Montreal", "Canada", WH, "North America", 45.5019, -73.5674, "C", 0, "French", "02"],
  ["Bogotá", "Colombia", WH, "Central America & Andes", 4.711, -74.0721, "E", 15, "Spanish", "MC,01,03"],
  ["Guatemala City", "Guatemala", WH, "Central America & Andes", 14.6349, -90.5069, "E", 15, "Spanish", "02"],
  ["Lima", "Peru", WH, "Central America & Andes", -12.0464, -77.0428, "E", 10, "Spanish", "01,03"],
  ["Panama City", "Panama", WH, "Central America & Andes", 8.9824, -79.5199, "E", 5, "Spanish", "02"],
  ["San José", "Costa Rica", WH, "Central America & Andes", 9.9281, -84.0907, "E", 5, "Spanish", "02"],
  ["San Salvador", "El Salvador", WH, "Central America & Andes", 13.6929, -89.2182, "E", 15, "Spanish", "02"],
  ["Tegucigalpa", "Honduras", WH, "Central America & Andes", 14.0723, -87.1921, "E", 25, "Spanish", "02"],
  ["Georgetown", "Guyana", WH, "Central America & Andes", 6.8013, -58.1551, "E", 20, null, "02"],
  ["Santo Domingo", "Dominican Republic", WH, "Central America & Andes", 18.4861, -69.9312, "E", 10, "Spanish", "01,03"],
  ["Brasília", "Brazil", WH, "South America", -15.7939, -47.8828, "E", 5, "Portuguese", "MC,02,04"],
  ["São Paulo", "Brazil", WH, "South America", -23.5505, -46.6333, "C", 5, "Portuguese", "OC,02,02:Standards,04"],
  ["Rio de Janeiro", "Brazil", WH, "South America", -22.9068, -43.1729, "C", 10, "Portuguese", "01,03"],
  ["Recife", "Brazil", WH, "South America", -8.0476, -34.877, "C", 15, "Portuguese", "02"],
  ["Buenos Aires", "Argentina", WH, "South America", -34.6037, -58.3816, "E", 0, "Spanish", "01,03"],
  ["Montevideo", "Uruguay", WH, "South America", -34.9011, -56.1645, "E", 0, "Spanish", "02"],
  ["Santiago", "Chile", WH, "South America", -33.4489, -70.6693, "E", 0, "Spanish", "01,03"],

  // Washington: every one of these sits on the same few blocks, the worst case for a map
  ["ITA Front Office", "United States", "Washington", "Headquarters", 38.8938, -77.0325, "H", 0, null,
    "CM:DDG,CM:DAS MEA,CM:DAS China,MC:ED Europe,MC:ED Asia,MC:ED Western Hemisphere,01:CDAS", "ITAFO"],
  ["Global Markets HQ", "United States", "Washington", "Headquarters", 38.8938, -77.0325, "H", 0, null,
    "01:OGTM,01:MEA,01:Asia,01:Asia,01:Advocacy Center,03:Western Hemisphere,03:China,03:Asia,03:Asia,03:OSE,04:Europe,04:Europe,04:MEA,04:MEA,04:Advocacy Center,04:Asia,04:Asia", "GMHQ"],
  ["National War College", "United States", "Washington", "Details", 38.8665, -77.0162, "H", 0, null, "MC:Faculty", "NWC"],

  // U.S. field
  ["Irvine USEAC", "United States", "U.S. Field", "USEACs", 33.6846, -117.8265, "D", 0, null, "03", "IRV"],
  ["New York USEAC", "United States", "U.S. Field", "USEACs", 40.7128, -74.006, "D", 0, null, "03,04", "NYC"],
  ["Atlanta USEAC", "United States", "U.S. Field", "USEACs", 33.749, -84.388, "D", 0, null, "03", "ATL"],
  ["Boston USEAC", "United States", "U.S. Field", "USEACs", 42.3601, -71.0589, "D", 0, null, "04", "BOS"],
  ["Northern Virginia USEAC", "United States", "U.S. Field", "USEACs", 38.8964, -77.0719, "D", 0, null, "04", "NOVA"],
  ["USSOUTHCOM", "United States", "U.S. Field", "Combatant Commands", 25.8195, -80.3553, "D", 0, null, "02:POLAD Commercial", "SOCOM"],
  ["USINDOPACOM", "United States", "U.S. Field", "Combatant Commands", 21.3875, -157.9, "D", 0, null, "02:POLAD Commercial", "INDO"],
];
