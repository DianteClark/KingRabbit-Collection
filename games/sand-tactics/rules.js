// How to Play text, shown by the gold "?" button on every screen.
import { UNITS, UNIT_ORDER, TERRAIN } from './logic/data.js';

const unitLine = (t) => {
  const u = UNITS[t];
  const range = u.range[1] > 1 ? `, fires ${u.range[0]}-${u.range[1]} tiles away` : '';
  return `${u.name} (${u.cost}): moves ${u.move}${range}. ${u.blurb}`;
};

const terrainLine = (k, extra) => `${TERRAIN[k].name}: ${'*'.repeat(TERRAIN[k].def) || 'no'} defence. ${extra}`;

export const RULES = {
  title: 'Sand Tactics',
  sections: [
    { heading: 'Goal', text: 'Capture the enemy HQ or destroy every enemy unit. Some missions have their own goal, like holding out for a number of days.' },
    {
      heading: 'Your turn',
      items: [
        'Drag the map to look around. Tap one of your units to see where it can go (blue) and what it could hit (red).',
        'Tap a blue tile to move there (or Act here to stay put). Then pick Fire, Capture or Wait at the bottom. Undo puts the unit back if you change your mind.',
        'Tap an enemy inside the red area to move next to it and see the battle forecast. Nothing happens until you tap Fire.',
        'Each unit acts once per turn and then greys out. Tap End Turn when you are done. Next jumps to a unit that can still act.',
        'Tap an enemy unit to see how far it can move and strike next turn.',
      ],
    },
    {
      heading: 'Combat',
      items: [
        'Damage depends on the two unit types, the attacker\'s health and the defender\'s terrain. The forecast shows it before you fire.',
        'Health is shown from 1 to 10. A hurt unit hits weaker.',
        'A unit that survives a close attack strikes back. Artillery fires from 2-3 tiles away, can\'t strike back, and can\'t move and fire in the same turn.',
        'Gang up on one target at a time: finished-off units can\'t shoot back next turn.',
      ],
    },
    {
      heading: 'Buildings and funds',
      items: [
        'Every building you own pays 1000 funds at the start of your turn.',
        'Infantry, Scouts and Lancers can capture buildings. Capturing takes 20 points; each turn removes the squad\'s health (1-10). Moving away resets it.',
        'Tap one of your empty factories to build a unit. New units can move next turn. Each side can field up to 30 units.',
        'Units starting their turn on one of your buildings repair 2 health (paid from your funds).',
      ],
    },
    { heading: 'Units', items: UNIT_ORDER.map(unitLine) },
    {
      heading: 'Terrain',
      items: [
        terrainLine('sand', 'Wheels move slower.'),
        terrainLine('dunes', 'Slows tanks and wheels. Harvesters earn funds here.'),
        terrainLine('oasis', 'Slows tanks and wheels.'),
        terrainLine('mesa', 'Only foot soldiers and drones. Lancers climb fast.'),
        terrainLine('water', 'Only drones fly over.'),
        terrainLine('city', 'Factories 3, HQ 4.'),
        'Drones get no terrain defence.',
      ],
    },
    {
      heading: 'Modes',
      items: [
        'Campaign: 8 missions with rising difficulty. Win one to unlock the next.',
        'Skirmish: you (Blue) against the computer on a fair map.',
        '2 Players: pass the phone between turns. Blue moves first.',
        'In Skirmish and 2 Players, moving first is an edge, so Blue gets no income on day 1 and Red starts with 1000 extra funds.',
      ],
    },
    { heading: 'Saving', text: 'The battle saves itself after every move. Close the page any time and tap Continue to pick up where you left off.' },
    { heading: 'Credits', text: 'Art: Battle of the Sands by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels by YukiPixels.' },
  ],
};
