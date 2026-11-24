# KingRabbit Asset Pack: Sorted Guide

> **Folder names in this repo:** the groups below live in `shared/assets/` as
> `has-heroic-fantasy`, `mas-mini-retro`, `las-zelda-adventure`, `pangea-strategy`,
> `modern-city`, `battle-of-the-sands`, `pocketpets`, `soccer`, `controllers` and
> `nes-overworld`. Spaces and brackets in file names were replaced with dashes so
> they work in web URLs. Each pack folder has a `PREVIEW.png` contact sheet.


All art is by Aleksandr Makarov ("iknowkingrabbit"). His packs follow a naming scheme that also tells you the art style:

- **HAS**: heroic fantasy at 16×16, styled after Heroes of Might & Magic.
- **MAS**: tiny 8×8 retro art with a limited palette.
- **LAS**: top-down adventure in the style of Zelda.
- **BAS / RAS / Pangea / others**: standalone styles.

Every pack folder has a `PREVIEW.png` contact sheet. Older versions of a pack are kept in `_Older Versions` folders.

**License:** credit Aleksandr Makarov in your game. You can modify the art, but you can't resell or redistribute the raw assets. Read each pack's license.txt.

---

## 01 HAS: Heroic Fantasy (the big one)
**Style:** 16×16 top-down overworld with chunky readable sprites. It's the same art family as Heroes of Might & Magic 1–3. All of these packs mix together cleanly.

| Sub-folder | What's in it |
|---|---|
| A Terrain & World Maps | Overworld 2.1 has 7 biomes (grass, ice, dirt, sand, marsh, lava, cave), animated rivers and coasts, trees, and mountains. HeroicTileset is the older 1.x version. Dungeon has interior and overworld dungeon tiles. Battlegrounds has side-view battle backdrops. The Christmas pack has snow tiles, festive characters and UI. |
| B Factions | Creature Pack has 8 HoMM-style towns (Castle, Rampart, Tower, Inferno, Necromancer, Stronghold, and more) with idle, walk, attack, hit and death animations. Hero Pack has mounted heroes for each faction. Dwarves, Lizardmen (Enclave), Orcs, Wood Elves and Wildlife each add units, heroes, buildings, a tileset and portraits. |
| C Buildings & Towns | Mines, treasure, map buildings that change your stats (shrines, libraries, arenas) and castles |
| D Magic, Items & UI | Magic Book has 60+ animated spells and a spellbook UI. IconPack has about 2,600 16×16 equipment and skill icons. UI Pack has frames, buttons, and keyboard and gamepad prompts. |
| E HAS2020 | Everything above merged into one organized set (biomes, buildings, creatures, heroes, spells, items, UI). **Start here.** |
| F Hex Map | A Unity project with hex terrain, rivers, roads and trees. Open it in Unity; the Library cache will rebuild. |
| G HASvania | A side-view Castlevania-style spin-off with a castle tileset, enemies and NPCs |
| H Patron Requests (WR) | Extra HAS content: winter tileset, elementals, bosses, peasants, walls and gates, docks, ships, a railroad, a beach, Mrs. Claus, and a font |

**Games you can make:**
- A turn-based strategy game like Heroes of Might & Magic (this is exactly what it was built for)
- An overworld exploration RPG or JRPG
- A 4X fantasy kingdom builder
- Auto-battlers and tactics games with faction armies
- Roguelite map-crawlers in the style of Slay the Spire, but with an overworld
- A dungeon crawler
- An RTS (the Orcs and Lizardmen "Empire" packs include buildings and roads)
- An idle or kingdom-management game
- A Metroidvania (HASvania)
- A hex-based wargame (HEX)
- Seasonal or holiday spin-offs (Christmas pack, winter request)

## 02 MAS: Mini Retro (8×8)
**Style:** very small sprites with a strict palette, like Game Boy, PICO-8 or 1-bit games.

| Pack | What it is → Game type |
|---|---|
| MAS Roguelike / RAS Overworld | Dungeon tiles, heroes, monsters and weapons. RAS is the same art redrawn at 16×16. → **Traditional roguelike** (like Rogue or Brogue), dungeon crawler |
| MAS Space Roguelike | Sci-fi version with crew, aliens and a ship interior → **Space roguelike**, FTL-like |
| MAS Darkness Pack | 4-colour dark fantasy creatures, bosses and items → **Horror roguelike**, Game Boy-style RPG |
| MAS MegaBoy | Robot hero and tech tilesets → **Mega Man-style platformer** |
| MAS Overworld | Seasonal tiles (summer, spring, winter, fall) in PICO-8 and DB16 palettes → **Small farming or adventure game**, PICO-8 projects |
| MASRobbox | Robot, conveyors and lab tiles → **Sokoban or box-pushing puzzle game** |
| MASFunPack | Chess, cards, Uno-style, Yacht dice and tic-tac-toe → **Classic board and card game collection** |

## 03 LAS: Zelda-style Adventure (16×16 top-down)
| Pack | Game type |
|---|---|
| LAS Adventure Pack | Town, forest, caves, NPCs, items, and a fully animated hero → **Action-adventure like Zelda: A Link to the Past**, cozy RPG |
| LAS AlchemistLab | Lab interiors, crystal caves, an alchemist NPC and a golem enemy → **Dungeon add-on**, potion-crafting game |
| MinishAssetPack | Bright, Minish Cap-style tiles, characters, enemies, animals and weapons → **Zelda-like**, top-down action RPG |

## 04 Pangea: Civilization-style Strategy
**Pangea / NewPangea** have 26 unit types from Phalanx up to Mech and Nuclear, plus technologies, leaders, wonders, towns, a train, resources and fog of war. **Pangea Wars** has 4 colour-coded armies of modern units (infantry, tanks, planes, ships).

**Games:**
- A **Civilization-style 4X game**
- A turn-based wargame like **Advance Wars** (Pangea Wars)
- A history or tech-tree strategy game

## 05 Modern City Builder
**BAS Town** has city buildings (police, fire, health, power, water, garbage), cars, people and zoning icons. **TinyTileTown** has residential, commercial and industrial buildings, farms, an airport, vehicles, and disasters (meteor, tornado, UFO, earthquake).

**Games:**
- A **SimCity-style city builder**
- A tycoon or management game
- A top-down traffic game, or a GTA-1-style game (BAS cars)

## 06 Battle of the Sands
A sci-fi desert setting with 4 colour teams, buildings, harvesters, tanks and recon units. → A **Dune II / Command & Conquer-style RTS**

## 07 PocketPets
Tamagotchi shells, pets, LCD icons and screen effects → A **virtual-pet game**

## 08 SportSeries Soccer (test asset)
Top-down players with 8-direction run, kick and tackle animations, and a field → A **Sensible Soccer-style arcade football game**. This is an early test pack, so it's incomplete.

## 09 Classic Controller Pack
Line-art icons for every console controller, from NES through Xbox, PlayStation, Switch and VR → **Input prompts, settings menus and tutorials** for any game

## 10 NES Overworld
Raw NES data files (CHR, NAM, PAL) → A real **NES homebrew** game, built with tools like NEXXT or NESmaker

---

## Notes
- **Mixing styles:** HAS, LAS and Pangea are all 16×16 and blend reasonably well. MAS (8×8) should stay on its own unless you scale it up 2×.
- **Not included:** the original ZIP folder, because every archive was extracted into the folders above; old game-save backups from Overworld 2.1; and Unity's regenerable `Library` cache.
