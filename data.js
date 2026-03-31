// ============================================================
// SLACKADEMICS — Game Data
// Card text from physical cards takes precedence over rulebook.
// Conditions resolve BEFORE leadership skill effects.
// All effort values are for 4 players (1 human + 3 AI).
// ============================================================

const IMG = {
  exam: (n) => `assets/exam/Slide${n}.JPG`,
  skill: (n) => `assets/skills/Slide${n}.JPG`,
  effort: (n) => {
    const map = {
      0: 'Effort 0.jpg', 1: 'Effort 1.jpg', 2: 'Effort 2.jpg',
      3: 'effort 3.jpg', 4: 'Effort 4.jpg', 5: 'effort 5.jpg',
      6: 'Effort 6.jpg', 7: 'Effort 7.jpg', 8: 'Effort 8.jpg',
      'copy': 'Copy.jpg'
    };
    return `assets/other/${map[n]}`;
  },
  other: (name) => `assets/other/${name}`,
};

// ============================================================
// EFFORT CARDS
// Each player starts with: 1,2,3,4,5,6,7,8,copy,copy
// ============================================================
const EFFORT_CARD_TYPES = [
  { id: 'e0',    value: 0, label: 'No Show',      img: IMG.effort(0), isCopy: false },
  { id: 'e1',    value: 1, label: 'Barely Awake', img: IMG.effort(1), isCopy: false },
  { id: 'e2',    value: 2, label: 'Half Baked',   img: IMG.effort(2), isCopy: false },
  { id: 'e3',    value: 3, label: 'Phoning It In',img: IMG.effort(3), isCopy: false },
  { id: 'e4',    value: 4, label: 'Average Effort',img: IMG.effort(4), isCopy: false },
  { id: 'e5',    value: 5, label: 'Solid Grind',  img: IMG.effort(5), isCopy: false },
  { id: 'e6',    value: 6, label: 'Laser Focus',  img: IMG.effort(6), isCopy: false },
  { id: 'e7',    value: 7, label: 'Full Send',    img: IMG.effort(7), isCopy: false },
  { id: 'e8',    value: 8, label: 'Desperation',  img: IMG.effort(8), isCopy: false },
  { id: 'copy',  value: null, label: 'X2 Copy',   img: IMG.effort('copy'), isCopy: true },
];

// Starting hand (10 cards): 1-8 + 2x copy
function makeStartingHand(playerId) {
  const hand = [];
  for (let v = 1; v <= 8; v++) {
    hand.push({ typeId: 'e' + v, value: v, isCopy: false, uid: `${playerId}_e${v}_0` });
  }
  hand.push({ typeId: 'copy', value: null, isCopy: true, uid: `${playerId}_copy_0` });
  hand.push({ typeId: 'copy', value: null, isCopy: true, uid: `${playerId}_copy_1` });
  return hand;
}

// Semester break pairs (each pair sums to 8)
const BREAK_PAIRS = [
  { id: 'pair_0_8',  cards: [0, 8],    label: '0 + 8',       canRepeat: false },
  { id: 'pair_1_7',  cards: [1, 7],    label: '1 + 7',       canRepeat: false },
  { id: 'pair_2_6',  cards: [2, 6],    label: '2 + 6',       canRepeat: false },
  { id: 'pair_3_5',  cards: [3, 5],    label: '3 + 5',       canRepeat: false },
  { id: 'pair_4_c',  cards: [4, 'copy'], label: '4 + X2 Copy', canRepeat: true },
];

// ============================================================
// PROJECT CARDS
// 8 double-sided cards → 16 faces. One face per pair is
// randomly selected at game start.
// Pairs: [slideA, slideB] — both same year group.
// ============================================================

// Condition IDs
const CONDITIONS = {
  NONE: null,
  HARSH_MARKING: {
    id: 'harsh_marking',
    name: 'Harsh Marking',
    desc: 'Any even number played to the effort pile is halved (rounded down).',
    // Applied in calculateEffortTotal before multiplier chain
    apply: (cardValue, isCopy) => {
      if (isCopy) return null; // copies handled separately
      if (cardValue % 2 === 0) return Math.floor(cardValue / 2);
      return cardValue;
    }
  },
  HIGH_STANDARDS: {
    id: 'high_standards',
    name: 'High Standards',
    desc: 'Any card played below 3 counts as 0.',
    apply: (cardValue, isCopy) => {
      if (isCopy) return null;
      return cardValue < 3 ? 0 : cardValue;
    }
  },
  CALCULATOR_BAN: {
    id: 'calculator_ban',
    name: 'Calculator Ban',
    desc: '−1 effort for every duplicate card value in the effort pile.',
    // Applied as post-total penalty; computed in calculateEffortTotal
    apply: null, // handled specially
  },
  PLAGIARISM_DETECTION: {
    id: 'plagiarism_detection',
    name: 'Plagiarism Detection',
    desc: 'X2 Copy cards do not multiply — each provides +3 effort instead.',
    apply: null, // handled in copy logic
  },
};

const PROJECTS = [
  // ── Year 1 ──────────────────────────────────────────────
  {
    id: 'phil_1001', code: 'PHIL 1001', year: 1,
    title: "What is Love?",
    desc: "Write a 1,000-word essay about the ancient philosopher Haddaway's most famous question: \"What is Love?\"",
    effort: 12, condition: CONDITIONS.NONE,
    img: IMG.exam(1),
  },
  {
    id: 'stat_1002', code: 'STAT 1002', year: 1,
    title: "73% of Statistics",
    desc: "Prove statistically that 73% of all statistics are made up on the spot, including this one.",
    effort: 12, condition: CONDITIONS.HARSH_MARKING,
    img: IMG.exam(2),
  },
  {
    id: 'bio_1003', code: 'BIO 1003', year: 1,
    title: "Organ Memorization",
    desc: "Memorize every organ in the human body, then forget them immediately after the final exam.",
    effort: 13, condition: CONDITIONS.NONE,
    img: IMG.exam(3),
  },
  {
    id: 'soc_1004', code: 'SOC 1004', year: 1,
    title: "Group Project in the Wild",
    desc: "Observe a group project in the wild and write a report on how exactly one person ends up doing all the work.",
    effort: 13, condition: CONDITIONS.NONE,
    img: IMG.exam(4),
  },
  // ── Year 2 ──────────────────────────────────────────────
  {
    id: 'csci_2001', code: 'CSCI 2001', year: 2,
    title: "Works Until Demo Day",
    desc: "Write code that works perfectly... until the professor runs it.",
    effort: 14, condition: CONDITIONS.NONE,
    img: IMG.exam(5),
  },
  {
    id: 'mktg_2002', code: 'MKTG 2002', year: 2,
    title: "Campaign for Nothing",
    desc: "Create a marketing campaign convincing people they desperately need something they've lived without for 20 years.",
    effort: 14, condition: CONDITIONS.HIGH_STANDARDS,
    img: IMG.exam(6),
  },
  {
    id: 'hist_2003', code: 'HIST 2003', year: 2,
    title: "Badly Labeled Maps",
    desc: "Explain a historical event entirely through badly labeled maps and vague dates like \"the late 1800s.\"",
    effort: 15, condition: CONDITIONS.NONE,
    img: IMG.exam(7),
  },
  {
    id: 'psyc_2004', code: 'PSYC 2004', year: 2,
    title: "Procrastination Study",
    desc: "Design an experiment proving that procrastination is actually a legitimate time management strategy.",
    effort: 16, condition: CONDITIONS.NONE,
    img: IMG.exam(8),
  },
  // ── Year 3 ──────────────────────────────────────────────
  {
    id: 'musc_3001', code: 'MUSC 3001', year: 3,
    title: "Pachelbel's Canon (Again)",
    desc: "Compose a symphony or just sample Pachelbel's Canon like everybody else does.",
    effort: 17, condition: CONDITIONS.NONE,
    img: IMG.exam(9),
  },
  {
    id: 'econ_3002', code: 'ECON 3002', year: 3,
    title: "Why Do Textbooks Cost $300?",
    desc: "Explain why textbooks cost $300 using supply and demand curves.",
    effort: 17, condition: CONDITIONS.CALCULATOR_BAN,
    img: IMG.exam(10),
  },
  {
    id: 'engl_3003', code: 'ENGL 3003', year: 3,
    title: "Why Were the Curtains Blue",
    desc: "Write 5,000 words analyzing why the curtains were blue (hint: the author liked blue).",
    effort: 18, condition: CONDITIONS.NONE,
    img: IMG.exam(11),
  },
  {
    id: 'chem_3004', code: 'CHEM 3004', year: 3,
    title: "Mildly Alarming Purple",
    desc: "Mix clear liquids together and explain why the result is somehow purple and mildly alarming.",
    effort: 19, condition: CONDITIONS.NONE,
    img: IMG.exam(12),
  },
  // ── Year 4 ──────────────────────────────────────────────
  {
    id: 'busn_4001', code: 'BUSN 4001', year: 4,
    title: "Why Netflix Cancels Good Shows",
    desc: "Analyze why Netflix keeps canceling good shows after one season. Cite your sources.",
    effort: 19, condition: CONDITIONS.PLAGIARISM_DETECTION,
    img: IMG.exam(13),
  },
  {
    id: 'phys_4002', code: 'PHYS 4002', year: 4,
    title: "Dorm Room Entropy",
    desc: "Prove thermodynamics is real by explaining why your dorm room entropy only increases.",
    effort: 20, condition: CONDITIONS.NONE,
    img: IMG.exam(14),
  },
  {
    id: 'art_4003', code: 'ART 4003', year: 4,
    title: "What Does It Really Mean?",
    desc: "Create a piece of art and then write a 3-page explanation of what it really means.",
    effort: 20, condition: CONDITIONS.HIGH_STANDARDS,
    img: IMG.exam(15),
  },
  {
    id: 'engr_4004', code: 'ENGR 4004', year: 4,
    title: "Math Works, Object Does Not",
    desc: "Build a group project where the math works but the physical object absolutely does not.",
    effort: 21, condition: CONDITIONS.NONE,
    img: IMG.exam(16),
  },
];

// Double-sided card pairs: [indexA, indexB] in PROJECTS array
// One face per pair is randomly chosen at game start.
const PROJECT_PAIRS = [
  [0, 1],   // Y1: PHIL 1001 / STAT 1002
  [2, 3],   // Y1: BIO 1003  / SOC 1004
  [4, 5],   // Y2: CSCI 2001 / MKTG 2002
  [6, 7],   // Y2: HIST 2003 / PSYC 2004
  [8, 9],   // Y3: MUSC 3001 / ECON 3002
  [10, 11], // Y3: ENGL 3003 / CHEM 3004
  [12, 13], // Y4: BUSN 4001 / PHYS 4002
  [14, 15], // Y4: ART 4003  / ENGR 4004
];

// ============================================================
// LEADERSHIP SKILLS (card text is authoritative)
// ============================================================

const LEADERSHIP_SKILLS = [
  {
    id: 'diversity',
    name: 'Diversity is Our Strength',
    desc: '+1 effort for each unique card value in the effort pile.',
    img: IMG.skill(1),
    // effect implemented in game.js: applySkill_diversity
  },
  {
    id: 'personal_responsibility',
    name: 'Personal Responsibility',
    desc: 'The Project Leader may swap the final face-down card with a card from their own hand before it is revealed.',
    img: IMG.skill(2),
    // effect: human chooses card from hand to swap in; AI swaps highest available
  },
  {
    id: 'realign_priorities',
    name: 'Realign Priorities',
    desc: 'Pick another player to swap the final face-down effort card with their top Party Pile card.',
    img: IMG.skill(3),
  },
  {
    id: 'pull_all_nighter',
    name: 'Pull an All Nighter',
    desc: 'Double the value of the final face-down effort card.',
    img: IMG.skill(4),
    // Note: card text differs from rulebook. Card is authoritative.
  },
  {
    id: 'round_of_coffee',
    name: 'Round of Coffee',
    desc: 'All effort pile cards with a value of 1, 2, or 3 are doubled.',
    img: IMG.skill(5),
    // Note: card says 1/2/3; rulebook said 1/2. Card is authoritative.
    // Condition applies first: on High Standards, 1 and 2 are already 0.
  },
  {
    id: 'extend_deadline',
    name: 'Extend the Deadline',
    desc: 'Starting with the Project Leader and going clockwise, each player picks up one card from the effort pile. Then in the same order each player plays an effort card face-up from their hand to attempt the project again.',
    img: IMG.skill(6),
  },
  {
    id: 'plagiarize',
    name: 'Plagiarize',
    desc: 'The first X2 Copy card in the effort pile becomes X3.',
    img: IMG.skill(7),
    // Note: card says "first X2 becomes X3"; rulebook said "any". Card authoritative.
    // Conflict: Has no effect during BUSN 4001 (Plagiarism Detection condition).
  },
  {
    id: 'curve_grade',
    name: 'Curve the Grade',
    desc: 'Subtract 6 from the effort required. Increase the effort required of the next Group Project by 6.',
    img: IMG.skill(8),
  },
  {
    id: 'leave_group',
    name: 'Leave the Group',
    desc: 'Discard the two lowest face-up effort cards. Subtract 6 from the effort required.',
    img: IMG.skill(9),
    // Note: card text differs significantly from rulebook. Card is authoritative.
  },
  {
    id: 'match_vibe',
    name: 'Match My Vibe',
    desc: '+5 effort for each pair of matching effort card values in the effort pile.',
    img: IMG.skill(10),
    // New skill — not in rulebook.
  },
  {
    id: 'good_reputation',
    name: 'Good Reputation',
    desc: '+4 effort for each Leadership Skill card currently available to use (not including this one).',
    img: IMG.skill(11),
    // New skill — not in rulebook.
  },
  {
    id: 'accountability',
    name: 'Accountability',
    desc: 'All players reveal their top Party Pile card. The player with the highest card swaps it with the lowest revealed effort card. Ties broken by the Project Leader.',
    img: IMG.skill(12),
    // New skill — not in rulebook.
  },
];

// ============================================================
// CONDITION / SKILL CONFLICT RULES
// (documented here for engine reference)
//
// Rule: Conditions resolve FIRST, then Leadership Skill effects.
//
// Specific interactions:
//   BUSN 4001 (Plagiarism Detection) + Plagiarize:
//     → No X2 multipliers exist; Plagiarize has no effect.
//
//   MKTG 2002 / ART 4003 (High Standards) + Round of Coffee:
//     → Cards 1 & 2 become 0 from condition; doubling 0 = 0.
//     → Card 3 is not below 3, so stays 3, doubled to 6.
//
//   STAT 1002 (Harsh Marking) + Round of Coffee:
//     → Card 2 (even) halved to 1 by condition, then doubled to 2.
//
//   ECON 3002 (Calculator Ban) + Diversity is Our Strength:
//     → Both apply independently. Condition deducts from total;
//       skill adds per unique value. No conflict.
// ============================================================

// ============================================================
// OTHER CARD IMAGES (for UI use)
// ============================================================
const OTHER_IMGS = {
  cardBack:      IMG.other('Card Back Regular.jpg'),
  fail:          IMG.other('Fail.jpg'),
  extraCredit:   IMG.other('Extracredit.jpg'),
  accuse:        IMG.other('Accuse.jpg'),
  blameAccused:  IMG.other('Blame the accused.jpg'),
  blameLeader:   IMG.other('Blame the leader.jpg'),
  projectLeader: IMG.other('Project Leader.jpg'),
  boxArt:        IMG.other('Box Art.jpg'),
};

// ============================================================
// AI PLAYER NAMES
// ============================================================
const AI_NAMES = ['Alex', 'Billie', 'Casey'];

// ============================================================
// EXPORTS
// ============================================================
// BALANCED SNITCHING MODE — Fixed hand, no conditions, effort 11–18
// ============================================================

// Fixed hand every semester: 1,2,3,4,4,5,6,7,X2,X2
function makeBalancedHand(playerId, suffix = '') {
  const hand = [];
  [1, 2, 3, 4, 4, 5, 6, 7].forEach((v, i) => {
    hand.push({ typeId: 'e' + v, value: v, isCopy: false, uid: `${playerId}_b${v}_${i}${suffix}` });
  });
  hand.push({ typeId: 'copy', value: null, isCopy: true, uid: `${playerId}_bcopy_0${suffix}` });
  hand.push({ typeId: 'copy', value: null, isCopy: true, uid: `${playerId}_bcopy_1${suffix}` });
  return hand;
}

// Balanced break pairs — each pair sums to 8, go directly to party pile
const BALANCED_BREAK_PAIRS = [
  { id: 'bp_1_7',  cards: [1, 7],          label: '1 + 7',   canRepeat: false },
  { id: 'bp_2_6',  cards: [2, 6],          label: '2 + 6',   canRepeat: false },
  { id: 'bp_3_5',  cards: [3, 5],          label: '3 + 5',   canRepeat: false },
  { id: 'bp_4_4',  cards: [4, 4],          label: '4 + 4',   canRepeat: false },
  { id: 'bp_cc',   cards: ['copy','copy'],  label: 'X2 + X2', canRepeat: false },
];

// Balanced exam cards — effort values 11–18, no conditions
const BALANCED_PROJECTS = [
  { id: 'bp1', code: 'YEAR 1', title: 'Barely Surviving',   effort: 11, condition: null, img: IMG.exam(1) },
  { id: 'bp2', code: 'YEAR 1', title: 'Finding Your Feet',  effort: 12, condition: null, img: IMG.exam(2) },
  { id: 'bp3', code: 'YEAR 2', title: 'Group Dysfunction',  effort: 13, condition: null, img: IMG.exam(3) },
  { id: 'bp4', code: 'YEAR 2', title: 'Picking Up Speed',   effort: 14, condition: null, img: IMG.exam(4) },
  { id: 'bp5', code: 'YEAR 3', title: 'Mid-Game Grind',     effort: 15, condition: null, img: IMG.exam(5) },
  { id: 'bp6', code: 'YEAR 3', title: 'Under Pressure',     effort: 16, condition: null, img: IMG.exam(6) },
  { id: 'bp7', code: 'YEAR 4', title: 'Final Stretch',      effort: 17, condition: null, img: IMG.exam(7) },
  { id: 'bp8', code: 'YEAR 4', title: 'Graduation Sprint',  effort: 18, condition: null, img: IMG.exam(8) },
];

// ============================================================
if (typeof module !== 'undefined') {
  module.exports = {
    EFFORT_CARD_TYPES, makeStartingHand, makeBalancedHand,
    BREAK_PAIRS, BALANCED_BREAK_PAIRS, BALANCED_PROJECTS,
    CONDITIONS, PROJECTS, PROJECT_PAIRS,
    LEADERSHIP_SKILLS, OTHER_IMGS, AI_NAMES,
  };
}
