/**
 * Sources for facts the novice copy on /p/independence-movement wanted but no
 * claim supported (docs/research/2026-10-copy-needs-sources.md): the Rowlatt
 * Act's powers, what non-cooperation boycotted, the authorisation of civil
 * disobedience in 1930, the Muslim League's founding, Ambedkar as a Dalit
 * leader, how the Indian National Army was raised and when its men were
 * tried, and which countries were Dominions. Used by copyedit-independence.ts,
 * which proposes these claims in the same changeset as the prose that links
 * them.
 *
 * Every quote was found in the captured snapshot named with it (Internet
 * Archive OCR, a pinned Wikipedia revision, a Wikisource transcription) and is
 * copied as it stands there, OCR slips included; the quote check runs on
 * proposal. Primary sources are public domain. Wikipedia is tertiary and is
 * used, and tiered, as such: for the Rowlatt Act's provisions, the League's
 * founding, Ambedkar's caste and the INA, where no primary text was captured.
 * Naoroji's own meaning of “the Colonies” in 1906 is not sourced, so the copy
 * keeps his words.
 */
import type { Mcp, PageViewJson } from "./copyedit-lib";
import { evidenceFixOps, listNewClaims, newClaimOps, wikipedia, type ClaimSpec, type EvidenceFix, type SourceSpec } from "./sources-lib";

const SOURCES = {
  hunter: { title: "Disorders Inquiry Committee 1919–1920: Report", origin: { kind: "internet_archive", identifier: "disordersinquiry00unse" } },
  youngindia: { title: "Young India 1919–1922", origin: { kind: "internet_archive", identifier: "in.ernet.dli.2015.211536" } },
  iar1930: { title: "The Indian Annual Register, January–June 1930, vol. I", origin: { kind: "internet_archive", identifier: "HindSwaraj.iar.10973.17740" } },
  ambedkar: { title: "Annihilation of Caste, with a Reply to Mahatma Gandhi", origin: { kind: "internet_archive", identifier: "in.ernet.dli.2015.71655" } },
  wpIna: wikipedia("Indian National Army"),
  wpRowlatt: wikipedia("Rowlatt Act"),
  wpLeague: wikipedia("All-India Muslim League"),
  wpAmbedkar: wikipedia("B. R. Ambedkar"),
  westminster: {
    title: "Statute of Westminster 1931 (22 & 23 Geo. 5 c. 4)",
    origin: { kind: "url", url: "https://en.wikisource.org/wiki/Statute_of_Westminster_1931" },
    create: (snap) => ({
      kind: "other",
      tier: "primary",
      csl: {
        type: "document",
        title: "Statute of Westminster 1931 (22 & 23 Geo. 5 c. 4)",
        issued: { "date-parts": [[1931, 12, 11]] },
        URL: snap.url ?? "https://en.wikisource.org/wiki/Statute_of_Westminster_1931",
      },
      identifiers: { url: "https://www.legislation.gov.uk/ukpga/Geo5/22-23/4/enacted" },
      license: { status: "public_domain", note: "UK Act of 1931: Crown copyright in Acts lasts 50 years from Royal Assent and has expired. Quoted from the Wikisource transcription of the Queen's Printer copy." },
      note: "The Act defining the self-governing Dominions of the British Commonwealth.",
    }),
  },
} satisfies Record<string, SourceSpec>;


const CLAIMS: (ClaimSpec & { excerpts: { source: keyof typeof SOURCES }[] })[] = [
  {
    ref: "c_rowlatt_powers",
    block: "amritsar-claims",
    text: "The Rowlatt Act of 1919 provided for arrests without warrant, indefinite detention without trial, and trials without a jury for political offences; Indians called it the “Black Act”.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The Act's provisions are summarised from an encyclopedia; its text is not quoted here. The Hunter Report records the name “Black Act”, and says the Act was to apply only where revolutionary crime was found.",
    when: { start: { year: 1919, era: "CE", month: 3 } },
    themes: ["governance"],
    entities: [],
    excerpts: [
      { source: "wpRowlatt", quote: "The unpopular legislation provided for stricter control of the press, arrests without warrant, indefinite detention without trial, and juryless in camera trials for proscribed political acts.", locator: { section: "Purpose and introduction" } },
      { source: "hunter", quote: "To them the Rowlatt Act became known as the Black Act, an Act which would seriously curtail their personal and individual freedom.", locator: { label: "Majority report, ch. I (the page number is inferred from the OCR: p. 95)" } },
      {
        source: "hunter",
        quote: "They were not aware that the Act would only be put in operation in districts where anarchical and revolutionary crimes were being perpetrated",
        locator: { label: "Majority report, ch. I (p. 95, inferred)" },
        stance: "qualifies",
        note: "The committee's view of how the Act was meant to be used.",
      },
    ],
  },
  {
    ref: "c_ncm_programme",
    block: "amritsar-claims",
    text: "At a special session in Calcutta in September 1920 the Congress adopted non-co-operation: it advised Indians to give up British titles, withdraw their children from government schools, boycott British courts and the new councils, and boycott foreign goods.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From Rajendra Prasad's account of the movement, written by one of its leaders and published in 1924.",
    when: { start: { year: 1920, era: "CE", month: 9 } },
    themes: ["polity"],
    entities: [
      { entity: "non-cooperation-movement", role: "subject" },
      { entity: "indian-national-congress", role: "participant" },
      { entity: "calcutta", role: "place" },
    ],
    excerpts: [
      { source: "youngindia", quote: "the special session of the Congress which met at Calcutta, early in September, under the presidentship of Lala Lajpat Rai. After a long discussion, the Congress adopted the Non-co-operation resolution by a large majority.", locator: { page: "xxxvii", label: "Rajendra Prasad, sketch of the Non-Co-operation Movement: “The Calcutta Special Congress”" } },
      { source: "youngindia", quote: "Gradual withdrawal of children from schools and colleges owned, aided or controlled by Government, and the establishment of national schools and colleges in their place", locator: { page: "xxxviii", label: "Rajendra Prasad, sketch of the Non-Co-operation Movement" } },
      { source: "youngindia", quote: "Gradual boycott of British Courts by lawyers and litigants, and establishment of private arbitration courts for the settlement of private disputes", locator: { page: "xxxviii", label: "Rajendra Prasad, sketch of the Non-Co-operation Movement" } },
      { source: "youngindia", quote: "Withdrawal by candidates of their candidature from the Reformed Councils and refusal on the part of the voters to vote for any candidate, and (g) Boycott of foreign goods.", locator: { page: "xxxviii", label: "Rajendra Prasad, sketch of the Non-Co-operation Movement" } },
      { source: "youngindia", quote: "It accordingly advised : (a) surrender of titles and honorary offices and resignations from nominated seats in local bodies", locator: { page: "xxxvii", label: "Rajendra Prasad, sketch of the Non-Co-operation Movement" } },
    ],
  },
  {
    ref: "c_cd_authorised",
    block: "c1930-claims",
    text: "In February 1930 the Congress Working Committee, meeting at Ahmedabad, authorised Gandhi and others committed to non-violence to start civil disobedience when they chose.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From the Indian Annual Register's chronicle of the month, written at the time.",
    when: { start: { year: 1930, era: "CE", month: 2 } },
    themes: ["polity"],
    entities: [
      { entity: "indian-national-congress", role: "subject" },
      { entity: "mahatma-gandhi", role: "participant" },
    ],
    excerpts: [
      { source: "iar1930", quote: "Momentous step taken by the Congress Working Committee at Ahmedabad when it decided to launch Civil Disobedience to reach that goal.", locator: { label: "Chronicle of events, February 1930, 15th: “Mahatma authorised Dictator”" } },
      { source: "iar1930", quote: "The resolution authorised Mahatma Gandhi and others believing in non-violence as an article of faith to start Civil Disobedience as and when they decide.", locator: { label: "Chronicle of events, February 1930, 15th" } },
    ],
  },
  {
    ref: "c_league_founded",
    block: "nations-claims",
    text: "The All-India Muslim League was founded at Dacca (Dhaka) in December 1906, at a session of the All-India Muhammadan Educational Conference, as a party for the political interests of India's Muslims.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From an encyclopedia; the League's founding resolution is not yet quoted here.",
    when: { start: { year: 1906, era: "CE", month: 12 } },
    themes: ["polity"],
    entities: [{ entity: "all-india-muslim-league", role: "subject" }],
    excerpts: [
      { source: "wpLeague", quote: "In December 1906, following the successful Simla Deputation in October, the All-India Muslim League was founded in the 20th session of the All-India Muhammadan Educational Conference in Dacca (modern-day Dhaka).", locator: { section: "Lead" } },
      { source: "wpLeague", quote: "The All-India Muslim League (or AIML) was a political party in British India active between 1906 and 1947 that advocated for Muslim interests.", locator: { section: "Lead" } },
    ],
  },
  {
    ref: "c_ambedkar_dalits",
    block: "c1930-claims",
    text: "B. R. Ambedkar was born into the Mahar caste, treated as untouchable, and campaigned for the rights of Dalits; in 1936 Gandhi wrote that what Ambedkar said was voiced by many leaders of the “depressed classes”.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "His caste and campaigns are from an encyclopedia; Gandhi's remark is quoted from his reply to Ambedkar, printed with Annihilation of Caste.",
    themes: ["society"],
    entities: [
      { entity: "b-r-ambedkar", role: "subject" },
      { entity: "mahatma-gandhi", role: "author" },
    ],
    excerpts: [
      { source: "wpAmbedkar", quote: "Ambedkar was born into a Mahar (Dalit) caste, who were treated as untouchables and subjected to socio-economic discrimination.", locator: { section: "Early life and education" } },
      { source: "wpAmbedkar", quote: "advocating political rights and social freedom for Dalits", locator: { section: "Lead" } },
      { source: "ambedkar", quote: "But what he says is voiced with more or less vehemence by many leaders belonging to the depressed classes.", locator: { label: "Gandhi's reply to the address (Harijan, 1936), reprinted in this edition" } },
    ],
  },
  {
    ref: "c_ina_raised",
    block: "war-claims",
    text: "The Indian National Army was formed from Indian soldiers taken prisoner by Japan in Malaya and Singapore; under Bose it also recruited Indians living in South-East Asia, and in 1944 it fought alongside the Japanese army towards Manipur.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From an encyclopedia, which draws on the histories of the INA by Fay and Toye; their words are not yet quoted here.",
    when: { start: { year: 1942, era: "CE" }, end: { year: 1945, era: "CE" } },
    themes: ["war"],
    entities: [
      { entity: "indian-national-army", role: "subject" },
      { entity: "subhas-chandra-bose", role: "participant" },
    ],
    excerpts: [
      { source: "wpIna", quote: "In Japan's spectacular Malayan Campaign many Indian prisoners-of-war were captured, including nearly 45,000 after the fall of Singapore alone.", locator: { label: "History: the first INA, under Mohan Singh" } },
      { source: "wpIna", quote: "From these prisoners, the First Indian National Army was formed under Mohan Singh.", locator: { label: "History: the first INA, under Mohan Singh" } },
      { source: "wpIna", quote: "His appeal re-invigorated the INA, which had previously consisted mainly of prisoners of war: it also attracted Indian expatriates in South Asia.", locator: { section: "Revival" } },
      { source: "wpIna", quote: "During the Japanese U-Go offensive towards Manipur in 1944, the INA played a crucial (and successful) role in diversionary attacks in Arakan and in the Manipur Basin itself, where it fought alongside Mutaguchi's 15th Army.", locator: { section: "Japanese Army" } },
    ],
  },
  {
    ref: "c_ina_trials",
    block: "war-claims",
    text: "Between November 1945 and May 1946 about ten courts-martial of Indian National Army men were held in public at the Red Fort in Delhi.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From an encyclopedia; the trial records are not yet quoted here.",
    when: { start: { year: 1945, era: "CE", month: 11 }, end: { year: 1946, era: "CE", month: 5 } },
    themes: ["polity"],
    entities: [
      { entity: "indian-national-army-trials", role: "subject" },
      { entity: "indian-national-army", role: "participant" },
      { entity: "delhi", role: "place" },
    ],
    excerpts: [
      { source: "wpIna", quote: "Between November 1945 and May 1946, approximately ten courts-martial were held in public at the Red Fort in Delhi.", locator: { section: "Red Fort trials" } },
    ],
  },
  {
    ref: "c_dominions_1931",
    block: "c1947-claims",
    text: "The Statute of Westminster (1931) named the Dominions as Canada, Australia, New Zealand, South Africa, the Irish Free State and Newfoundland.",
    kind: "fact",
    assessment: "supported",
    when: { start: { year: 1931, era: "CE", month: 12, day: 11 } },
    themes: ["polity"],
    entities: [{ entity: "dominion", role: "subject" }],
    excerpts: [
      { source: "westminster", quote: "In this Act the expression “Dominion” means any of the following Dominions, that is to say, the Dominion of Canada, the Commonwealth of Australia. the Dominion of New Zealand, the Union of South Africa, the Irish Free State and Newfoundland.", locator: { section: "1" } },
    ],
  },
];

/** New claims (with their sources) and evidence fixes, in one set of ops. */
export async function independenceNewClaims(mcp: Mcp, view: PageViewJson) {
  const created = await newClaimOps(SOURCES, CLAIMS, mcp, view);
  return { ops: [...created.ops, ...evidenceFixOps(INDEPENDENCE_FIXES, view)], refs: created.refs };
}
export const listIndependenceClaims = listNewClaims(CLAIMS);

/**
 * Evidence fixes after the AI support checks of October 2026
 * (docs/research/2026-10-support-checks.md, table "independence-movement"):
 * quotes that stopped short of the words that carry the claim are extended,
 * and the Government of India's blame is quoted in its own words.
 */
export const INDEPENDENCE_FIXES: EvidenceFix[] = [
  {
    claim: "The disorders of 1919 began with a hartal",
    why: "the date was outside the quote",
    add: [{ like: "The first outbreak occurred in Delhi", quote: "The first outbreak occurred in Delhi on 30th March 1919.", locator: { page: "1", label: "Majority report, chapter I (Delhi), para. 1" } }],
    drop: ["The first outbreak occurred in Delhi"],
  },
  {
    claim: "In Annihilation of Caste (1936)",
    why: "that Ambedkar then published the speech was outside the quote",
    add: [{ like: "The Reception Committee of the Mandal", quote: "To let the public know, them and also to dispose of the printed copies which are lying on my hand, I have decided to put the printed copies of the address on the market.", locator: { page: "ii", label: "Prologue (page inferred)" } }],
  },
  {
    claim: "The Government of India blamed",
    why: "the quote named the review's subject without the accusation; the review's title and the Home Member's words in the Assembly carry it",
    add: [
      { like: "bearing on the responsibility of Mr. Gandhi", quote: "Congress Responsibility for the Disturbances 1942—43 The following statement as a preface was issued by Mr. R. Tottenham, Additional Secretary to the Government of India, Home Department", locator: { page: "176", label: "Title and preface of the review (page inferred)" } },
      { like: "bearing on the responsibility of Mr. Gandhi", quote: "On the basis of all the informations at present available we cannot absolve the Congress from responsibility for these very grave events.", locator: { page: "33", label: "Chronicle of events, 15 September 1942: Sir Reginald Maxwell, Home Member, in the Central Assembly" } },
    ],
  },
  {
    claim: "The 1930 pledge blamed British rule",
    why: "the quote gave the income figure but not the charge that British rule had ruined India",
    add: [
      { like: "Our average income is seven pice", quote: "The British Government in India has not only deprived the Indian people of their freedom but has based itself on the exploitation of the masses, and has ruined India economically.", locator: { page: "334", label: "The Purna Swaraj pledge" } },
      { like: "Our average income is seven pice", quote: "India has been ruined economically. The Revenue derived from our people is out of all proportion to our income. Our average income is seven pice (less than two pence) per day", locator: { page: "334", label: "The Purna Swaraj pledge" } },
    ],
    drop: ["Our average income is seven pice"],
  },
  {
    claim: "On 13 April 1919, at Jallianwala Bagh",
    why: "the date and place were in the paragraph before the quote",
    add: [{ like: "Without giving the crowd any warning", quote: "About 4 o'clock in the afternoon of 13th April, General Dyer received definite information that a meeting was being held at Jallianwala Bagh", locator: { label: "Majority report, chapter III (Amritsar), para. 37" } }],
  },
];
