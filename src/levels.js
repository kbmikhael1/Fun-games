/*LEVELS-START*/
// Eight crossings, each named for a real Ugandan river, falls or gorge.
// Anchors: [x, y] in metres. The first two are always the road-level bank edges.
const LEVELS = [
  {
    id: 1, code: 'DJ-01', name: 'Nakivubo Channel', place: 'Kampala',
    gap: 10, hR: 0, waterY: -8, seed: 11, vehicle: 'car', budget: 6500,
    materials: ['road', 'wood'],
    anchors: [[0, 0], [10, 0], [0, -2.5], [10, -2.5]],
    notes: [
      'Lay a road deck from bank to bank.',
      'A deck alone sags and snaps. Brace it with timber triangles.',
      'Drag from any joint or anchor to add a member.',
    ],
  },
  {
    id: 2, code: 'DJ-02', name: 'Mayanja Crossing', place: 'Wakiso',
    gap: 14, hR: 0, waterY: -9, seed: 23, vehicle: 'van', budget: 10000,
    materials: ['road', 'wood'],
    anchors: [[0, 0], [14, 0], [0, -3], [14, -3]],
    notes: [
      'Longer span, heavier van: 2.4 t.',
      'Long timber in compression buckles. Keep struts short.',
    ],
  },
  {
    id: 3, code: 'DJ-03', name: 'Ssezibwa Falls', place: 'Mukono',
    gap: 20, hR: 0, waterY: -10, seed: 5, vehicle: 'matatu', budget: 16500,
    materials: ['road', 'wood', 'steel'],
    anchors: [[0, 0], [20, 0], [0, -3], [20, -3], [10, -3.5]],
    pillars: [{ x: 10, y: -3.5 }],
    notes: [
      'A rock outcrop mid-river gives you a third support.',
      'Steel unlocked: strong but costly. Spend it where forces peak.',
    ],
  },
  {
    id: 4, code: 'DJ-04', name: 'Sipi Gorge', place: 'Kapchorwa',
    gap: 16, hR: 2, waterY: -10, seed: 41, vehicle: 'van', budget: 12000,
    materials: ['road', 'wood', 'steel'],
    anchors: [[0, 0], [16, 2], [0, -3], [16, -1]],
    notes: [
      'The far bank sits 2 m higher. Build a ramp.',
      'Joints stay where you draw them, so a sloping deck needs no special trick.',
    ],
  },
  {
    id: 5, code: 'DJ-05', name: 'Kalagala Rapids', place: 'Kayunga',
    gap: 22, hR: 0, waterY: -9, seed: 77, vehicle: 'matatu', budget: 20000,
    materials: ['road', 'wood', 'steel', 'cable'],
    anchors: [[0, 0], [22, 0], [-2.6, 8], [24.6, 8]],
    spires: [{ x: -2.6, y: 8, w: 2.6 }, { x: 24.6, y: 8, w: 2.6 }],
    notes: [
      'No footing below the deck here: the rapids scour everything.',
      'Cables unlocked. They carry tension only and go slack in compression.',
      'Hang the deck from the rock towers.',
    ],
  },
  {
    id: 6, code: 'DJ-06', name: 'Karuma Crossing', place: 'Kiryandongo',
    gap: 28, hR: 0, waterY: -11, seed: 19, vehicle: 'truck', budget: 29000,
    materials: ['road', 'wood', 'steel', 'cable'],
    anchors: [[0, 0], [28, 0], [0, -3.5], [28, -3.5], [9.5, -4], [18.5, -4]],
    pillars: [{ x: 9.5, y: -4 }, { x: 18.5, y: -4 }],
    notes: [
      'A 6 t tipper loaded with murram.',
      'Two river piers. Three short spans beat one long one.',
    ],
  },
  {
    id: 7, code: 'DJ-07', name: 'Murchison Gorge', place: 'Nwoya',
    gap: 30, hR: 0, waterY: -13, seed: 3, vehicle: 'truck', budget: 58000,
    materials: ['road', 'wood', 'steel', 'cable'],
    anchors: [[0, 0], [30, 0], [0, -4], [30, -4], [0, -7], [30, -7], [-3, 9], [33, 9]],
    spires: [{ x: -3, y: 9, w: 3 }, { x: 33, y: 9, w: 3 }],
    notes: [
      'Here the whole Nile squeezes through a 7 m slot.',
      'Thirty metres clear, nothing in between. Use every anchor.',
    ],
  },
  {
    id: 8, code: 'DJ-08', name: 'Source of the Nile', place: 'Jinja',
    gap: 40, hR: 0, waterY: -12, seed: 99, vehicle: 'truck', budget: 62000,
    materials: ['road', 'wood', 'steel', 'cable'],
    anchors: [[0, 0], [40, 0], [0, -4], [40, -4], [13.5, -4.5], [26.5, -4.5], [-3, 10], [43, 10]],
    pillars: [{ x: 13.5, y: -4.5 }, { x: 26.5, y: -4.5 }],
    spires: [{ x: -3, y: 10, w: 3 }, { x: 43, y: 10, w: 3 }],
    notes: [
      'Forty metres where the Nile leaves Lake Victoria.',
      'Piers, towers, cables: the full toolkit. Build it well.',
    ],
  },
];
/*LEVELS-END*/
