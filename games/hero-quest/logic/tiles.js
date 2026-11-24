// What each map character means. Rooms are 13 strings of 11 characters (see data.js).
//
//   .  floor / grass           ,  floor with decoration    :  path / carpet
//   #  wall or cliff           T  thick trees              Y  big tree (top-left of 2x2), y = rest of it
//   b  bush (sword cuts it)    r  rock                     w  water (things fly over it)
//   W  water that becomes a bridge when the room's crystal is hit       =  bridge
//   f  fence                   h  house (drawn from room.houses)        D  door / exit you walk into
//   e  cave mouth (walk in)    v  sign                     g  grave     ~  statue      t  torch
//   o  pot (sword breaks it)   x  floor switch (needs a block on it)    X  crystal switch (hit it)
//   P  push block (floor under it)                         C  chest (contents in room.chests)
//   k  locked door (small key) K  boss door (big key)      s  shutter (opened by this room's puzzle)
//   z  shutter that shuts while enemies are alive          c  cracked wall/rock (bombs open it)
//   l  shelf  q  bed  m  table  F  fireplace  _  counter  (house furniture, all solid)

export const WALKABLE = new Set(['.', ',', ':', '=', 'D', 'e', 'x', 'S']);
export const FLYOVER = new Set(['w', 'W']);   // the boomerang and thrown rocks pass over these
export const DOORS = new Set(['k', 'K', 's', 'z']);
export const SOLID_DECOR = new Set(['#', 'T', 'Y', 'y', 'b', 'r', 'w', 'f', 'h', 'v', 'g', '~', 't', 'o', 'X', 'C',
  'l', 'q', 'm', 'F', '_']);
export const ALL_CHARS = new Set([...WALKABLE, ...FLYOVER, ...DOORS, ...SOLID_DECOR, 'c', 'P', 'W']);

/** Cells the sword can break, and what they leave behind. */
export const BREAKABLE = { b: '.', o: '.' };
