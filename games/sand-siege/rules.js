// How to Play text, shown by the gold "?" button on every screen.
import { TOWERS, TOWER_ORDER, ENEMIES, ENEMY_ORDER, POWERS, POWER_ORDER } from './logic/data.js';

const towerLine = (k) => {
  const t = TOWERS[k];
  return `${t.name} (${t.cost}): ${t.blurb} Specialties: ${t.branches.map((b) => b.name).join(' or ')}.`;
};
const enemyLine = (k) => `${ENEMIES[k].name}: ${ENEMIES[k].blurb}`;

export const RULES = {
  title: 'Sand Siege',
  sections: [
    { heading: 'Goal', text: 'Red columns march down the map toward your base at the bottom. Build towers to stop them. Each enemy that gets through costs lives (bosses cost 10). Survive every wave to win the map.' },
    {
      heading: 'Building',
      items: [
        'Tap a tower at the bottom, then tap a sand tile. The circle shows what it will reach.',
        'Tap Build (or the same tile again) to build it. Tap the tower button again to cancel.',
        'Tap a tower on the map to upgrade it, change its target or sell it.',
        'Every tower has two upgrades, then a choice of two specialties.',
        'Selling gives back 70% of what you spent (all of it before the first wave).',
      ],
    },
    {
      heading: 'Waves',
      items: [
        'Tap Send Wave to start. After each wave a countdown runs to the next one.',
        'Send the next wave early to earn bonus funds: 2 for every second left on the countdown.',
        'Every wave also pays a small bonus, and kills pay funds.',
        'Tap the wave counter at the top to see what is coming next.',
        '2x speeds the game up. The < button pauses.',
      ],
    },
    {
      heading: 'Targets',
      items: [
        'First: the enemy closest to your base (the default).',
        'Last: the newest arrival. Strong: the toughest (bosses and medics first). Close: the nearest.',
      ],
    },
    {
      heading: 'Maze maps',
      text: 'On maps with no road the enemy walks the shortest way to your base and your towers are the walls. The dotted line shows the route. You can never close the way completely: the game will not let you build a tower that blocks it.',
    },
    { heading: 'Towers', items: TOWER_ORDER.map(towerLine) },
    { heading: 'Enemies', items: [...ENEMY_ORDER.map(enemyLine), 'Armour is taken off every hit, so small fast bullets do little to tanks. Flyers ignore the road.'] },
    { heading: 'Support powers', items: [...POWER_ORDER.map((k) => `${POWERS[k].name} (after map ${POWERS[k].unlock}, every ${POWERS[k].cd}s): ${POWERS[k].desc}`)] },
    {
      heading: 'Stars and modes',
      items: [
        'Win a map to unlock the next. Stars: 3 for losing 2 lives or fewer, 2 for keeping at least half.',
        'Winning a map unlocks Hard (tougher enemies, 10 lives) and Endless (waves forever) for it.',
        'Daily Siege: a new map with two twists every day, the same for everyone. Score 100 per wave held, plus 25 per life left if you win.',
      ],
    },
    { heading: 'Saving', text: 'The game saves as you play, even in the middle of a wave. Close the page any time and tap Continue.' },
    { heading: 'Credits', text: 'Art: Battle of the Sands by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels by YukiPixels.' },
    { heading: 'Controller', text: 'In menus and popups the d-pad moves a gold frame over the buttons, A taps it and B goes back. Building on the map is still done by touch.' },
  ],
};
