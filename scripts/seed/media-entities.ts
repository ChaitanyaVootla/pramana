/**
 * Pictures for people, places, sites, inscriptions and polities, so hover
 * cards and the people and places lists have a thumbnail. Candidates came from
 * each entity's Wikidata image (P18); every one was looked at and its Commons
 * page read, and the doubtful ones were left out (see SKIPPED). Proposed
 * THROUGH MCP as media records only (no page edits).
 *
 *   pnpm tsx scripts/seed/media-entities.ts                 # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Entities missing from the database are skipped, so the same list serves
 * both the main and the preview database.
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish } from "../lib/proposal";
import { checkPicks, flags, proposeMedia, usBasisNotes, type Pick } from "./media-lib";

const PICKS: Pick[] = [
  // People
  {
    file: "File:Alexander the Great mosaic (cropped).jpg",
    ref: "e_alexander",
    title: "Alexander in the Alexander Mosaic",
    alt: "Detail of an ancient mosaic: a bare-headed young man in armour, eyes wide, turned to one side.",
    representation: "later_imagining",
    representationNote:
      "A Roman floor mosaic from Pompeii, made about 100 BCE, two centuries after Alexander; it may copy an earlier Greek painting. Not a portrait from life.",
    needsUsBasis: true,
    usBasis: "an ancient Roman mosaic (about 100 BCE), reproduced faithfully (PD-Art): no copyright anywhere.",
    depicts: ["alexander-the-great"],
  },
  {
    file: "File:Dadabhai Naoroji, 1892.jpg",
    ref: "e_naoroji",
    title: "Dadabhai Naoroji, 1892",
    alt: "Portrait photograph of Dadabhai Naoroji seated, an elderly man with a white beard, resting his head on his hand.",
    representation: "historical_photograph",
    needsUsBasis: true,
    usBasis: "a photograph made in 1892, more than 120 years ago, so public domain in the US whether or not it was published.",
    depicts: ["dadabhai-naoroji"],
  },
  {
    file: "File:Clement Attlee.jpg",
    ref: "e_attlee",
    title: "Clement Attlee, 1950",
    alt: "Photograph of Clement Attlee smiling, a balding man with a moustache, in a suit.",
    representation: "historical_photograph",
    depicts: ["clement-attlee"],
  },
  // Gupta kings, as their own coins show them
  {
    file: "File:Queen Kumaradevi and King Chandragupta I on a coin.jpg",
    ref: "e_kumaradevi_coin",
    title: "Chandragupta I and Kumāradevī on a gold coin",
    alt: "A gold coin showing a king and a queen standing face to face, the king offering her something.",
    representation: "photograph_of_object",
    representationNote:
      "Stylised royal images, not portraits from life. Whether Chandragupta I or his son Samudragupta issued the coin is debated.",
    depicts: ["chandragupta-i", "kumaradevi"],
  },
  {
    file: "File:KumaraguptaFightingLion.jpg",
    ref: "e_kumaragupta_coin",
    title: "Kumāragupta I on a gold coin",
    alt: "A gold coin showing a king fighting a lion.",
    representation: "photograph_of_object",
    representationNote: "A stylised royal image on the king's own coin, not a portrait from life.",
    depicts: ["kumaragupta-i"],
  },
  {
    file: "File:Skandagupta Circa 455-480 CE.jpg",
    ref: "e_skandagupta_coin",
    title: "Skandagupta's “archer type” gold coin",
    alt: "Both faces of a gold coin: a king standing with a bow and arrow, and a goddess seated on a lotus.",
    representation: "photograph_of_object",
    representationNote: "A stylised royal image on the king's own coin, not a portrait from life.",
    depicts: ["skandagupta"],
  },
  {
    file: "File:Budhagupta in Malwa Circa 476-495 CE.jpg",
    ref: "e_budhagupta_coin",
    title: "Budhagupta's gold coin",
    alt: "Both faces of a worn gold coin: a standing king holding a bow, and a goddess seated on a lotus.",
    representation: "photograph_of_object",
    representationNote: "A stylised royal image on the king's own coin, not a portrait from life.",
    depicts: ["budhagupta"],
  },
  {
    file: "File:Mihirakula portrait.jpg",
    ref: "e_mihirakula_coin",
    title: "Mihirakula's head on a coin",
    alt: "Close view of a silver coin: the head of a moustached king in profile, wearing a crown.",
    representation: "photograph_of_object",
    representationNote: "A detail of the king's own coin, cut out from its background by the uploader; a stylised image, not a portrait from life.",
    depicts: ["mihirakula"],
  },
  {
    file: "File:Toramana portrait from coin.jpg",
    ref: "e_toramana_coin",
    title: "Toramāṇa's head on a coin",
    alt: "Close view of a worn coin: the head of a bearded king in profile.",
    representation: "photograph_of_object",
    representationNote: "A detail of the king's own coin; a stylised image, not a portrait from life.",
    depicts: ["toramana"],
  },
  // Travellers and scholars
  {
    file: "File:Xuanzang w.jpg",
    ref: "e_xuanzang",
    title: "Xuanzang, a Japanese painting of the 14th century",
    alt: "A painting of a travelling monk in robes and sandals, carrying a tall frame pack on his back.",
    representation: "later_imagining",
    representationNote: "Painted in Japan in the 14th century, some seven hundred years after his journey. Not a likeness.",
    needsUsBasis: true,
    depicts: ["xuanzang"],
  },
  {
    file: "File:E B Havell.jpg",
    ref: "e_havell",
    title: "E. B. Havell, 1907",
    alt: "Portrait photograph of E. B. Havell, a man with a moustache in a dark suit and high collar.",
    representation: "historical_photograph",
    needsUsBasis: true,
    usBasis: "published in 1907 by the Cyclopedia Publishing Company, Calcutta: published before 1931, so public domain in the US.",
    depicts: ["e-b-havell"],
  },
  // Round 3: Indus, Mahājanapadas and Gupta-era people
  {
    file: "File:Alexander Cunningham of the ASI 02.jpg",
    ref: "e_cunningham",
    title: "Alexander Cunningham",
    alt: "An old printed photograph of Alexander Cunningham, an elderly bearded man seated in a room among sculptures.",
    representation: "historical_photograph",
    needsUsBasis: true,
    usBasis: "a photograph made before his death in 1893, more than 120 years ago: public domain in the US whether or not published.",
    depicts: ["alexander-cunningham"],
  },
  {
    file: "File:Hermann Jacobi.jpg",
    ref: "e_jacobi",
    title: "Hermann Jacobi, 1907",
    alt: "An oval portrait photograph of Hermann Jacobi, a bearded man in a dark suit.",
    representation: "historical_photograph",
    needsUsBasis: true,
    usBasis: "published in 1907 by the Indian Press: published before 1931, so public domain in the US.",
    depicts: ["hermann-jacobi"],
  },
  {
    file: "File:Mortimer Wheeler bust.jpg",
    ref: "e_wheeler",
    title: "A bronze bust of Mortimer Wheeler",
    alt: "A bronze portrait bust of a man with a moustache, beside a bookshelf.",
    representation: "photograph_of_object",
    representationNote: "A bronze bust in the library of the UCL Institute of Archaeology, London.",
    depicts: ["mortimer-wheeler"],
  },
  {
    file: "File:Buddha in Sarnath Museum (Dhammajak Mutra).jpg",
    ref: "e_buddha_sarnath",
    title: "The Buddha teaching, a Sarnath statue of about 475 CE",
    alt: "A sandstone statue of the Buddha seated cross-legged, his hands raised at his chest in the teaching gesture, before a carved halo.",
    representation: "later_imagining",
    representationNote: "Carved about 475 CE, some nine centuries after the Buddha's lifetime. Not a likeness. Sarnath Museum.",
    depicts: ["gautama-buddha"],
  },
  {
    file: "File:Karnataka, jaina tirthankara parshavanatha col cappuccio di serpenti seduto in meditazione (dhyanamudra), xii secolo.jpg",
    ref: "e_parshvanatha",
    title: "Pārśvanātha, a Jain image of the 12th century",
    alt: "A dark stone image of a seated figure in meditation, sheltered by the hood of a many-headed snake.",
    representation: "later_imagining",
    representationNote: "A 12th-century image from Karnataka (Art Institute of Chicago). Tīrthaṅkaras are shown in a set form, not as likenesses.",
    depicts: ["parshvanatha"],
  },
  {
    file: "File:Marble bust of Herodotos MET DT11742 (cropped).jpg",
    ref: "e_herodotus",
    title: "Herodotus, a Roman marble bust",
    alt: "A marble bust of a bearded man, inscribed with his name in Greek.",
    representation: "later_imagining",
    representationNote: "A Roman bust of the 2nd century CE, some six centuries after him (Metropolitan Museum of Art). Not a portrait from life.",
    depicts: ["herodotus"],
  },
  {
    file: "File:Porus alexander coin.png",
    ref: "e_porus_coin",
    title: "Alexander's “Porus” coin",
    alt: "A silver coin: a horseman attacking two riders on an elephant.",
    representation: "photograph_of_object",
    representationNote:
      "Struck for Alexander about 322 BCE. The riders on the elephant are usually taken to be Porus and his driver; a victory image, not a portrait.",
    depicts: ["porus", "battle-of-the-hydaspes"],
  },
  {
    file: "File:Gudea of Lagash Girsu.jpg",
    ref: "e_gudea",
    title: "A statue of Gudea of Lagash",
    alt: "A seated diorite statue of a man in a round cap, hands clasped, his robe covered in cuneiform writing.",
    representation: "photograph_of_object",
    representationNote: "Made in Gudea's own time, about 2120 BCE; a royal image, not a likeness in the modern sense. Louvre.",
    depicts: ["gudea"],
  },
  {
    file: "File:Gudea cylinder A (IX 19) Magan Meluha with transcription.jpg",
    ref: "e_magan_meluhha",
    title: "“Magan” and “Meluhha” in a Sumerian inscription",
    alt: "A close view of cuneiform signs on clay, beside the same signs drawn and labelled “Magan” and “Meluhha”.",
    representation: "copy_of_object",
    representationNote: "A line of Gudea's Cylinder A (about 2120 BCE), as published by Ernest de Sarzec in 1896, with a modern labelling of the two names.",
    needsUsBasis: true,
    depicts: ["magan", "meluhha"],
  },
  {
    file: "File:Khingila portrait.jpg",
    ref: "e_khingila",
    title: "An Alchon Hun king on a coin",
    alt: "Close view of a silver coin: the profile head of a king with a tall, elongated skull and a crown.",
    representation: "photograph_of_object",
    representationNote: "A detail of a coin of the Alchon king Khingila, cut out from its background by the uploader; a stylised royal image.",
    depicts: ["alchon-huns"],
  },
  // Round 3: places and sites
  {
    file: "File:Amritsar-header.jpg",
    ref: "e_amritsar",
    title: "Amritsar: the Golden Temple",
    alt: "The gilded Golden Temple and white buildings reflected in the sacred pool at Amritsar.",
    representation: "photograph_of_site",
    depicts: ["amritsar"],
  },
  {
    file: "File:Varanasi, India, Varanasi skyline in the evening.jpg",
    ref: "e_varanasi",
    title: "Varanasi on the Ganges",
    alt: "The buildings of Varanasi crowding the bank of the Ganges, seen from above in the evening haze.",
    representation: "photograph_of_site",
    depicts: ["varanasi"],
  },
  {
    file: "File:Ghaggar river in Panchkula.jpg",
    ref: "e_ghaggar",
    title: "The Ghaggar river in Haryana",
    alt: "A wide, shallow river with sandy banks under a grey sky.",
    representation: "photograph_of_site",
    depicts: ["ghaggar-hakra-river"],
  },
  {
    file: "File:Dholavira gujarat.jpg",
    ref: "e_dholavira",
    title: "Dholavira",
    alt: "Excavated stone walls on a grassy mound under a blue sky.",
    representation: "photograph_of_site",
    depicts: ["dholavira"],
  },
  {
    file: "File:Westernmound.jpg",
    ref: "e_kalibangan",
    title: "Kalibangan: the western mound",
    alt: "A low, eroded earth mound rising behind sand and scrub.",
    representation: "photograph_of_site",
    depicts: ["kalibangan"],
  },
  {
    file: "File:Kapilavastu.jpg",
    ref: "e_kapilavatthu",
    title: "Tilaurakot, a site proposed as Kapilavatthu",
    alt: "Low brick foundations of excavated buildings on a lawn, with trees behind.",
    representation: "photograph_of_site",
    representationNote: "Tilaurakot in Nepal is one of the sites proposed as Kapilavatthu; Piprahwa in India is another.",
    depicts: ["kapilavatthu"],
  },
  {
    file: "File:Twinmiracle.jpg",
    ref: "e_savatthi",
    title: "Sāvatthī: the Orajhar mound",
    alt: "A stepped brick platform on a hilltop, looking out over flat fields.",
    representation: "photograph_of_site",
    representationNote: "The mound locally called Orajhar, which tradition links to the Buddha's “twin miracle” at Sāvatthī.",
    depicts: ["savatthi"],
  },
  {
    file: "File:Sravasti-citywall.jpg",
    ref: "e_kosala",
    title: "The old city walls of Sāvatthī",
    alt: "A long, grassy earthen bank, the remains of a city wall, beside a path.",
    representation: "photograph_of_site",
    depicts: ["kosala"],
  },
  // Round 3: polities, by their buildings and objects
  {
    file: "File:Gonbad Soltaniye.jpg",
    ref: "e_ilkhanate",
    title: "The dome at Soltaniyeh",
    alt: "A great brick mausoleum with a blue-tiled dome and slender corner towers.",
    representation: "photograph_of_site",
    representationNote: "The mausoleum of the Ilkhan Öljeitü at Soltaniyeh, Iran, built in the early 14th century.",
    depicts: ["ilkhanate"],
  },
  {
    file: "File:Buddha Statue NGFA.jpg",
    ref: "e_pagan",
    title: "A Buddha of the Pagan kingdom",
    alt: "A seated bronze-coloured Buddha with one hand touching the ground.",
    representation: "photograph_of_object",
    representationNote: "Made in the Pagan kingdom, 11th–13th century.",
    depicts: ["pagan-kingdom"],
  },
  {
    file: "File:Lodhi Garden - Muhammed Shah's Tomb.jpg",
    ref: "e_sayyid",
    title: "The tomb of Muhammad Shah, Delhi",
    alt: "An octagonal domed tomb with arcades and small domed pavilions on the roof, in a garden.",
    representation: "photograph_of_site",
    representationNote: "The tomb of the Sayyid sultan Muhammad Shah, in the Lodhi Gardens, Delhi.",
    depicts: ["sayyid-dynasty"],
  },
  {
    file: "File:Avantisvara Temple-4.JPG",
    ref: "e_utpala",
    title: "The ruins of the Avantīśvara temple",
    alt: "Ruined stone walls and pillars of a temple, with two men standing beside them, below hills.",
    representation: "photograph_of_site",
    representationNote: "Built in Kashmir by the Utpala king Avantivarman in the 9th century.",
    depicts: ["utpala-dynasty"],
  },
  // Round 4: Vedic and early medieval
  {
    file: "File:Arthur Anthony Macdonell.png",
    ref: "e_macdonell",
    title: "Arthur Macdonell, 1901",
    alt: "A printed portrait photograph of Arthur Macdonell, a man with a moustache in a dark suit, seated.",
    representation: "historical_photograph",
    needsUsBasis: true,
    usBasis: "published in 1901 in the magazine Prabasi: published before 1931, so public domain in the US.",
    depicts: ["arthur-macdonell"],
  },
  {
    file: "File:Eggeling.jpg",
    ref: "e_eggeling",
    title: "Julius Eggeling, 1907",
    alt: "A sepia portrait photograph of Julius Eggeling, a bearded man seated at a table, holding a paper.",
    representation: "historical_photograph",
    needsUsBasis: true,
    usBasis: "published in 1907 by the Indian Press: published before 1931, so public domain in the US.",
    depicts: ["julius-eggeling"],
  },
  {
    file: "File:Sir William Jones.jpg",
    ref: "e_william_jones",
    title: "Sir William Jones, after Joshua Reynolds",
    alt: "An engraved portrait of a young man in an 18th-century coat, leaning on one arm.",
    representation: "copy_of_object",
    representationNote: "A 19th-century engraving by James Posselwhite after the portrait Joshua Reynolds painted in Jones's lifetime.",
    needsUsBasis: true,
    depicts: ["william-jones"],
  },
  {
    file: "File:Harshavardhana Circa AD 606-647.jpg",
    ref: "e_harsha_coin",
    title: "A silver coin of Harṣa",
    alt: "Both faces of a small silver coin: a king's head in profile, and a bird with a fanned tail.",
    representation: "photograph_of_object",
    representationNote: "A stylised royal image on the king's own coin, not a portrait from life.",
    depicts: ["harsha"],
  },
  {
    file: "File:Atharva-Veda samhita page 471 illustration.png",
    ref: "e_atharvaveda",
    title: "A page of the Kashmir birch-bark Atharvaveda",
    alt: "A brown manuscript page densely written in an old Indian script.",
    representation: "copy_of_object",
    representationNote:
      "A folio of the birch-bark Codex Cashmiriensis, as reproduced by Whitney and Lanman in 1905. Like every Vedic manuscript, much later than the text.",
    needsUsBasis: true,
    usBasis: "published in 1905 (Whitney and Lanman, Atharva-Veda Saṁhitā): published before 1931, so public domain in the US.",
    depicts: ["atharvaveda"],
  },
  {
    file: "File:Palpa, Kali Gandaki River, Nepal.jpg",
    ref: "e_gandaki",
    title: "The Kali Gandaki in Nepal",
    alt: "A wide turquoise river between steep forested hills, with a broad gravel bank.",
    representation: "photograph_of_site",
    depicts: ["gandaki-river"],
  },
  {
    file: "File:View of Ghats across the Ganges, Varanasi.jpg",
    ref: "e_ganga",
    title: "The Ganga at Varanasi",
    alt: "Temple spires and buildings along the steps of the riverbank, with boats on the wide Ganga.",
    representation: "photograph_of_site",
    depicts: ["ganga-river"],
  },
  {
    file: "File:RaviRiver-Chamba.JPG",
    ref: "e_ravi",
    title: "The Ravi near Chamba",
    alt: "A clear river running over rocks in a steep forested valley.",
    representation: "photograph_of_site",
    depicts: ["ravi-river"],
  },
  {
    file: "File:A view of Sutlej river Himachal Pradesh India 2014.jpg",
    ref: "e_sutlej",
    title: "The Sutlej in Himachal Pradesh",
    alt: "A grey river winding through a green valley between forested mountains.",
    representation: "photograph_of_site",
    depicts: ["sutlej-river"],
  },
  {
    file: "File:Citadel of Ghazni, seen from Tapa Sardar.jpg",
    ref: "e_ghazni",
    title: "The citadel of Ghazni",
    alt: "The walls of a hilltop citadel above the town of Ghazni, with bare mountains behind.",
    representation: "photograph_of_site",
    depicts: ["ghazni"],
  },
  {
    file: "File:Kailasanathar temple Kanchipuram (16).jpg",
    ref: "e_kanchipuram",
    title: "Kanchipuram: the Kailāsanātha temple",
    alt: "A sandstone temple with carved pillars and a stepped tower, under a blue sky.",
    representation: "photograph_of_site",
    representationNote: "Built by the Pallavas, whose capital was Kāñcī.",
    depicts: ["kanchipuram"],
  },
  {
    file: "File:Uthiramerur temple.jpg",
    ref: "e_uttaramerur",
    title: "A temple at Uttaramerur",
    alt: "A tall temple gateway tower and a slender flagstaff against a cloudy sky.",
    representation: "photograph_of_site",
    depicts: ["uttaramerur"],
  },
  {
    file: "File:Ahichchhatra Fort Temple Bareilly.jpg",
    ref: "e_ahichchhatra",
    title: "Ahichchhatra: the brick temple mound",
    alt: "A large terraced brick mound rising out of fields.",
    representation: "photograph_of_site",
    depicts: ["ahichchhatra"],
  },
  {
    file: "File:Somanath mandir (cropped).jpg",
    ref: "e_somnath",
    title: "The Somnāth temple today",
    alt: "A large cream-coloured temple with a tall carved spire, by the sea.",
    representation: "photograph_of_site",
    representationNote: "The present temple is a modern reconstruction, built from 1951.",
    depicts: ["somnath-temple"],
  },
  // Places
  {
    file: "File:Panoramic view of Taj Palace Hotel and Taj Tower with the iconic Gateway of India in the background (cropped).jpg",
    ref: "e_bombay",
    title: "Mumbai: the Gateway of India and the Taj hotel",
    alt: "The waterfront of Mumbai seen from the sea: the domed Taj Mahal Palace hotel, a modern tower and the arch of the Gateway of India, with boats in front.",
    representation: "photograph_of_site",
    depicts: ["bombay"],
  },
  {
    file: "File:Ketan donate4.jpg",
    ref: "e_calcutta",
    title: "Kolkata: the Victoria Memorial",
    alt: "A large white marble building with a central dome and corner towers, behind a row of trees.",
    representation: "photograph_of_site",
    depicts: ["calcutta"],
  },
  {
    file: "File:Red Fort in Delhi 03-2016 img3.jpg",
    ref: "e_delhi",
    title: "Delhi: the walls of the Red Fort",
    alt: "The high red sandstone walls and domed pavilions of the Red Fort in Delhi.",
    representation: "photograph_of_site",
    depicts: ["delhi"],
  },
  {
    file: "File:Eye Of Lahore (Minar e Pakistan) evening.jpg",
    ref: "e_lahore",
    title: "Lahore: Minar-e-Pakistan",
    alt: "A tall white tower in a park, with the city of Lahore beyond, at dusk.",
    representation: "photograph_of_site",
    depicts: ["lahore"],
  },
  {
    file: "File:Mahakaleshwar Temple, Ujjain.jpg",
    ref: "e_ujjain",
    title: "Ujjain: the Mahakaleshwar temple",
    alt: "The tall carved spire of the Mahakaleshwar temple lit up at night, with crowds of visitors.",
    representation: "photograph_of_site",
    depicts: ["ujjain"],
  },
  {
    file: "File:Dattatreya Temple of Girnar.JPG",
    ref: "e_girnar",
    title: "Girnar hill",
    alt: "The rocky peaks of Girnar hill rising above the surrounding hills, under clouds.",
    representation: "photograph_of_site",
    depicts: ["girnar"],
  },
  {
    file: "File:Pashupatinath Temple Mandsaur.jpg",
    ref: "e_mandsaur",
    title: "Mandsaur: the Pashupatinath temple",
    alt: "A temple with a lit spire beside a river at night, reflected in the water.",
    representation: "photograph_of_site",
    depicts: ["mandsaur"],
  },
  // Sites and inscriptions
  {
    file: "File:Nalanda The Great Stupa.jpg",
    ref: "e_nalanda",
    title: "Nālandā: the ruins of the great stupa",
    alt: "The stepped brick ruins of a large stupa, with brick platforms in front, under trees.",
    representation: "photograph_of_site",
    depicts: ["nalanda"],
  },
  {
    file: "File:GANDHI ASHRAM 03.jpg",
    ref: "e_sabarmati",
    title: "Sabarmati Ashram",
    alt: "A low house with a tiled roof and a veranda, among trees, with visitors in front.",
    representation: "photograph_of_site",
    depicts: ["sabarmati-ashram"],
  },
  {
    file: "File:Kalsi01.jpg",
    ref: "e_kalsi",
    title: "The Kālsī rock edicts",
    alt: "A large pale boulder inside a shelter, its face cut with faint rows of letters.",
    // The shelter dominates the picture; the inscription is barely legible.
    representation: "photograph_of_site",
    depicts: ["kalsi-rock-edicts"],
  },
  // Polities
  {
    file: "File:British Indian Empire 1909 Imperial Gazetteer of India.jpg",
    ref: "e_british_raj",
    title: "The British Indian Empire, a map of 1909",
    alt: "A printed map of British India and the princely states in colour, from the Imperial Gazetteer of India.",
    representation: "historical_map",
    representationNote: "From the Imperial Gazetteer of India, 1909.",
    needsUsBasis: true,
    usBasis: "published in 1909 in the Imperial Gazetteer of India: published before 1931, so public domain in the US.",
    depicts: ["british-raj"],
  },
  {
    file: "File:Rua Direita na Cidade de Goa.jpg",
    ref: "e_portuguese_goa",
    title: "Goa in the 1590s, by Linschoten",
    alt: "A coloured engraving of a crowded street in Portuguese Goa, with merchants, horses, a palanquin and a row of houses.",
    representation: "made_at_the_time",
    representationNote: "An engraving from Jan Huygen van Linschoten's account of the Portuguese East, published in the 1590s.",
    depicts: ["portuguese-empire"],
  },
  {
    file: "File:BawbawgyiPaya.jpg",
    ref: "e_pyu",
    title: "The Bawbawgyi stupa near Pyay",
    alt: "A tall cylindrical brick stupa with a pointed top, on a stepped base among grass and trees.",
    representation: "photograph_of_site",
    depicts: ["pyu-city-states"],
  },
  {
    file: "File:Malik Shah Rustam in the Presence of Shah Isma'il, illustrated folio from a manuscript of the Tarikh-i `Alamara-yi Shah Isma`il, Isfahan (Iran), c. 1688.jpg",
    ref: "e_safavid",
    title: "A Safavid court scene, Isfahan, about 1688",
    alt: "A manuscript page with a painting of a ruler and courtiers seated in a palace, framed by Persian text.",
    representation: "made_at_the_time",
    representationNote: "Painted in Safavid Isfahan about 1688, long after Shah Ismaʿil's own reign.",
    needsUsBasis: true,
    depicts: ["safavid-dynasty"],
  },
];

/** Wikidata images not used, and why (kept here so nobody re-adds them unexamined). */
export const SKIPPED: Record<string, string> = {
  "abul-kalam-azad, batukeshwar-dutt, subhas-chandra-bose, v-d-savarkar": "tagged PD-India only; no stated US status",
  "b-r-ambedkar": "dated after 1948 yet tagged PD-1996, which cannot both be true",
  "mahatma-gandhi (Elliott & Fry 1931)": "US copyright runs until 2027; the Salt March photograph is used instead",
  "clement-attlee (Karsh?)": "author only 'presumably' known; the 1950 CC0 photograph is used instead",
  "edwin-montagu": "a 1920s press-agency photograph offered under CC BY 3.0 with no clear rightsholder",
  "pushyamitra-shunga": "a Bharhut relief figure, not Pushyamitra",
  samprati: "a 2023 digital illustration",
  "seleucus-i-nicator, sarnath (P18), taxila": "no author recorded, so the licence's attribution cannot be met",
  bindusara: "a coin of his period does not depict him",
  "pataliputra (P18)": "a modern plan; the Kumhrar pillar is used",
  "maurya-empire, mughal-empire, india, gorkha-kingdom, indo-sassanids, satavahana-dynasty": "modern maps that differ from our borders, flags, or images that are not of the polity",
  "myanmar, nepal, pakistan, sri-lanka": "present-day countries; their pictures say nothing about the period",
  kalidasa: "a modern picture captioned as one of the “nine gems”, which the Gupta page treats as a misconception",
  "aryabhata, faxian": "modern statues with nothing to say about the men",
  "yashodharman, vincent-a-smith (P18)": "a 1915 battle illustration, and a book title page",
  "peroz-i": "the licence holder recorded is a museum, which is doubtful for a CC BY-SA photograph",
  "ajanta-caves (P18)": "no author recorded; the Padmapāṇi photograph is used",
  "bimbisara, pasenadi, udena, taxiles, cyrus-the-great, mahavira, makkhali-gosala": "later or modern pictures that are not of the person, or whose identification is doubtful",
  "daya-ram-sahni, r-d-banerji": "tagged PD-India only; no stated US status",
  "mahapadma-nanda": "a coin of his period does not depict him",
  "sargon-of-akkad": "the bronze head may be Naram-Sin rather than Sargon",
  "rakhigarhi": "a skeleton: human remains are not used as a thumbnail",
  "harappa (P18)": "the photograph appears to show a modern reconstruction",
  "chalukya-dynasty": "a coin of the later Chalukyas of Kalyāṇi, not the dynasty the entity covers",
  "mahmud-of-ghazni": "an 11th-century dish only “likely” showing him",
  "pulakeshin-ii, yajnavalkya, vasishtha, al-biruni": "modern or much later imaginings",
  "rajaraja-i, rajendra-i": "a modern statue, and a relief whose identification as Rājendra is traditional",
  "amoghavarsha-i": "an inscription of his reign does not depict him",
  "kannauj, kedah, kurukshetra, yamuna-river (P18)": "pictures unrelated to the period, or with no author recorded",
};

const mcp = await connectMcp("pramana-seed");
try {
  const present: Pick[] = [];
  for (const p of PICKS) {
    const missing: string[] = [];
    for (const slug of p.depicts ?? []) {
      try {
        await mcp.call("get_entity", { entity: slug });
      } catch {
        missing.push(slug);
      }
    }
    if (missing.length) console.log(`  skip ${p.ref}: no entity ${missing.join(", ")} in this database`);
    else present.push(p);
  }
  console.log(`Checking ${present.length} files on Commons…`);
  await checkPicks(mcp, present);
  const { proposals } = await proposeMedia(
    mcp,
    "Pictures for people and places",
    [
      "Thumbnails for people, places, sites, inscriptions and polities, from each entity's Wikidata image (P18) where it passed review. Every file was looked at and its Commons page read; licence, author and credit come from the Commons API and are checked against the stored snapshot on apply.",
      "Each record says what the picture is. The Alexander Mosaic is marked as a later imagining; the Goa engraving and the Safavid painting as pictures made at the time; the 1909 Gazetteer map as a historical map. Present-day photographs of cities are marked as photographs of the site, with their dates.",
      `Left out: ${Object.entries(SKIPPED)
        .map(([k, v]) => `${k} (${v})`)
        .join("; ")}.`,
      usBasisNotes(present),
    ]
      .filter(Boolean)
      .join("\n\n"),
    present,
  );
  await finish(mcp, flags, proposals);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
