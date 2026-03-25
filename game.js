// ============================================================
// SLACKADEMICS — Game Engine
// ============================================================

'use strict';

// ── Constants ───────────────────────────────────────────────

const PHASES = {
  SETUP:             'SETUP',
  SEMESTER_START:    'SEMESTER_START',
  SPEECH:            'SPEECH',
  CARD_SELECTION:    'CARD_SELECTION',
  REVEAL:            'REVEAL',
  DAY_OF_DEADLINE:   'DAY_OF_DEADLINE',
  OUTCOME_PASS:      'OUTCOME_PASS',
  NOMINATE:          'NOMINATE',         // PL nominates extra credit recipient
  OUTCOME_FAIL:      'OUTCOME_FAIL',
  BLAME_VOTE:        'BLAME_VOTE',
  VOTE_RESULT:       'VOTE_RESULT',
  SNITCH:            'SNITCH',
  END_OF_SEMESTER:   'END_OF_SEMESTER',
  SEMESTER_BREAK:    'SEMESTER_BREAK',
  BREAK_DRAW:        'BREAK_DRAW',
  GAME_OVER:         'GAME_OVER',
};

const NUM_PLAYERS = 4;
const NUM_SEMESTERS = 8;
const MAX_FAILS = 3;
const EXTRA_CREDIT_POINTS = 3;

// ── Utility ─────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ── Effort Calculation ──────────────────────────────────────

/**
 * Calculate the total effort from a pile of cards, applying:
 *   1. Project condition (first)
 *   2. X2 Copy multiplier chain
 *   3. Post-total condition penalties (Calculator Ban)
 *   4. Leadership skill modifier (if provided)
 *
 * @param {Array}  pile      Array of card objects {value, isCopy, uid}
 * @param {Object} condition The project condition or null
 * @param {Object} [skill]   Optional skill modifier applied after conditions
 * @returns {number} Final effort total
 */
function calculateEffortTotal(pile, condition, skill = null) {
  if (!pile || pile.length === 0) return 0;

  const condId = condition ? condition.id : null;
  const plagDetect = condId === 'plagiarism_detection';

  // Step 1: Apply per-card conditions and build processed pile
  const processed = pile.map(card => {
    if (card.isCopy) {
      // Plagiarism Detection: copy becomes flat +3
      if (plagDetect) return { value: 3, isCopy: false, originalCopy: true, uid: card.uid };
      return { ...card };
    }
    let v = card.value;
    if (condId === 'harsh_marking' && v % 2 === 0) v = Math.floor(v / 2);
    if (condId === 'high_standards' && v < 3) v = 0;
    return { ...card, value: v };
  });

  // Step 2: Apply skill modifiers that mutate the pile (before summing)
  let skillBonus = 0;
  let plagiarizeApplied = false;

  if (skill) {
    switch (skill.id) {
      case 'round_of_coffee':
        processed.forEach(c => {
          if (!c.isCopy && c.value >= 1 && c.value <= 3) c.value *= 2;
        });
        break;

      case 'leave_group': {
        // Discard the two lowest FACE-UP (non-copy, non-last) cards
        // In the engine, all revealed cards are "face up" except the final one
        const nonCopies = processed.filter(c => !c.isCopy);
        nonCopies.sort((a, b) => a.value - b.value);
        const toDiscard = new Set(nonCopies.slice(0, 2).map(c => c.uid));
        for (let i = processed.length - 1; i >= 0; i--) {
          if (toDiscard.has(processed[i].uid)) processed.splice(i, 1);
        }
        break;
      }

      case 'pull_all_nighter':
        // Double the final card (the last one in the pile)
        if (processed.length > 0) {
          const last = processed[processed.length - 1];
          if (!last.isCopy) last.value *= 2;
          else if (!plagDetect) last._doubleMultiplier = 2; // handled in chain
        }
        break;

      case 'plagiarize':
        // First X2 copy becomes X3 (only if not Plagiarism Detection)
        if (!plagDetect) plagiarizeApplied = true;
        break;

      case 'diversity':
        // Count unique values after condition
        {
          const vals = new Set(processed.filter(c => !c.isCopy).map(c => c.value));
          skillBonus = vals.size;
        }
        break;

      case 'match_vibe':
        // +5 for each pair of matching values
        {
          const freq = {};
          processed.filter(c => !c.isCopy).forEach(c => {
            freq[c.value] = (freq[c.value] || 0) + 1;
          });
          Object.values(freq).forEach(count => {
            skillBonus += Math.floor(count / 2) * 5;
          });
        }
        break;

      // good_reputation, personal_responsibility, realign_priorities,
      // extend_deadline, curve_grade, accountability:
      // These are handled at the phase level before calculateEffortTotal is called.
      default:
        break;
    }
  }

  // Step 3: X2 Copy multiplier chain (with optional Plagiarize upgrade)
  let total = 0;
  let multiplier = 1;
  let firstCopyFound = false;

  for (let i = 0; i < processed.length; i++) {
    const card = processed[i];
    const isLast = (i === processed.length - 1);

    if (card.isCopy && !plagDetect) {
      // Determine copy multiplier
      let copyMult = 2;
      if (plagiarizeApplied && !firstCopyFound) {
        copyMult = 3;
        firstCopyFound = true;
      }
      if (card._doubleMultiplier) copyMult *= card._doubleMultiplier;

      if (isLast) {
        // Last card is a copy → contributes flat 7
        total += 7 * multiplier;
      } else {
        multiplier *= copyMult;
      }
    } else {
      // Normal card (or copy treated as +3 under plagiarism detection)
      total += card.value * multiplier;
      multiplier = 1;
    }
  }

  // Step 4: Calculator Ban post-total penalty
  if (condId === 'calculator_ban') {
    const freq = {};
    processed.filter(c => !c.isCopy).forEach(c => {
      freq[c.value] = (freq[c.value] || 0) + 1;
    });
    Object.values(freq).forEach(count => {
      if (count > 1) total -= (count - 1);
    });
  }

  return total + skillBonus;
}

// ── Game State ───────────────────────────────────────────────

class GameState {
  constructor() {
    this.phase = PHASES.SETUP;
    this.semester = 0;
    this.log = []; // narrative log entries

    // Player state (index 0 = human, 1-3 = AI)
    this.playerNames = ['You', ...AI_NAMES];
    this.hands = [[], [], [], []];
    this.partyPiles = [[], [], [], []]; // top = last element
    this.fails = [0, 0, 0, 0];
    this.extraCredits = [[], [], [], []];
    this.expelled = [false, false, false, false];
    this.takenBreakPairs = [[], [], [], []]; // pair ids taken per player

    // Project state
    this.projectDeck = [];     // ordered array of project objects
    this.currentProject = null;
    this.curveCarryover = 0;   // extra effort from Curve the Grade

    // Semester effort state
    this.effortPile = [];      // { card, playedBy } — shuffled, playedBy hidden until snitch
    this.effortPileRevealed = []; // cards revealed so far
    this.effortRequired = 0;   // adjusted for player count + curveCarryover
    this.effortRemaining = 0;  // tracks during reveal

    // Leadership skills
    this.skillDeck = [];
    this.skillsAvailable = []; // up to 2 face-up

    // Turn / voting state
    this.projectLeaderIndex = 0;
    this.accusedIndex = -1;
    this.votes = [-1, -1, -1, -1]; // 0=blame accused, 1=blame leader, -1=not voting
    this.cardsPlayedThisSemester = [null, null, null, null]; // effort card chosen
    this.partyCardsPlayedThisSemester = [null, null, null, null];

    // Snitch state
    this.snitchChain = []; // [{player, card}]
    this.snitchActive = false;
    this.snitchInitiator = -1;
    this.currentSnitchPlayer = -1;
    this.playersWhoTookFailThisSemester = [];
    this.pendingFails = []; // accumulate before discard

    // Nomination (extra credit after pass)
    this.nominationPending = false;

    // Extend Deadline state
    this.extendDeadlineActive = false;
    this.extendPickupOrder = [];
    this.extendPickedUp = [];
    this.extendPlayed = [];

    // Accountability state
    this.accountabilityRevealedCards = [];
  }

  emit(msg) {
    this.log.push(msg);
    if (typeof onLogMessage === 'function') onLogMessage(msg);
  }
}

// ── AI Logic ────────────────────────────────────────────────

/**
 * AI personality types assigned at game start.
 * 'slacker': prefers low effort cards in the project pile
 * 'tryhard': prefers high effort cards
 * 'balanced': roughly equal
 */
const AI_PERSONALITIES = ['slacker', 'balanced', 'tryhard'];

function aiChooseEffortCard(state, playerIndex) {
  const hand = state.hands[playerIndex];
  if (hand.length === 0) return null;
  if (hand.length === 1) return hand[0];

  const personality = state.aiPersonalities[playerIndex];
  const effortNeeded = state.effortRequired;
  const avgNeeded = Math.ceil(effortNeeded / NUM_PLAYERS);

  // Ensure player keeps at least 1 card for party pile
  const candidates = hand.length > 1 ? hand : hand.slice(0, 1);

  // Sort by value (copies count as ~5 for scoring purposes)
  const valued = candidates.map(c => ({ c, v: c.isCopy ? 5 : c.value }));

  switch (personality) {
    case 'slacker':
      // Play the lowest card, keep high ones for party pile
      valued.sort((a, b) => a.v - b.v);
      break;
    case 'tryhard':
      // Play a card near the average needed, keep copies
      valued.sort((a, b) => {
        const da = Math.abs(a.v - avgNeeded);
        const db = Math.abs(b.v - avgNeeded);
        return da - db;
      });
      break;
    case 'balanced':
    default:
      // Mix: slight bias toward lower effort
      valued.sort((a, b) => a.v - b.v);
      // Pick from lower half with 70% probability
      if (Math.random() < 0.7) {
        valued.splice(Math.ceil(valued.length / 2));
      }
      break;
  }

  return valued[0].c;
}

function aiChoosePartyCard(hand, effortCard) {
  // Play the highest non-copy remaining card to party pile, or copy if nothing else
  const remaining = hand.filter(c => c.uid !== effortCard.uid);
  if (remaining.length === 0) return null;
  const nonCopies = remaining.filter(c => !c.isCopy);
  if (nonCopies.length > 0) {
    return nonCopies.reduce((best, c) => c.value > best.value ? c : best);
  }
  return remaining[0];
}

function aiChooseSkill(state) {
  if (state.skillsAvailable.length === 0) return null;

  const pileTotal = calculateEffortTotal(state.effortPile, state.currentProject.condition);
  const deficit = state.effortRemaining - pileTotal; // how short we are (can be negative)

  // If already passing, don't use a skill
  if (deficit <= 0) return null;

  // Prefer skill based on deficit size
  const skills = state.skillsAvailable;
  const byId = {};
  skills.forEach(s => { byId[s.id] = s; });

  if (deficit <= 6 && byId['leave_group']) return byId['leave_group'];
  if (deficit <= 6 && byId['curve_grade']) return byId['curve_grade'];
  if (byId['pull_all_nighter']) return byId['pull_all_nighter'];
  if (byId['round_of_coffee']) return byId['round_of_coffee'];
  if (byId['diversity']) return byId['diversity'];
  if (byId['match_vibe']) return byId['match_vibe'];
  if (byId['good_reputation']) return byId['good_reputation'];
  if (byId['plagiarize'] && state.currentProject.condition?.id !== 'plagiarism_detection') {
    return byId['plagiarize'];
  }

  // Fallback: first available
  return skills[0];
}

function aiBlamevote(state, voterIndex) {
  // Vote for the player with the highest visible top party pile card
  // (highest card = probably played lowest effort)
  // Cannot vote for self, project leader, or accused
  const pl = state.projectLeaderIndex;
  const accused = state.accusedIndex;
  const candidates = [0, 1, 2, 3].filter(
    i => i !== voterIndex && i !== pl && i !== accused && !state.expelled[i]
  );

  if (candidates.length === 0) {
    // Only choice: vote for accused
    return 0; // blame accused
  }

  // Check who has highest revealed party top card
  let bestCandidate = null;
  let bestVal = -1;
  candidates.forEach(i => {
    const pile = state.partyPiles[i];
    if (pile.length > 0) {
      const top = pile[pile.length - 1];
      const v = top.isCopy ? 0 : top.value; // copies score 0 in party pile
      if (v > bestVal) { bestVal = v; bestCandidate = i; }
    }
  });

  // If accused has highest card, vote for accused (id=0); else vote for leader (id=1)
  // (simple heuristic: mostly vote accused to pile on)
  if (Math.random() < 0.65) return 0; // blame accused
  return 1; // blame leader
}

function aiShouldSnitch(state, playerIndex) {
  const pile = state.partyPiles[playerIndex];
  if (pile.length === 0) return false;
  const myTop = pile[pile.length - 1];
  const myVal = myTop.isCopy ? 0 : myTop.value;

  // Estimate average top card of other active players
  const others = [0, 1, 2, 3].filter(
    i => i !== playerIndex && !state.expelled[i] && state.partyPiles[i].length > 0
  );
  if (others.length === 0) return false;
  const avgOther = others.reduce((sum, i) => {
    const top = state.partyPiles[i][state.partyPiles[i].length - 1];
    return sum + (top.isCopy ? 0 : top.value);
  }, 0) / others.length;

  // Snitch if my card is below average (likely to succeed)
  return myVal < avgOther;
}

function aiChooseSnitchTarget(state, snitcherIndex) {
  // Target the player with the highest estimated top party card
  const others = [0, 1, 2, 3].filter(
    i => i !== snitcherIndex && !state.expelled[i] && state.partyPiles[i].length > 0
  );
  if (others.length === 0) return -1;
  let best = others[0];
  let bestVal = -1;
  others.forEach(i => {
    const top = state.partyPiles[i][state.partyPiles[i].length - 1];
    const v = top.isCopy ? 0 : top.value;
    if (v > bestVal) { bestVal = v; best = i; }
  });
  return best;
}

// ── Game Controller ─────────────────────────────────────────

class Game {
  constructor(onStateChange) {
    this.state = new GameState();
    this.onStateChange = onStateChange || (() => {});
    this._pendingAiDelay = null;
  }

  _change() {
    this.onStateChange(this.state);
  }

  // Build and shuffle the project deck
  _buildProjectDeck() {
    const chosen = PROJECT_PAIRS.map(([a, b]) => {
      return Math.random() < 0.5 ? PROJECTS[a] : PROJECTS[b];
    });
    return chosen; // already in year order
  }

  _buildSkillDeck() {
    return shuffle([...LEADERSHIP_SKILLS]);
  }

  _drawSkills(state) {
    while (state.skillsAvailable.length < 2 && state.skillDeck.length > 0) {
      state.skillsAvailable.push(state.skillDeck.shift());
    }
  }

  // ── Setup ────────────────────────────────────────────────

  start() {
    const s = this.state;
    s.phase = PHASES.SETUP;
    s.semester = 0;
    s.projectDeck = this._buildProjectDeck();
    s.skillDeck = this._buildSkillDeck();
    s.skillsAvailable = [];
    this._drawSkills(s);
    this._drawSkills(s); // draw up to 2

    // Assign AI personalities
    const perms = shuffle([...AI_PERSONALITIES]);
    s.aiPersonalities = [null, perms[0], perms[1], perms[2]];

    // Deal hands
    for (let i = 0; i < NUM_PLAYERS; i++) {
      s.hands[i] = makeStartingHand(i);
      s.partyPiles[i] = [];
      s.fails[i] = 0;
      s.extraCredits[i] = [];
      s.expelled[i] = false;
      s.takenBreakPairs[i] = [];
    }

    // Randomly choose first project leader
    s.projectLeaderIndex = randInt(0, NUM_PLAYERS - 1);
    s.plRotationCount = 0; // how many full rotations done

    s.emit('Welcome to Slackademics! ' + s.playerNames[s.projectLeaderIndex] + ' is the first Project Leader.');
    this.advanceToSemesterStart();
  }

  advanceToSemesterStart() {
    const s = this.state;
    s.semester++;

    if (s.semester > NUM_SEMESTERS) {
      this.endGame();
      return;
    }

    // Check for enough active players
    const active = [0,1,2,3].filter(i => !s.expelled[i]);
    if (active.length <= 2) {
      // Add remaining hand cards to party pile
      active.forEach(i => {
        const keep = Math.ceil(s.hands[i].length / 2);
        s.partyPiles[i].push(...s.hands[i].slice(0, keep));
        s.hands[i] = [];
      });
      this.endGame();
      return;
    }

    // Ensure PL is not expelled
    while (s.expelled[s.projectLeaderIndex]) {
      s.projectLeaderIndex = (s.projectLeaderIndex + 1) % NUM_PLAYERS;
    }

    // Draw project
    s.currentProject = s.projectDeck[s.semester - 1];
    s.effortRequired = s.currentProject.effort + s.curveCarryover;
    s.curveCarryover = 0;
    s.effortPile = [];
    s.effortPileRevealed = [];
    s.effortRemaining = s.effortRequired;
    s.cardsPlayedThisSemester = [null, null, null, null];
    s.partyCardsPlayedThisSemester = [null, null, null, null];
    s.playersWhoTookFailThisSemester = [];
    s.pendingFails = [];
    s.snitchChain = [];
    s.snitchActive = false;
    s.nominationPending = false;

    s.phase = PHASES.SEMESTER_START;
    s.emit(`Semester ${s.semester}: ${s.currentProject.code} — ${s.currentProject.title}. Effort required: ${s.effortRequired}.`);
    if (s.currentProject.condition) {
      s.emit(`Assignment Condition: ${s.currentProject.condition.name} — ${s.currentProject.condition.desc}`);
    }
    this._change();
    this._scheduleAI();
  }

  _scheduleAI(delay = 800) {
    if (this._pendingAiDelay) clearTimeout(this._pendingAiDelay);
    this._pendingAiDelay = setTimeout(() => this._tickAI(), delay);
  }

  _tickAI() {
    const s = this.state;
    const pl = s.projectLeaderIndex;
    const isHumanPL = pl === 0;

    switch (s.phase) {
      case PHASES.SEMESTER_START:
        // Auto-advance to speech
        s.phase = PHASES.SPEECH;
        s.emit(`${s.playerNames[pl]} gives the Motivational Speech.`);
        this._change();
        if (!isHumanPL) this._scheduleAI(1200);
        break;

      case PHASES.SPEECH:
        // AI PL auto-advances; human PL waits for click
        if (!isHumanPL) {
          this.advanceToCardSelection();
        }
        break;

      case PHASES.CARD_SELECTION:
        // AI players select their cards
        this._aiSelectCards();
        break;

      case PHASES.DAY_OF_DEADLINE:
        if (!isHumanPL) {
          this._aiDayOfDeadline();
        }
        break;

      case PHASES.BLAME_VOTE:
        this._aiVote();
        break;

      case PHASES.SNITCH:
        if (s.currentSnitchPlayer !== 0) {
          this._aiSnitch();
        }
        break;

      case PHASES.NOMINATE:
        if (!isHumanPL) {
          // AI nominates player with lowest top party card (most deserving)
          const candidates = [0,1,2,3].filter(i => i !== pl && !s.expelled[i]);
          if (candidates.length > 0) {
            const pick = candidates.reduce((best, i) => {
              if (s.partyPiles[i].length === 0) return best;
              const top = s.partyPiles[i][s.partyPiles[i].length - 1];
              const topBest = s.partyPiles[best][s.partyPiles[best].length - 1];
              const tv = top ? (top.isCopy ? 0 : top.value) : 0;
              const bv = topBest ? (topBest.isCopy ? 0 : topBest.value) : 0;
              return tv < bv ? i : best;
            }, candidates[0]);
            this.nominateForExtraCredit(pick);
          }
        }
        break;

      case PHASES.SEMESTER_BREAK:
        // All AI players draw break pairs; human draws manually
        this._aiBreakDraw();
        break;
    }
  }

  // ── Card Selection ───────────────────────────────────────

  advanceToCardSelection() {
    const s = this.state;
    s.phase = PHASES.CARD_SELECTION;
    s.emit('Players are choosing their cards...');
    this._change();
    this._scheduleAI(400);
  }

  _aiSelectCards() {
    const s = this.state;
    let anyPending = false;

    for (let i = 1; i < NUM_PLAYERS; i++) {
      if (s.expelled[i]) continue;
      if (s.cardsPlayedThisSemester[i] !== null) continue; // already chosen

      const effortCard = aiChooseEffortCard(s, i);
      if (!effortCard) continue;

      const partyCard = aiChoosePartyCard(s.hands[i], effortCard);
      if (!partyCard) continue;

      s.cardsPlayedThisSemester[i] = effortCard;
      s.partyCardsPlayedThisSemester[i] = partyCard;

      // Remove from hand
      s.hands[i] = s.hands[i].filter(c => c.uid !== effortCard.uid && c.uid !== partyCard.uid);
      anyPending = false;
    }

    // Check if human has played
    if (s.cardsPlayedThisSemester[0] !== null || s.expelled[0]) {
      this._finalizeCardSelection();
    } else {
      this._change(); // update UI to show AI has chosen
    }
  }

  // Called by UI when human selects their effort + party card
  humanPlayCards(effortCard, partyCard) {
    const s = this.state;
    if (s.phase !== PHASES.CARD_SELECTION) return;
    if (s.expelled[0]) {
      s.cardsPlayedThisSemester[0] = { value: 0, isCopy: false, uid: 'expelled_0' };
      this._finalizeCardSelection();
      return;
    }

    s.cardsPlayedThisSemester[0] = effortCard;
    s.partyCardsPlayedThisSemester[0] = partyCard;
    s.hands[0] = s.hands[0].filter(c => c.uid !== effortCard.uid && c.uid !== partyCard.uid);

    // Place party cards
    for (let i = 0; i < NUM_PLAYERS; i++) {
      if (s.partyCardsPlayedThisSemester[i]) {
        s.partyPiles[i].push(s.partyCardsPlayedThisSemester[i]);
      }
    }

    this._finalizeCardSelection();
  }

  _finalizeCardSelection() {
    const s = this.state;

    // Place party cards on top of piles (if not already done)
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const pc = s.partyCardsPlayedThisSemester[i];
      if (pc && !s.partyPiles[i].find(c => c.uid === pc.uid)) {
        s.partyPiles[i].push(pc);
      }
    }

    // Build effort pile from non-expelled players
    const pile = [];
    for (let i = 0; i < NUM_PLAYERS; i++) {
      if (!s.expelled[i] && s.cardsPlayedThisSemester[i]) {
        pile.push({ card: s.cardsPlayedThisSemester[i], playedBy: i });
      }
    }
    s.effortPile = shuffle(pile);
    s.effortPileRevealed = [];
    s.effortRemaining = s.effortRequired;

    s.phase = PHASES.REVEAL;
    s.emit('Cards are in. The Project Leader begins the reveal...');
    this._change();
  }

  // ── Reveal ───────────────────────────────────────────────

  // Called by UI (or auto) to reveal next card
  revealNextCard() {
    const s = this.state;
    if (s.phase !== PHASES.REVEAL) return;

    // Reveal all but the last
    if (s.effortPileRevealed.length < s.effortPile.length - 1) {
      const entry = s.effortPile[s.effortPileRevealed.length];
      s.effortPileRevealed.push(entry);
      const v = entry.card.isCopy ? 'X2 Copy' : entry.card.value;
      s.emit(`Revealed: ${v}`);
      // Update effort remaining (approximate — final calc after all revealed)
      const revealedCards = s.effortPileRevealed.map(e => e.card);
      s.effortRemaining = s.effortRequired - calculateEffortTotal(revealedCards, s.currentProject.condition);
      this._change();
    } else {
      // All but last revealed — move to Day of Deadline
      s.phase = PHASES.DAY_OF_DEADLINE;
      s.emit(`Day of the Deadline! One card remains. Effort still needed: ${Math.max(0, s.effortRemaining)}.`);
      this._change();
      if (s.projectLeaderIndex !== 0) this._scheduleAI(1000);
    }
  }

  // ── Day of Deadline ──────────────────────────────────────

  letItRide() {
    const s = this.state;
    if (s.phase !== PHASES.DAY_OF_DEADLINE) return;

    // Reveal final card
    const lastEntry = s.effortPile[s.effortPile.length - 1];
    s.effortPileRevealed.push(lastEntry);
    const v = lastEntry.card.isCopy ? 'X2 Copy' : lastEntry.card.value;
    s.emit(`Final card revealed: ${v}!`);

    const allCards = s.effortPileRevealed.map(e => e.card);
    const total = calculateEffortTotal(allCards, s.currentProject.condition);
    s.emit(`Total effort: ${total}. Required: ${s.effortRequired}.`);

    if (total >= s.effortRequired) {
      s.emit('Project PASSED via Let It Ride!');
      s.phase = PHASES.OUTCOME_PASS;
      this._grantPassExtraCredit(true);
    } else {
      s.emit('Project FAILED! Not enough effort.');
      s.phase = PHASES.OUTCOME_FAIL;
      this._change();
      this._scheduleAI(800);
    }
  }

  useSkill(skill) {
    const s = this.state;
    if (s.phase !== PHASES.DAY_OF_DEADLINE) return;
    if (!s.skillsAvailable.find(sk => sk.id === skill.id)) return;

    s.emit(`${s.playerNames[s.projectLeaderIndex]} uses Leadership Skill: ${skill.name}!`);
    s.skillsAvailable = s.skillsAvailable.filter(sk => sk.id !== skill.id);
    // Used skill goes to bottom of deck
    s.skillDeck.push(skill);

    // Handle skills that require phase-level interaction
    switch (skill.id) {
      case 'personal_responsibility':
        s.pendingSkill = skill;
        if (s.projectLeaderIndex === 0) {
          // Human PL: show card selection UI
          s.phase = 'SKILL_PERSONAL_RESP';
          this._change();
          return;
        } else {
          // AI: swap with best card in hand
          const hand = s.hands[s.projectLeaderIndex];
          if (hand.length > 0) {
            const best = hand.reduce((b, c) => {
              const bv = b.isCopy ? 5 : b.value;
              const cv = c.isCopy ? 5 : c.value;
              return cv > bv ? c : b;
            }, hand[0]);
            const lastIdx = s.effortPile.length - 1;
            const swapped = s.effortPile[lastIdx].card;
            s.effortPile[lastIdx] = { card: best, playedBy: s.projectLeaderIndex };
            s.hands[s.projectLeaderIndex] = hand.filter(c => c.uid !== best.uid);
            s.hands[s.projectLeaderIndex].push(swapped);
            s.emit(`${s.playerNames[s.projectLeaderIndex]} swaps the final card from their hand.`);
          }
        }
        break;

      case 'realign_priorities': {
        // Pick another player to swap final card with their top party card
        if (s.projectLeaderIndex === 0) {
          s.pendingSkill = skill;
          s.phase = 'SKILL_REALIGN';
          this._change();
          return;
        } else {
          // AI: pick player with highest top party card
          const candidates = [0,1,2,3].filter(i => i !== s.projectLeaderIndex && !s.expelled[i] && s.partyPiles[i].length > 0);
          if (candidates.length > 0) {
            const target = candidates.reduce((best, i) => {
              const bt = s.partyPiles[best][s.partyPiles[best].length - 1];
              const it = s.partyPiles[i][s.partyPiles[i].length - 1];
              const bv = bt ? (bt.isCopy ? 0 : bt.value) : 0;
              const iv = it ? (it.isCopy ? 0 : it.value) : 0;
              return iv > bv ? i : best;
            }, candidates[0]);
            this._executeRealign(target);
          }
        }
        break;
      }

      case 'extend_deadline': {
        const active = [0,1,2,3].filter(i => !s.expelled[i]);
        const plIdx = active.indexOf(s.projectLeaderIndex);
        s.extendPickupOrder = [...active.slice(plIdx), ...active.slice(0, plIdx)];
        s.extendPickedUp = [];
        s.extendPlayed = [];
        s.extendDeadlineActive = true;
        s.phase = 'SKILL_EXTEND';
        s.emit('Extend the Deadline! Players pick up their effort cards...');
        this._change();
        this._scheduleAI(600);
        return;
      }

      case 'accountability': {
        // Reveal all top party cards
        s.accountabilityRevealedCards = [0,1,2,3].map(i => {
          const pile = s.partyPiles[i];
          return pile.length > 0 ? { playerIndex: i, card: pile[pile.length - 1] } : null;
        }).filter(Boolean);
        s.phase = 'SKILL_ACCOUNTABILITY';
        this._change();
        if (s.projectLeaderIndex !== 0) this._scheduleAI(800);
        return;
      }

      case 'curve_grade':
        s.curveCarryover = 6;
        s.effortRequired = Math.max(0, s.effortRequired - 6);
        s.effortRemaining = Math.max(0, s.effortRemaining - 6);
        s.emit(`Curve the Grade! Effort required reduced to ${s.effortRequired}. Next project +6.`);
        break;

      default:
        // All other skills are handled in calculateEffortTotal
        s.pendingSkill = skill;
        break;
    }

    // After skill applied, resolve the final card
    this._resolveWithSkill(skill);
  }

  _executeRealign(targetPlayerIndex) {
    const s = this.state;
    const lastIdx = s.effortPile.length - 1;
    const finalCard = s.effortPile[lastIdx].card;
    const topParty = s.partyPiles[targetPlayerIndex].pop();
    s.effortPile[lastIdx] = { card: topParty, playedBy: targetPlayerIndex };
    // Return effort card to player's hand (as per rulebook spirit)
    s.hands[targetPlayerIndex].push(finalCard);
    s.emit(`${s.playerNames[targetPlayerIndex]}'s top party card (${topParty.isCopy ? 'X2 Copy' : topParty.value}) swapped into effort pile.`);
    this._resolveWithSkill(s.pendingSkill || { id: 'realign_priorities' });
  }

  humanRealign(targetPlayerIndex) {
    if (this.state.phase !== 'SKILL_REALIGN') return;
    this._executeRealign(targetPlayerIndex);
  }

  humanPersonalResp(card) {
    const s = this.state;
    if (s.phase !== 'SKILL_PERSONAL_RESP') return;
    const lastIdx = s.effortPile.length - 1;
    const swapped = s.effortPile[lastIdx].card;
    s.effortPile[lastIdx] = { card, playedBy: 0 };
    s.hands[0] = s.hands[0].filter(c => c.uid !== card.uid);
    s.hands[0].push(swapped);
    s.emit('You swap the final card with one from your hand.');
    this._resolveWithSkill(s.pendingSkill);
  }

  _resolveWithSkill(skill) {
    const s = this.state;
    const lastEntry = s.effortPile[s.effortPile.length - 1];
    s.effortPileRevealed.push(lastEntry);

    const allCards = s.effortPileRevealed.map(e => e.card);
    const total = calculateEffortTotal(allCards, s.currentProject.condition, skill);
    s.emit(`Total effort after skill: ${total}. Required: ${s.effortRequired}.`);

    if (total >= s.effortRequired) {
      s.emit(`Project PASSED via ${skill.name}!`);
      s.phase = PHASES.OUTCOME_PASS;
      this._grantPassExtraCredit(false); // no extra credit when skill used
    } else {
      s.emit(`Project FAILED even with ${skill.name}.`);
      s.phase = PHASES.OUTCOME_FAIL;
      this._change();
      this._scheduleAI(800);
    }
  }

  // Accountability resolution
  resolveAccountability(winnerIndex) {
    const s = this.state;
    // winner swaps top party card with lowest effort card
    const partyCard = s.partyPiles[winnerIndex].pop();
    const effortCards = s.effortPileRevealed.map(e => e.card).filter(c => !c.isCopy);
    if (effortCards.length > 0) {
      effortCards.sort((a, b) => a.value - b.value);
      const lowest = effortCards[0];
      // Replace lowest in pile
      const idx = s.effortPileRevealed.findIndex(e => e.card.uid === lowest.uid);
      if (idx !== -1) s.effortPileRevealed[idx].card = partyCard;
      // Return lowest effort card to player's hand
      s.hands[winnerIndex].push(lowest);
    }
    s.phase = PHASES.DAY_OF_DEADLINE;
    s.pendingSkill = null;
    this._resolveWithSkill({ id: 'accountability', name: 'Accountability' });
  }

  _aiDayOfDeadline() {
    const s = this.state;
    const skill = aiChooseSkill(s);
    if (skill) {
      this.useSkill(skill);
    } else {
      this.letItRide();
    }
  }

  // Extend Deadline flow
  _aiBreakDraw() {
    // handled below in semesterBreak section
  }

  // ── Pass / Extra Credit ──────────────────────────────────

  _grantPassExtraCredit(viLetItRide) {
    const s = this.state;
    // Draw new leadership skill
    if (s.skillDeck.length > 0) {
      this._drawSkills(s);
    }

    if (viLetItRide) {
      // PL gets extra credit; then nominates one other player
      s.extraCredits[s.projectLeaderIndex].push({ type: 'extra_credit', value: EXTRA_CREDIT_POINTS });
      s.emit(`${s.playerNames[s.projectLeaderIndex]} earns Extra Credit!`);
      s.nominationPending = true;
      s.phase = PHASES.NOMINATE;
    } else {
      // Passed via skill — no extra credit this semester
      s.nominationPending = false;
      s.phase = PHASES.END_OF_SEMESTER;
    }
    this._change();
    if (s.phase === PHASES.NOMINATE && s.projectLeaderIndex !== 0) {
      this._scheduleAI(800);
    }
    if (s.phase === PHASES.END_OF_SEMESTER) {
      this._scheduleAI(800);
    }
  }

  nominateForExtraCredit(targetIndex) {
    const s = this.state;
    if (s.phase !== PHASES.NOMINATE) return;
    s.extraCredits[targetIndex].push({ type: 'extra_credit', value: EXTRA_CREDIT_POINTS });
    s.emit(`${s.playerNames[targetIndex]} is nominated and earns Extra Credit!`);
    s.nominationPending = false;
    s.phase = PHASES.END_OF_SEMESTER;
    this._change();
    this._scheduleAI(600);
  }

  // ── Blame Vote ───────────────────────────────────────────

  _startBlameVote() {
    const s = this.state;
    s.phase = PHASES.BLAME_VOTE;
    s.votes = [-1, -1, -1, -1];
    s.emit(`${s.playerNames[s.projectLeaderIndex]} must accuse someone...`);
    this._change();

    if (s.projectLeaderIndex !== 0) {
      // AI accuses: target player with highest visible party card
      const candidates = [0,1,2,3].filter(i => i !== s.projectLeaderIndex && !s.expelled[i]);
      if (candidates.length === 0) { this.endSemester(); return; }
      const accused = candidates[Math.floor(Math.random() * candidates.length)];
      this._scheduleAI(800);
      this.state.accusedIndex = accused;
      s.emit(`${s.playerNames[s.projectLeaderIndex]} accuses ${s.playerNames[accused]}!`);
      this._change();
    }
  }

  humanAccuse(targetIndex) {
    const s = this.state;
    if (s.phase !== PHASES.BLAME_VOTE) return;
    s.accusedIndex = targetIndex;
    s.emit(`You accuse ${s.playerNames[targetIndex]}!`);
    this._change();
    this._scheduleAI(600);
  }

  _aiVote() {
    const s = this.state;
    if (s.accusedIndex === -1) return; // still waiting for accusation

    // Voters: not PL, not accused, not expelled
    for (let i = 0; i < NUM_PLAYERS; i++) {
      if (i === s.projectLeaderIndex) continue;
      if (i === s.accusedIndex) continue;
      if (s.expelled[i]) continue;
      if (s.votes[i] !== -1) continue;
      if (i === 0) continue; // human votes manually

      s.votes[i] = aiBlamevote(s, i);
    }
    this._change();

    // If human is a voter, wait; otherwise tally
    const humanIsVoter = !s.expelled[0] && 0 !== s.projectLeaderIndex && 0 !== s.accusedIndex;
    if (!humanIsVoter) {
      this._tallyVotes();
    }
  }

  humanVote(vote) {
    const s = this.state;
    if (s.phase !== PHASES.BLAME_VOTE) return;
    s.votes[0] = vote;
    this._tallyVotes();
  }

  _tallyVotes() {
    const s = this.state;
    const accusedVotes = s.votes.filter(v => v === 0).length;
    const leaderVotes = s.votes.filter(v => v === 1).length;

    s.emit(`Votes — Blame Accused: ${accusedVotes}, Blame Leader: ${leaderVotes}`);
    s.phase = PHASES.VOTE_RESULT;

    if (accusedVotes === leaderVotes) {
      // Tied — investigation: reveal top party cards, highest takes fail
      s.emit('Tied vote! Investigation: players reveal top Party Pile cards.');
      const voters = [s.accusedIndex, s.projectLeaderIndex].filter(i => !s.expelled[i]);
      let highestVal = -1;
      let takers = [];
      voters.forEach(i => {
        const pile = s.partyPiles[i];
        if (pile.length > 0) {
          const top = pile[pile.length - 1];
          const v = top.isCopy ? 0 : top.value;
          if (v > highestVal) { highestVal = v; takers = [i]; }
          else if (v === highestVal) takers.push(i);
        }
      });
      takers.forEach(i => this._giveFail(i));
    } else {
      const blamed = accusedVotes > leaderVotes ? s.accusedIndex : s.projectLeaderIndex;
      s.emit(`${s.playerNames[blamed]} takes the blame!`);
      this._giveFail(blamed);
    }

    this._change();
    this._scheduleAI(800);
  }

  _giveFail(playerIndex) {
    const s = this.state;
    s.fails[playerIndex]++;
    if (!s.playersWhoTookFailThisSemester.includes(playerIndex)) {
      s.playersWhoTookFailThisSemester.push(playerIndex);
    }
    s.emit(`${s.playerNames[playerIndex]} receives a Fail! (${s.fails[playerIndex]}/${MAX_FAILS})`);

    if (s.fails[playerIndex] >= MAX_FAILS) {
      s.expelled[playerIndex] = true;
      s.emit(`${s.playerNames[playerIndex]} is EXPELLED!`);
      s.hands[playerIndex] = [];
    }
  }

  // ── Snitch ───────────────────────────────────────────────

  _startSnitch() {
    const s = this.state;
    if (s.playersWhoTookFailThisSemester.length === 0) {
      this.endSemester();
      return;
    }

    // Initiator is the first player who took a fail this semester
    s.snitchInitiator = s.playersWhoTookFailThisSemester[0];
    s.currentSnitchPlayer = s.snitchInitiator;
    s.snitchActive = true;
    s.phase = PHASES.SNITCH;
    s.emit(`${s.playerNames[s.snitchInitiator]} may snitch on someone. Top Party card: ${this._topPartyCardStr(s.snitchInitiator)}`);
    this._change();
    if (s.currentSnitchPlayer !== 0) this._scheduleAI(800);
  }

  _topPartyCardStr(playerIndex) {
    const pile = this.state.partyPiles[playerIndex];
    if (pile.length === 0) return 'none';
    const top = pile[pile.length - 1];
    return top.isCopy ? 'X2 Copy (0)' : String(top.value);
  }

  humanSnitch(targetIndex) {
    const s = this.state;
    if (s.phase !== PHASES.SNITCH || s.currentSnitchPlayer !== 0) return;
    this._processSnitchAttempt(0, targetIndex);
  }

  humanPassSnitch() {
    const s = this.state;
    if (s.phase !== PHASES.SNITCH || s.currentSnitchPlayer !== 0) return;
    s.emit('You choose not to snitch.');
    s.snitchActive = false;
    this.endSemester();
  }

  _aiSnitch() {
    const s = this.state;
    const i = s.currentSnitchPlayer;
    if (aiShouldSnitch(s, i)) {
      const target = aiChooseSnitchTarget(s, i);
      if (target !== -1) {
        this._processSnitchAttempt(i, target);
        return;
      }
    }
    s.emit(`${s.playerNames[i]} passes on snitching.`);
    s.snitchActive = false;
    this.endSemester();
  }

  _processSnitchAttempt(snitcherIndex, targetIndex) {
    const s = this.state;
    const snitcherPile = s.partyPiles[snitcherIndex];
    const targetPile = s.partyPiles[targetIndex];

    if (snitcherPile.length === 0 || targetPile.length === 0) {
      s.emit('Snitch failed — missing party cards.');
      s.snitchActive = false;
      this.endSemester();
      return;
    }

    const snitcherTop = snitcherPile[snitcherPile.length - 1];
    const targetTop = targetPile[targetPile.length - 1];
    const sv = snitcherTop.isCopy ? 0 : snitcherTop.value;
    const tv = targetTop.isCopy ? 0 : targetTop.value;

    s.emit(`${s.playerNames[snitcherIndex]} snitches on ${s.playerNames[targetIndex]}! Revealed: ${tv} vs ${sv}.`);

    if (tv >= sv) {
      // Snitch succeeds
      s.emit(`Snitch SUCCESS! ${s.playerNames[targetIndex]} takes a Fail.`);
      this._giveFail(targetIndex);
      s.snitchChain.push({ snitcher: snitcherIndex, target: targetIndex, result: 'success' });
      // Target may now snitch
      if (!s.expelled[targetIndex]) {
        s.currentSnitchPlayer = targetIndex;
        s.emit(`${s.playerNames[targetIndex]} may now snitch. Top Party card: ${this._topPartyCardStr(targetIndex)}`);
        this._change();
        if (targetIndex !== 0) this._scheduleAI(1000);
      } else {
        this.endSemester();
      }
    } else {
      // Snitch fails
      s.emit(`Snitch FAILED! ${s.playerNames[snitcherIndex]} takes an extra Fail.`);
      this._giveFail(snitcherIndex);
      s.snitchChain.push({ snitcher: snitcherIndex, target: targetIndex, result: 'fail' });
      s.snitchActive = false;
      this.endSemester();
    }
    this._change();
  }

  // ── End of Semester ──────────────────────────────────────

  endSemester() {
    const s = this.state;
    s.snitchActive = false;

    // All players who took a fail discard their top party pile card
    s.playersWhoTookFailThisSemester.forEach(i => {
      if (s.partyPiles[i].length > 0) {
        const discarded = s.partyPiles[i].pop();
        s.emit(`${s.playerNames[i]} discards top party card (${discarded.isCopy ? 'X2 Copy' : discarded.value}).`);
      }
    });

    s.phase = PHASES.END_OF_SEMESTER;
    s.emit(`--- End of Semester ${s.semester} ---`);
    this._change();

    // Rotate project leader
    this._rotateProjectLeader();

    // Semester break after 2, 4, 6
    if (s.semester === 2 || s.semester === 4 || s.semester === 6) {
      this._scheduleAI(800);
      setTimeout(() => {
        s.phase = PHASES.SEMESTER_BREAK;
        s.emit('Semester Break! Return effort cards to pool and draw new pairs.');
        this._change();
        this._scheduleAI(400);
      }, 1200);
    } else {
      this._scheduleAI(1000);
      setTimeout(() => this.advanceToSemesterStart(), 1500);
    }
  }

  _rotateProjectLeader() {
    const s = this.state;
    const active = [0,1,2,3].filter(i => !s.expelled[i]);
    const currentIdx = active.indexOf(s.projectLeaderIndex);
    const nextIdx = (currentIdx + 1) % active.length;
    s.projectLeaderIndex = active[nextIdx];
    s.emit(`${s.playerNames[s.projectLeaderIndex]} is the next Project Leader.`);
  }

  // ── Semester Break ───────────────────────────────────────

  _aiBreakDrawAll() {
    const s = this.state;
    for (let i = 1; i < NUM_PLAYERS; i++) {
      if (s.expelled[i]) continue;
      this._autoDrawBreakPair(i);
    }
    // After AI draw, prompt human
    this._change();
  }

  _autoDrawBreakPair(playerIndex) {
    const s = this.state;
    const taken = s.takenBreakPairs[playerIndex];

    // Find eligible pairs
    const eligible = BREAK_PAIRS.filter(p => {
      if (p.canRepeat) return true;
      return !taken.includes(p.id);
    });

    if (eligible.length === 0) {
      // Default to 4 + copy
      const fallback = BREAK_PAIRS.find(p => p.id === 'pair_4_c');
      this._drawPair(playerIndex, fallback);
      return;
    }

    // AI preference: avoid pairs already taken, prefer mid-range
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    this._drawPair(playerIndex, pick);
  }

  _drawPair(playerIndex, pair) {
    const s = this.state;
    s.takenBreakPairs[playerIndex].push(pair.id);

    pair.cards.forEach(v => {
      const uid = `${playerIndex}_break_${s.semester}_${v}`;
      if (v === 'copy') {
        s.hands[playerIndex].push({ typeId: 'copy', value: null, isCopy: true, uid });
      } else {
        s.hands[playerIndex].push({ typeId: 'e' + v, value: v, isCopy: false, uid });
      }
    });

    s.emit(`${s.playerNames[playerIndex]} draws ${pair.label}.`);
  }

  humanDrawBreakPair(pairId) {
    const s = this.state;
    if (s.phase !== PHASES.SEMESTER_BREAK && s.phase !== PHASES.BREAK_DRAW) return;

    const pair = BREAK_PAIRS.find(p => p.id === pairId);
    if (!pair) return;

    const taken = s.takenBreakPairs[0];
    if (!pair.canRepeat && taken.includes(pair.id)) {
      s.emit('You have already taken that pair. Choose another, or take 4 + X2 Copy.');
      this._change();
      return;
    }

    this._drawPair(0, pair);
    // AI draw
    this._aiBreakDrawAll();
    s.phase = PHASES.END_OF_SEMESTER;
    this._change();
    setTimeout(() => this.advanceToSemesterStart(), 1500);
  }

  // ── Extend Deadline Flow ─────────────────────────────────

  processExtendDeadline() {
    const s = this.state;
    if (s.phase !== 'SKILL_EXTEND') return;

    const order = s.extendPickupOrder;

    // Pickup phase: each player takes one card from effort pile
    if (s.extendPickedUp.length < order.length) {
      const playerIdx = order[s.extendPickedUp.length];
      if (s.effortPile.length > 0) {
        const picked = s.effortPile.shift();
        s.hands[playerIdx].push(picked.card);
        s.extendPickedUp.push({ playerIdx, card: picked.card });
        s.effortPileRevealed = s.effortPileRevealed.filter(e => e.card.uid !== picked.card.uid);
        s.emit(`${s.playerNames[playerIdx]} picks up a card from the effort pile.`);
      }
      if (playerIdx === 0) {
        // Human picks manually — handled by humanExtendPickup
      } else {
        this._scheduleAI(400);
      }
      this._change();
      return;
    }

    // Play phase: each player plays one card face-up
    if (s.extendPlayed.length < order.length) {
      const playerIdx = order[s.extendPlayed.length];
      if (playerIdx === 0) {
        // Wait for human
        s.phase = 'SKILL_EXTEND_PLAY';
        this._change();
        return;
      }
      const card = aiChooseEffortCard(s, playerIdx);
      if (card) {
        s.hands[playerIdx] = s.hands[playerIdx].filter(c => c.uid !== card.uid);
        const entry = { card, playedBy: playerIdx };
        s.effortPile.push(entry);
        s.effortPileRevealed.push(entry);
        s.extendPlayed.push({ playerIdx, card });
        s.emit(`${s.playerNames[playerIdx]} plays ${card.isCopy ? 'X2 Copy' : card.value} face-up.`);
      }
      this._scheduleAI(400);
      this._change();
      return;
    }

    // All played — calculate new total
    s.extendDeadlineActive = false;
    const allCards = s.effortPileRevealed.map(e => e.card);
    const total = calculateEffortTotal(allCards, s.currentProject.condition);
    s.emit(`Extend the Deadline resolved. New total: ${total}. Required: ${s.effortRequired}.`);

    if (total >= s.effortRequired) {
      s.phase = PHASES.OUTCOME_PASS;
      s.emit('Project PASSED via Extend the Deadline!');
      this._grantPassExtraCredit(false);
    } else {
      s.phase = PHASES.OUTCOME_FAIL;
      s.emit('Project FAILED even after extending the deadline.');
      this._change();
      this._scheduleAI(800);
    }
  }

  humanExtendPlay(card) {
    const s = this.state;
    if (s.phase !== 'SKILL_EXTEND_PLAY') return;
    s.hands[0] = s.hands[0].filter(c => c.uid !== card.uid);
    const entry = { card, playedBy: 0 };
    s.effortPile.push(entry);
    s.effortPileRevealed.push(entry);
    s.extendPlayed.push({ playerIdx: 0, card });
    s.phase = 'SKILL_EXTEND';
    s.emit(`You play ${card.isCopy ? 'X2 Copy' : card.value} face-up.`);
    this._scheduleAI(400);
    this._change();
  }

  // ── Outcome Fail → Blame ─────────────────────────────────

  // Called by AI tick when phase is OUTCOME_FAIL
  _handleOutcomeFail() {
    this._startBlameVote();
  }

  // ── End Game / Scoring ───────────────────────────────────

  endGame() {
    const s = this.state;
    s.phase = PHASES.GAME_OVER;
    const scores = this._calcScores();
    s.finalScores = scores;
    s.emit('=== GAME OVER ===');
    scores.forEach(({ playerIndex, name, score, details }) => {
      s.emit(`${name}: ${score} party points (${details})`);
    });
    this._change();
  }

  _calcScores() {
    const s = this.state;
    return [0,1,2,3].map(i => {
      const pilePoints = s.partyPiles[i].reduce((sum, c) => {
        return sum + (c.isCopy ? 0 : c.value);
      }, 0);
      const ecPoints = s.extraCredits[i].length * EXTRA_CREDIT_POINTS;
      const noFails = s.fails[i] === 0;
      const responsibleBonus = s.extraCredits[i].some(ec => ec.type === 'responsible') && noFails ? 3 : 0;
      const total = pilePoints + ecPoints + responsibleBonus;
      return {
        playerIndex: i,
        name: s.playerNames[i],
        score: total,
        pilePoints, ecPoints, responsibleBonus,
        details: `pile:${pilePoints} ec:${ecPoints} bonus:${responsibleBonus}`,
      };
    }).sort((a, b) => b.score - a.score);
  }
}

// Expose globally for index.html
window.Game = Game;
window.PHASES = PHASES;
window.calculateEffortTotal = calculateEffortTotal;
