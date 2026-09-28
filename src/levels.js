/*LEVELS-START*/
// Chapter 1 (Apprentice) teaches one idea per crossing. Chapter 2 is named for
// real Ugandan rivers, falls and gorges.
// Anchors: [x, y] in metres. The first two are always the road-level bank edges.
// mood: the time of day in the live test. tip: the first hint.
// guide: ghost members drawn for the very first levels.
// unlocks: the field note that completing the level unlocks.
const CHAPTERS = [
  { id: 1, name: 'Apprentice', blurb: 'Six small crossings. One new idea each.' },
  { id: 2, name: 'The Nile and beyond', blurb: 'Real rivers, heavier traffic, tighter budgets.' },
];

const LEVELS = [
  {
    id: 101, chapter: 1, code: 'AP-01', name: 'The Ditch', place: 'Kawempe',
    gap: 2, hR: 0, waterY: -2.6, seed: 5, vehicle: 'boda', budget: 1000, mood: 'noon',
    materials: ['road'],
    anchors: [[0, 0], [2, 0]],
    guide: [[0, 0, 2, 0]],
    notes: [
      'Press on the left amber pin, drag to the right one, let go.',
      'Then press Test.',
    ],
    tip: 'Press and hold on the amber pin on the left bank, drag to the pin on the right bank, and let go. That line is a road plank. Then press Test.',
    unlocks: 'forces',
  },
  {
    id: 102, chapter: 1, code: 'AP-02', name: 'Two Planks', place: 'Nakawa',
    gap: 4, hR: 0, waterY: -3.5, seed: 8, vehicle: 'boda', budget: 1500, mood: 'noon',
    materials: ['road'],
    anchors: [[0, 0], [4, 0]],
    guide: [[0, 0, 2, 0], [2, 0, 4, 0]],
    notes: [
      'A plank is at most 2.5 m long.',
      'Stop in the middle to make a joint, then carry on from it.',
    ],
    tip: 'Planks max out at 2.5 m, so this gap needs two. Drag from the left pin to the middle and let go: that makes a joint. Then drag from the new joint to the right pin.',
    unlocks: 'sag',
  },
  {
    id: 103, chapter: 1, code: 'AP-03', name: 'Prop It Up', place: 'Lugazi',
    gap: 6, hR: 0, waterY: -5, seed: 12, vehicle: 'van', budget: 3200, mood: 'dawn',
    materials: ['road', 'wood'],
    anchors: [[0, 0], [6, 0], [0, -2], [6, -2]],
    notes: [
      'A 2.4 t van. A bare deck will snap.',
      'Use the lower anchors on the cliffs. Props turn a sag into a push.',
    ],
    tip: 'Lay the deck in three planks. Then draw timber props from the two lower anchors on the cliffs up to the deck joints, like legs. The load now flows down the props into the rock.',
    unlocks: 'loadpath',
  },
  {
    id: 104, chapter: 1, code: 'AP-04', name: 'The Triangle', place: 'Mpigi',
    gap: 8, hR: 0, waterY: -6, seed: 17, vehicle: 'car', budget: 4500, mood: 'noon',
    materials: ['road', 'wood'],
    anchors: [[0, 0], [8, 0]],
    notes: [
      'No lower anchors here. The bridge must hold itself up.',
      'Squares fold flat. Triangles cannot change shape.',
    ],
    tip: 'Push on a square and it folds into a diamond. A triangle can\'t change shape without stretching a side. Build a row of triangles along the deck: a joint 1.5 m above (or below) the middle of each plank, joined to both of its ends and to its neighbours.',
    unlocks: 'triangle',
  },
  {
    id: 105, chapter: 1, code: 'AP-05', name: 'Heavy Metal', place: 'Jinja Road',
    gap: 10, hR: 0, waterY: -6, seed: 21, vehicle: 'truck', budget: 10000, mood: 'dawn',
    materials: ['road', 'wood', 'steel'],
    anchors: [[0, 0], [10, 0], [0, -2.5], [10, -2.5]],
    notes: [
      'The 6 t tipper is here. Timber alone will buckle.',
      'Steel is strong and costly. Test, then press F to see where forces peak.',
    ],
    tip: 'Build triangles under the deck. Test with Forces view (F): the brightest members work hardest. Make those steel and keep timber where the colour is faint. Diagonals near the banks usually matter most.',
    unlocks: 'buckling',
  },
  {
    id: 106, chapter: 1, code: 'AP-06', name: 'Hanging On', place: 'Busia',
    gap: 12, hR: 0, waterY: -6, seed: 29, vehicle: 'car', budget: 9000, mood: 'dusk',
    materials: ['road', 'cable'],
    anchors: [[0, 0], [12, 0], [-2, 6], [14, 6]],
    spires: [{ x: -2, y: 6, w: 2.2 }, { x: 14, y: 6, w: 2.2 }],
    notes: [
      'Only road and cable here.',
      'Cables pull but never push. Hang the deck from the rock towers.',
    ],
    tip: 'Lay the deck in 2 m planks. Then draw cables from each tower top down to deck joints on its side of the river. Two or three cables per tower are enough.',
    unlocks: 'cables',
  },
  {
    id: 1, chapter: 2, code: 'DJ-01', name: 'Nakivubo Channel', place: 'Kampala',
    gap: 10, hR: 0, waterY: -8, seed: 11, vehicle: 'car', budget: 6500, mood: 'dusk',
    materials: ['road', 'wood'],
    anchors: [[0, 0], [10, 0], [0, -2.5], [10, -2.5]],
    notes: [
      'Lay a road deck from bank to bank.',
      'A deck alone sags and snaps. Brace it with timber triangles.',
    ],
    tip: 'A row of triangles under the deck carries a car comfortably. Keep the diagonals short.',
  },
  {
    id: 2, chapter: 2, code: 'DJ-02', name: 'Mayanja Crossing', place: 'Wakiso',
    gap: 14, hR: 0, waterY: -9, seed: 23, vehicle: 'van', budget: 10000, mood: 'noon',
    materials: ['road', 'wood'],
    anchors: [[0, 0], [14, 0], [0, -3], [14, -3]],
    notes: [
      'Longer span, heavier van: 2.4 t.',
      'Long timber in compression buckles. Keep struts short.',
    ],
    tip: 'Fourteen metres is long for one row of triangles. Make them deeper (2 m) and short-sided. Members next to the banks carry the most.',
  },
  {
    id: 3, chapter: 2, code: 'DJ-03', name: 'Ssezibwa Falls', place: 'Mukono',
    gap: 20, hR: 0, waterY: -10, seed: 5, vehicle: 'matatu', budget: 16500, mood: 'dawn',
    materials: ['road', 'wood', 'steel'],
    anchors: [[0, 0], [20, 0], [0, -3], [20, -3], [10, -3.5]],
    pillars: [{ x: 10, y: -3.5 }],
    notes: [
      'A rock outcrop mid-river gives you a third support.',
      'Steel unlocked: strong but costly. Spend it where forces peak.',
    ],
    tip: 'Treat it as two 10 m bridges. Put a deck joint right above the rock and run a strut down to its anchor.',
    unlocks: 'spans',
  },
  {
    id: 4, chapter: 2, code: 'DJ-04', name: 'Sipi Gorge', place: 'Kapchorwa',
    gap: 16, hR: 2, waterY: -10, seed: 41, vehicle: 'van', budget: 12000, mood: 'noon',
    materials: ['road', 'wood', 'steel'],
    anchors: [[0, 0], [16, 2], [0, -3], [16, -1]],
    notes: [
      'The far bank sits 2 m higher. Build a ramp.',
      'Joints stay where you draw them, so a sloping deck needs no special trick.',
    ],
    tip: 'Lay the deck as one straight slope from the low bank to the high one. Triangles work at any angle. Tie the bottom chord to both lower anchors.',
  },
  {
    id: 5, chapter: 2, code: 'DJ-05', name: 'Kalagala Rapids', place: 'Kayunga',
    gap: 22, hR: 0, waterY: -9, seed: 77, vehicle: 'matatu', budget: 20000, mood: 'dusk',
    materials: ['road', 'wood', 'steel', 'cable'],
    anchors: [[0, 0], [22, 0], [-2.6, 8], [24.6, 8]],
    spires: [{ x: -2.6, y: 8, w: 2.6 }, { x: 24.6, y: 8, w: 2.6 }],
    notes: [
      'No footing below the deck here: the rapids scour everything.',
      'Cables carry tension only and go slack in compression.',
      'Hang the deck from the rock towers.',
    ],
    tip: 'Give the deck a shallow row of timber triangles so it stays stiff, then hang it from the towers with two cables each side.',
  },
  {
    id: 6, chapter: 2, code: 'DJ-06', name: 'Karuma Crossing', place: 'Kiryandongo',
    gap: 28, hR: 0, waterY: -11, seed: 19, vehicle: 'truck', budget: 29000, mood: 'night',
    materials: ['road', 'wood', 'steel', 'cable'],
    anchors: [[0, 0], [28, 0], [0, -3.5], [28, -3.5], [9.5, -4], [18.5, -4]],
    pillars: [{ x: 9.5, y: -4 }, { x: 18.5, y: -4 }],
    notes: [
      'A 6 t tipper loaded with murram, crossing at night.',
      'Two river piers. Three short spans beat one long one.',
    ],
    tip: 'Three short spans, one between each pair of supports. Put steel in the diagonals next to each support (that is where the shear is), and timber in the middle.',
    unlocks: 'shear',
  },
  {
    id: 7, chapter: 2, code: 'DJ-07', name: 'Murchison Gorge', place: 'Nwoya',
    gap: 30, hR: 0, waterY: -13, seed: 3, vehicle: 'truck', budget: 58000, mood: 'dawn',
    materials: ['road', 'wood', 'steel', 'cable'],
    anchors: [[0, 0], [30, 0], [0, -4], [30, -4], [0, -7], [30, -7], [-3, 9], [33, 9]],
    spires: [{ x: -3, y: 9, w: 3 }, { x: 33, y: 9, w: 3 }],
    notes: [
      'Here the whole Nile squeezes through a 7 m slot.',
      'Thirty metres clear, nothing in between. Use every anchor.',
    ],
    tip: 'Thirty metres with nothing below. A deep steel truss above the deck, plus cables from the towers to its top chord, shares the load.',
  },
  {
    id: 8, chapter: 2, code: 'DJ-08', name: 'Source of the Nile', place: 'Jinja',
    gap: 40, hR: 0, waterY: -12, seed: 99, vehicle: 'truck', budget: 62000, mood: 'dusk',
    materials: ['road', 'wood', 'steel', 'cable'],
    anchors: [[0, 0], [40, 0], [0, -4], [40, -4], [13.5, -4.5], [26.5, -4.5], [-3, 10], [43, 10]],
    pillars: [{ x: 13.5, y: -4.5 }, { x: 26.5, y: -4.5 }],
    spires: [{ x: -3, y: 10, w: 3 }, { x: 43, y: 10, w: 3 }],
    notes: [
      'Forty metres where the Nile leaves Lake Victoria.',
      'Piers, towers, cables: the full toolkit. Build it well.',
    ],
    tip: 'Use both piers: three spans of triangles under the deck, tied down to every anchor. Steel where forces peak, timber elsewhere.',
    unlocks: 'jinja',
  },
];

// Short lessons unlocked by finishing levels. `fig` names an illustration.
const FIELD_NOTES = [
  { id: 'forces', title: 'Tension and compression',
    text: 'Every member of a bridge is either being pulled (tension) or squashed (compression). Press F during a test to see it: red members are pulled, blue ones pushed. Designing a bridge means giving every force a path down to the ground.' },
  { id: 'sag', title: 'Why a flat deck sags',
    text: 'A deck joined only at its ends acts like a rope. It can only carry weight by sagging, and the flatter it stays, the harder it has to pull. Nearly flat means enormous tension, which is why long bare decks snap.' },
  { id: 'loadpath', title: 'Load paths',
    text: 'Weight always finds its way to the ground. A prop gives it a short, direct path, and the prop is squashed rather than stretched. Good engineers trace the load path before they draw a single member.' },
  { id: 'triangle', title: 'The triangle',
    text: 'A square with pinned corners folds flat under a push. A triangle can\'t change shape unless a side changes length, so it stays rigid. Chains of triangles are called trusses. The Warren truss, patented in 1848, uses a row of equal triangles like the ones you just built.' },
  { id: 'buckling', title: 'Buckling',
    text: 'Push the ends of a ruler together and it bows sideways long before the material crushes. Leonhard Euler worked out the rule in the 1700s: buckling strength falls with the square of the length. Double a strut\'s length and it holds a quarter as much. Keep compression members short.' },
  { id: 'cables', title: 'Cables',
    text: 'Steel wire is fantastically strong when pulled, and useless when pushed. In a cable-stayed bridge, straight cables run from tall towers down to the deck. The Source of the Nile Bridge at Jinja, opened in 2018, is a cable-stayed bridge.' },
  { id: 'spans', title: 'Spans and piers',
    text: 'The bending in a span grows with the square of its length. Split a span in two with a pier and each half carries only a quarter of the bending. That is why long river bridges stand on many piers wherever the riverbed allows it.' },
  { id: 'shear', title: 'Shear near the supports',
    text: 'In a truss, the chords at mid-span carry most of the bending. Near the supports the diagonals carry the shear: the whole weight trying to slide down past the support. Strengthen diagonals near supports and chords near mid-span.' },
  { id: 'jinja', title: 'The engineer\'s job',
    text: 'Real bridges balance strength, cost, and what can actually be built on site. The best designs do more with less: every member works hard and nothing is wasted. The Lean solutions in this game are that idea, found by a computer search. Can you beat them?' },
];

// Achievements, checked after each test.
const BADGES = [
  { id: 'first', name: 'Ribbon Cutter', desc: 'Complete your first crossing.' },
  { id: 'triangle', name: 'Triangulated', desc: 'Finish The Triangle (AP-04).' },
  { id: 'apprentice', name: 'Apprentice No More', desc: 'Finish every Apprentice crossing.' },
  { id: 'three', name: 'Penny Pincher', desc: 'Earn three stars on any crossing.' },
  { id: 'half', name: 'Scrooge', desc: 'Cross for less than half the budget.' },
  { id: 'beat', name: 'Beat the Engineer', desc: 'Cross for less than the Lean solution.' },
  { id: 'lazy', name: 'Belt and Braces', desc: 'Cross with every member below 25% stress.' },
  { id: 'edge', name: 'Nerves of Steel', desc: 'Cross while a member hits 95% or more.' },
  { id: 'survivor', name: 'Held Together by Hope', desc: 'Cross even though three or more members broke.' },
  { id: 'splash', name: 'Splash Zone', desc: 'Send five vehicles into the river.' },
  { id: 'demolition', name: 'Demolition Crew', desc: 'Break 25 members in a single test.' },
  { id: 'nile', name: 'Master of the Nile', desc: 'Three stars on every Nile crossing.' },
  { id: 'dreamer', name: 'Big Dreamer', desc: 'Cross a 40 m span in the sandbox.' },
  { id: 'sharer', name: 'Show-off', desc: 'Share a bridge or save a postcard.' },
];
/*LEVELS-END*/
