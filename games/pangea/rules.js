// How to Play text, shown by the gold "?" button on every screen.
import { BASE_JOY } from './logic/game.js';
import { LUXURY_JOY } from './logic/data.js';

export const RULES = {
  title: 'Pangea',
  sections: [
    {
      heading: 'Goal',
      items: [
        'Grow a small tribe into a great civilization. There are three ways to win:',
        'Conquest: hold every rival\'s first capital (or wipe them out).',
        'Science: research Spaceflight and build the Space Ark wonder.',
        'Score: have the best score when the last turn ends (turn 100 or 150). Score counts citizens, cities, techs, wonders and land.',
        'You lose if all your cities are taken, or if a rival wins first.',
      ],
    },
    {
      heading: 'Your turn',
      items: [
        'Drag the map to look around. Pinch, or use the + and - buttons, to zoom.',
        'Tap one of your units to select it. Light tiles show where it can move this turn. Tap a tile to move there; a far tile sends the unit there over several turns.',
        'Buttons at the bottom give orders: Found City, Farm, Mine, Fortify, Skip and more. Next jumps to a unit that still needs orders.',
        'Tap End Turn when you are done. Your cities grow, build and research, then the rivals move.',
      ],
    },
    {
      heading: 'Cities',
      items: [
        'Settlers found cities (at least 3 tiles from any other city). A Settler costs 1 citizen, so the city must be size 2 or more.',
        'Each citizen works one tile inside your borders for food, production and gold. Every citizen eats 2 food; extra food makes the city grow.',
        'Tap a city to open it: pick what to build (a queue of up to 6), buy the current item with gold, or set a focus (food, production or gold).',
        'Culture slowly pushes a city\'s borders out, one tile at a time.',
        'Cities stop at size 8 until they have an Aqueduct.',
      ],
    },
    {
      heading: 'Happiness',
      items: [
        `Your people start with ${BASE_JOY} happiness. Each city costs 2 and each citizen costs 1.`,
        `Each kind of luxury (gems, gold, furs) inside your borders adds ${LUXURY_JOY}. Temples, Colosseums, Cathedrals and some wonders add more.`,
        'Below zero (the face at the top turns sad) your cities stop growing. At -5 production drops and at -10 your army fights worse. So don\'t found cities faster than you can keep people happy.',
      ],
    },
    {
      heading: 'Gold and upkeep',
      items: [
        'Gold comes from tiles, bigger cities, markets and trade pacts.',
        'Buildings cost gold every turn. A few units are free (3, plus 1.5 per city); each extra unit costs 1 gold a turn.',
        'If your gold runs out, units are disbanded and then buildings are sold.',
      ],
    },
    {
      heading: 'Workers',
      items: [
        'Workers improve tiles inside your borders: Farm (+1 food) on open land, Mine (+2 production) on hills, or chop a forest for 20 production in the nearest city.',
        'Moving a worker stops its job.',
      ],
    },
    {
      heading: 'Research',
      items: [
        'Tap Tech to pick what to study. 27 techs over four eras unlock units, buildings and wonders.',
        'Pick a tech further down the tree and your scholars study the techs it needs first.',
        'Map Making lets land units cross water (they are weak at sea and can\'t attack from it).',
      ],
    },
    {
      heading: 'War',
      items: [
        'Tap an enemy next to your selected unit to see the battle odds first: each side\'s strength with every bonus, and your chance to win. Nothing happens until you tap Attack.',
        'A battle is fought to the end: one unit is destroyed. The winner keeps its damage and heals while resting (fastest in a city).',
        'Defenders get bonuses for hills (+50%), forest (+25%), fortifying (+25%), being in a city (+25%) and walls (+75%). Spearmen are strong against mounted units; catapults, cannons and artillery against cities.',
        'Walk a unit into an enemy city with no defender to capture it. Walking onto a lone enemy worker or settler captures it (a settler becomes a worker).',
        'Attacking a civ you are at peace with declares war, and peace can only be signed after 8 turns of war.',
      ],
    },
    {
      heading: 'Rivals and diplomacy',
      items: [
        'Tap Rivals to see the civs you have met, how they feel about you, and to talk: declare war, propose peace, sign a trade pact (+3 gold a turn for both), swap technologies or send a gift.',
        'Rivals have personalities: some love war, some love science or new cities. Sharing a border makes them wary; gifts, pacts and common enemies make them friendly.',
      ],
    },
    {
      heading: 'Modes',
      items: [
        'New Game: you and 2-4 computer rivals on a small or medium map, quick (100 turns) or standard (150 turns).',
        'Guided first game: a small map with two calm rivals and tips that walk you through the first turns.',
        'Pass and Play: 2-4 people take turns on one phone (with or without computer rivals). The map hides between turns.',
      ],
    },
    { heading: 'Saving', text: 'The game saves after every move and every turn. Close the page any time and tap Continue to carry on.' },
    { heading: 'Credits', text: 'Art: the Pangea packs by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels by YukiPixels. Civilizations and leaders are made up.' },
    { heading: 'Controller', text: 'On the title screen, in menus, panels and popups the d-pad moves a gold frame over the buttons, A taps it and B goes back. Playing on the map is still done by touch.' },
  ],
};
