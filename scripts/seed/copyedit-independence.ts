/**
 * Copy edits for a first-time reader on /p/independence-movement, proposed
 * THROUGH MCP (machinery in ./copyedit-lib.ts). The Congress, the Muslim
 * League, non-cooperation, civil disobedience, the Viceroy and the INA are
 * introduced where they first appear; “self-government like Britain's
 * colonies” becomes “Britain or its self-governing colonies”; Queen Victoria's promise is
 * worded the right way round; sentences are shortened; and the “Read with
 * care” boxes and claim notes say what an editor's caveat means for the
 * learner. No claim's assertion, citation or quotation changes.
 *
 *   pnpm tsx scripts/seed/copyedit-independence.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit } from "./copyedit-lib";
import { independenceNewClaims, listIndependenceClaims } from "./sources-independence";

await runCopyEdit({
  page: "independence-movement",
  newClaims: independenceNewClaims,
  title: "Independence movement: plainer words for a first-time reader",
  rationale: [
    "A copy edit for readers new to the period, after a review of the page for novice clarity. Parties, campaigns and offices are introduced where they first appear: the Indian National Congress (intro), the Muslim League (Part 6), non-cooperation (Part 4), civil disobedience and the Viceroy (Part 5), the Indian National Army (INA) (Part 7), and the Crown's overlordship of the princes (Part 8).",
    "“Self-government like Britain's colonies” read backwards to a novice (a colony is ruled); Naoroji meant the self-governing colonies, so the prose and the Swaraj glossary entry now say “like that of Britain or its self-governing colonies, inside the Empire”, following Naoroji's words. Queen Victoria's promise now reads as what she owed Indians, not what they owed her. Part 3 no longer implies Naoroji named Swaraj in 1905.",
    "Evidence fixes after the AI support checks of October 2026 (docs/research/2026-10-support-checks.md): quotes that stopped short of the words carrying their claim are extended or joined by a second excerpt (the Delhi hartal's date; Ambedkar's decision to publish the speech; the Government of India's blame, in the review's title and the Home Member's words in the Assembly; the pledge's charge that British rule “ruined India economically”; the date and place of the Jallianwala Bagh meeting, para. 37). Superseded excerpts are withdrawn from these claims.",
    "Eight new claims, with their sources and quoted excerpts, support facts the copy had to leave out for want of a claim (see docs/research/2026-10-copy-needs-sources.md): the Rowlatt Act's powers, what non-co-operation boycotted, the authorisation of civil disobedience in February 1930, the Muslim League's founding in 1906, Ambedkar's caste and campaigns, how the Indian National Army was raised, when its men were tried, and which countries were Dominions. Primary sources are public domain (the Hunter Report, Rajendra Prasad's 1924 sketch in Young India 1919–1922, the Indian Annual Register 1930, the Statute of Westminster, Gandhi's reply to Ambedkar); Wikipedia is tiered as tertiary where it is the only source. The prose now links them.",
    "The “Read with care” boxes and claim notes in Parts 5–8 were editors' to-dos (a typed transcription to check against a 1929 printing, a poor scan, copyright, page-only citations). They now say what that means for how far to trust the words; the citations still show the sources. The debate note in Part 7 no longer ends “Weigh both.” The movement's date reads 1857–1947 CE: both ends are exact.",
  ],
  blocks: [
    {
      block: "often-prose",
      was: ["206e6ed784", "cc5a30fd46"],
      why: "opening continues from the brief",
      set: { markdown: "Each belief below is set against the sources on this page, and is followed by one of the questions historians still argue about." },
    },
    ...listIndependenceClaims,
    {
      block: "intro",
      was: ["6066aee9cb", "5c369b3a33", "49c8ac9c34", "2138d1fb9e"],
      why: "the Congress introduced; Swaraj as the self-governing colonies' self-government; one person per sentence",
      set: {
        markdown: [
          "For about ninety years, from the revolt of 1857 to August 1947, Indians argued, petitioned, marched, boycotted and sometimes fought to end British rule. At first they did not ask for it to end. In 1885 a group of Indians met as the [Indian National Congress](entity:indian-national-congress), [a new national assembly]({c:The first Indian National Congress met}). [Its first meeting professed loyalty to Britain]({c:The first Indian National Congress met}) and asked for a share in government. [By 1906 it wanted Swaraj: self-government like that of Britain or its self-governing colonies, still inside the Empire]({c:Presiding over the Congress in 1906}). [Later it pledged itself to complete independence]({c:On 26 January 1930}).",
          "What makes this story hard is that it has many authors. [Gandhi](entity:mahatma-gandhi) led mass non-violent campaigns. Revolutionaries such as [Bhagat Singh](entity:bhagat-singh) rejected non-violence. [Ambedkar](entity:b-r-ambedkar) asked what freedom meant while caste remained. [Jinnah](entity:muhammad-ali-jinnah) argued that India's Muslims were a separate nation. The sources on this page are their own words, the British government's, and the inquiries each side held, so you can hear them disagree. The movement ended with [two independent countries, India and Pakistan]({c:The Indian Independence Act 1947 set up}), and with [one of the largest forced migrations in history]({c:Partition displaced between}).",
        ].join("\n\n"),
      },
    },
    {
      block: "c1857-prose",
      was: "c8da0540eb",
      why: "Queen Victoria's promise the right way round; shorter sentences; Savarkar introduced",
      set: {
        markdown: [
          "In 1857 much of India was under [Company rule](entity:company-rule). It was governed by a British trading firm, the East India Company. Its army was largely made up of Indian soldiers, called [sepoys](entity:sepoy). In May of that year many of them rose against their officers. [The spark was a rumour about new rifle cartridges]({c:Marx, reporting in 1857}), said to be greased with cow and pig fat, which soldiers had to bite. [Hindu and Muslim soldiers joined together against their officers]({c:Writing as the revolt unfolded}).",
          "After the revolt, [the British Crown](entity:british-raj) took over from the Company. [Queen Victoria promised that Indians would be treated like her other subjects]({c:After the revolt, Queen Victoria's}). Later nationalists would quote that promise back at Britain. What the revolt *was* became an argument at once: [was it a mutiny or a national revolt?]({c:In the House of Commons in July 1857}) In 1909 the nationalist writer [V. D. Savarkar called it India's War of Independence]({c:In 1909 V. D. Savarkar}). This page calls it simply the revolt of 1857.",
        ].join("\n\n"),
      },
    },
    {
      block: "c1857-care",
      was: "3d9a3be3fd",
      set: {
        markdown:
          "Read with care. Savarkar's book shows how nationalists remembered 1857, half a century later. It is not evidence of what happened in it. Marx wrote from London, using newspaper reports.",
      },
    },
    {
      block: "ch-congress",
      was: "2157426880",
      set: { promise: "The first Congress was loyal to Britain. What did it want, and why did one of its leaders say British rule drained India's wealth?" },
    },
    {
      block: "congress-prose",
      was: "3ab3d152b7",
      why: "Bombay's modern name; the councils explained; shorter sentences",
      set: {
        markdown: [
          "In December 1885 a group of Indians met in Bombay (now Mumbai) as the [Indian National Congress](entity:indian-national-congress). [Their president, W. C. Bonnerjee, called it the first national assembly India had ever held]({c:The first Indian National Congress met}). [He assured Britain of their loyalty]({c:The first Indian National Congress met}). They asked for reforms, not freedom: [elected members in the councils that made laws, and civil-service examinations held in India too]({c:The first Congress asked for elected members}).",
          "Their sharpest weapon was economics. [Dadabhai Naoroji](entity:dadabhai-naoroji) argued that [British rule drained India's wealth to Britain]({c:Dadabhai Naoroji argued}), a [drain](entity:drain-of-wealth) he put at tens of millions of pounds a year.",
        ].join("\n\n"),
      },
    },
    {
      block: "swaraj-prose",
      was: ["1a529b73ac", "699d383608", "0516cab377", "1adaa84da9"],
      why: "Naoroji's Swaraj dated 1906, not 1905; the self-governing colonies",
      set: {
        markdown: [
          "In 1905 the British divided the province of [Bengal](entity:partition-of-bengal-1905). Bengalis answered with a boycott. In 1906 [the Congress backed the boycott and swadeshi]({c:At Calcutta in 1906}): [buying Indian-made goods](entity:swadeshi) even when they cost more. That year [Naoroji gave the demand a name, Swaraj]({c:Presiding over the Congress in 1906}). It meant [self-rule](entity:swaraj) like that of Britain or its self-governing colonies, still within the Empire.",
          "In 1909 Gandhi asked what Swaraj should mean. Some Indians, he wrote, [wanted “English rule without the Englishman”]({c:In Hind Swaraj (1909)}): the tiger's nature without the tiger. Britain's own answer came in 1917: [self-government, gradually, inside the Empire]({c:On 20 August 1917}).",
        ].join("\n\n"),
      },
    },
    {
      block: "amritsar-prose",
      was: ["f62c3e2835", "a864294347", "f5b63ed39f"],
      why: "non-cooperation described; one inquiry per sentence",
      set: {
        markdown: [
          "In the spring of 1919 [Gandhi called for a hartal, a shutting of shops]({c:The disorders of 1919 began}). It was a protest against new security laws, the Rowlatt Act, which [allowed detention without trial and trials without a jury]({c:The Rowlatt Act of 1919}). Protests and disorder followed. On 13 April a crowd gathered in the Jallianwala Bagh, a public garden in Amritsar. [General Dyer's troops fired on it without warning, for about ten minutes]({c:On 13 April 1919, at Jallianwala Bagh}).",
          "Even [the official inquiry found that he had committed “a grave error”]({c:The official Hunter Committee}). [The Congress's own inquiry called it calculated inhumanity]({c:The Congress's own inquiry}). [Three Indian members of the official inquiry said the shooting had the opposite effect to the one Dyer wanted]({c:The committee's three Indian members}).",
          "In 1920 the Congress took up the [non-cooperation movement](entity:non-cooperation-movement): [a boycott of British titles, schools, courts and councils, and of foreign goods]({c:At a special session in Calcutta}). It ended abruptly in 1922. [When a crowd at Chauri Chaura burned a police station with the policemen inside, Gandhi called the movement off]({c:In February 1922}).",
        ].join("\n\n"),
      },
    },
    {
      block: "amritsar-care",
      was: "e0eb8413fd",
      set: {
        markdown:
          "Read with care. Each inquiry had a point of view. The Hunter Committee was appointed by the Government of India. The Congress commissioners, Gandhi among them, were the government's opponents. The page shows both.",
      },
    },
    {
      block: "c1930-prose",
      was: ["01907c2bdd", "cfa0a0c7b1", "95a69c2fba", "c1b23d4a9b", "99f6012138", "1d42b5256f"],
      why: "the Viceroy and civil disobedience introduced; Ambedkar introduced; shorter sentences; opening continues from the brief",
      set: {
        markdown: [
          "[The pledge, which meetings across India were to adopt on 26 January 1930]({c:On 26 January 1930}), [blamed British rule for India's poverty, and for an education that had cut Indians off from their own culture]({c:The 1930 pledge blamed}).",
          "Gandhi chose a simple target: the tax on salt. Writing to the Viceroy, the head of the British government in India, [he called it the most unjust tax of all for the poor]({c:Before the Salt March, Gandhi wrote}). [In February 1930 the Congress had authorised him to start civil disobedience]({c:In February 1930 the Congress Working Committee}): breaking unjust laws openly, and accepting the punishment. In March he led a 24-day march from his ashram at Sabarmati to the sea at Dandi, in protest against the government's salt monopoly. [Women took part]({c:Women took part in the salt campaign}): they made salt in villages, against the law, and planned to picket shops selling foreign cloth and liquor.",
          "Not everyone accepted Gandhi's method. [In 1929 Bhagat Singh and B. K. Dutt threw bombs into the Central Legislative Assembly in Delhi]({c:On 8 April 1929}). Their aim, they told the court, was “to make the deaf hear”. [They rejected what they called Utopian non-violence]({c:In their statement Bhagat Singh}). Others asked what freedom was for. [B. R. Ambedkar](entity:b-r-ambedkar), [born into a caste treated as untouchable, campaigned for the rights of Dalits]({c:B. R. Ambedkar was born}). [He argued that caste was a worse tyranny than foreign rule]({c:In Annihilation of Caste}). Without reform within Hindu society, he warned, Swaraj might be only a step towards slavery.",
        ].join("\n\n"),
      },
    },
    {
      block: "c1930-care",
      was: "eaa710d74a",
      why: "an editor's to-do rewritten for the learner",
      set: {
        markdown:
          "Read with care. We have Bhagat Singh and Dutt's statement only as a modern typed copy. It has not yet been checked against a printing of 1929, so treat its exact words as provisional.",
      },
    },
    {
      block: "ch-nations",
      was: "f66bb6f530",
      set: {
        promise:
          "In 1940 the Muslim League asked for separate states, and the Congress answered with one nation. Then, in 1942, the Congress told Britain to “Quit India”.",
      },
    },
    {
      block: "nations-prose",
      was: ["5829c36f5e", "72238d7aae", "24384f27ae"],
      why: "the Muslim League introduced; Quit India named; one appositive per sentence",
      set: {
        markdown: [
          "As independence came closer, Indians disagreed about who the nation was. [Gandhi had written in 1909 that many religions did not stop India being one nation]({c:Gandhi wrote in 1909}). The [Muslim League](entity:all-india-muslim-league), [a party founded in 1906 for the political interests of India's Muslims]({c:The All-India Muslim League was founded}), met at Lahore in March 1940. There [Jinnah](entity:muhammad-ali-jinnah) [told the League that Hindus and Muslims were two civilisations]({c:At Lahore in March 1940}). This became known as the [two-nation theory](entity:two-nation-theory). [The League asked for “independent states” in the Muslim-majority north-west and east]({c:On 23 March 1940}). [Maulana Azad, the Congress president that year, answered that he was proudly Indian]({c:In the same month the Congress president}). Azad was himself a Muslim.",
          "In August 1942, in the middle of the Second World War, [the Congress demanded that British rule end at once]({c:On 8 August 1942}). This was the “Quit India” resolution. Disturbances followed, and [the government blamed Gandhi and the Congress for them]({c:The Government of India blamed}).",
        ].join("\n\n"),
      },
    },
    {
      block: "nations-care",
      was: "4979f5c2be",
      why: "an editor's to-do rewritten for the learner",
      set: {
        markdown:
          "Read with care. We quote the Quit India resolution from an old printed copy that was scanned imperfectly, so a few words may be misread. The blame for the disturbances that followed is the government's own verdict.",
      },
    },
    {
      block: "ch-war",
      was: "ae7807bb09",
      set: { promise: "A famine in Bengal, an Indian army that fought against Britain, and Indian sailors who refused orders." },
    },
    {
      block: "war-prose",
      was: ["0c4b8b493d", "059b417d30", "82fb2938c4", "1885dae182", "9353ef1008"],
      why: "the Indian National Army spelled out with its abbreviation; ratings explained; opening continues from the brief",
      set: {
        markdown: [
          "The Second World War pressed hard on India, above all in Bengal, where [estimates of the famine's dead range widely]({c:In 1943, during the war}). In South-East Asia, [Subhas Chandra Bose](entity:subhas-chandra-bose) led the [Indian National Army (INA)](entity:indian-national-army) against the British. [It was formed from Indian prisoners of war taken by Japan, and fought alongside the Japanese army]({c:The Indian National Army was formed}). [From November 1945 the British tried some of its men at the Red Fort in Delhi]({c:Between November 1945 and May 1946}).",
          "[In February 1946 Indian sailors in Bombay, known in the navy as ratings, refused duty]({c:On 18 February 1946}). Within two days 7,000 had joined the mutiny. Yet [the Congress and the Muslim League helped to stop it]({c:The British government reported}), and [Britain had announced talks on a constitution the day after the mutiny began]({c:On 19 February 1946}).",
        ].join("\n\n"),
      },
    },
    {
      block: "war-debate",
      was: "9e28cd84ed",
      why: "the reasoning spelled out instead of “Weigh both.”",
      set: {
        note: "Britain announced the talks on 19 February 1946, the day after the mutiny began. So the talks were probably planned before the mutiny. They may still have answered the INA trials, which began in November 1945. Historians weigh the two differently.",
      },
    },
    {
      block: "war-care",
      was: "6e78cedcd0",
      why: "an editor's to-do rewritten for the learner",
      set: {
        markdown:
          "Read with care. The famine's toll and the historians' view of the INA trials come from an encyclopedia, not yet from the studies themselves. The naval figures are the British government's own.",
      },
    },
    {
      block: "c1947-prose",
      was: ["83253bfd25", "b3b77a69e4", "f00c3ea2b3"],
      why: "suzerainty paraphrased; one idea per sentence",
      set: {
        markdown: [
          "In February 1947 [Britain gave itself a deadline: power would pass to Indian hands by June 1948 at the latest]({c:On 20 February 1947}). It went faster. [An Act of Parliament created two independent dominions, India and Pakistan, from 15 August 1947]({c:The Indian Independence Act 1947}). [Dominions](entity:dominion) were self-governing countries of the Commonwealth, [such as Canada and Australia]({c:The Statute of Westminster}). The [princely states](entity:princely-state) were ruled by Indian princes under treaties with the Crown, and were not part of British India. [The Act ended Britain's overlordship of the princes, and with it those treaties]({c:Under the 1947 Act}).",
          "The division of the country came at a terrible cost. [Between 12 and 20 million people were displaced, and estimates of the dead run from about 200,000 to 2 million]({c:Partition displaced between}).",
        ].join("\n\n"),
      },
    },
    {
      block: "c1947-care",
      was: "fbce4d60fb",
      why: "an editor's to-do rewritten for the learner",
      set: {
        markdown:
          "Read with care. The Partition figures are wide because no one made a reliable count. They come from an encyclopedia, not yet from the studies themselves.",
      },
    },
  ],
  claims: [
    {
      claim: "The Government of India blamed",
      was: "954e59e96d",
      why: "the review's title names Gandhi; the Home Member's words name the Congress",
      set: { text: "The Government of India blamed the Congress and Gandhi for the disturbances that followed the Quit India resolution." },
    },
    {
      claim: "After the revolt, Queen Victoria's",
      was: "f415278a6e",
      set: {
        assessmentNote:
          "We quote the Queen's words as Dadabhai Naoroji printed them, not yet from the Proclamation itself. The date comes from an encyclopedia.",
      },
    },
    {
      claim: "On 8 April 1929 Bhagat Singh",
      was: "76780738fa",
      set: {
        assessmentNote:
          "We quote the statement from a modern typed copy, not yet checked against a printing of the time. The date comes from an encyclopedia.",
      },
    },
    {
      claim: "On 8 August 1942",
      was: "fc8233c7a0",
      set: { assessmentNote: "We quote the resolution from an old printed copy that was scanned imperfectly, so a few words may be misread." },
    },
    {
      claim: "In 1943, during the war",
      was: "0749960594",
      set: {
        assessmentNote:
          "The range is wide because estimates differ. How far wartime policy caused the famine is debated, and this page does not cover it yet.",
      },
    },
    {
      claim: "Historians including Sumit Sarkar",
      was: "7b195198d1",
      set: {
        assessmentNote: "Reported from an encyclopedia. The historians' books are cited by page, but their own words are not yet quoted here.",
      },
    },
    {
      claim: "Partition displaced between",
      was: "b51a530183",
      set: {
        assessmentNote:
          "The figures are wide because no one made a reliable count. The range of deaths comes from a study by Talbot and Singh (2009), not yet quoted here.",
      },
    },
    {
      claim: "The Indian National Congress demanded independence",
      was: ["c3d519f7b0", "c713af2f90"],
      set: {
        assessmentNote:
          "In 1885 its leaders professed loyalty and asked for a share in government. In 1906 Swaraj meant self-government like that of Britain or its self-governing colonies, inside the Empire. Complete independence became the pledge only in 1930.",
      },
    },
  ],
  entities: [
    {
      entity: "swaraj",
      was: ["09be0cd497", "bddfa2a639"],
      why: "“like Britain's colonies” read backwards",
      set: {
        description:
          "Self-rule. Its meaning grew over time. In 1906 Naoroji used it for self-government like that of Britain or its self-governing colonies, inside the Empire. In 1930 the Congress pledged itself to Purna Swaraj, “complete independence”.",
      },
    },
    {
      entity: "indian-independence-movement",
      was: ["95e5d89e19", "9749ea0c4f"],
      why: "both ends of the span are exact, so no “c.”",
      set: { when: (w: Record<string, unknown>) => ({ ...w, edtf: "1857/1947-08-15", label: "1857–1947 CE" }) },
    },
  ],
  // People named only as the writer or speaker of a claim's source: “Who wrote about it”.
  authors: [
    { claim: "In the House of Commons in July 1857, Disraeli", authors: ["benjamin-disraeli"] },
    { claim: "Marx, reporting in 1857", authors: ["karl-marx"] },
    { claim: "Writing as the revolt unfolded, Marx", authors: ["karl-marx"] },
    { claim: "In 1909 V. D. Savarkar", authors: ["v-d-savarkar"] },
    { claim: "After the revolt, Queen Victoria's", authors: ["dadabhai-naoroji"] },
    { claim: "On 18 February 1946 Indian ratings", authors: ["clement-attlee"] },
  ],
});
