// The MAS (Mini Asset Series) palette, read straight from the sprite sheets' colour swatches.
export const PALETTE = {
  ink: '#040303',
  night: '#1c1618',
  indigo: '#47416b',
  leaf: '#6c8c50',
  gold: '#e3d245',
  orange: '#d88038',
  red: '#a13d3b',
  wine: '#4e282e',
  plum: '#9a407e',
  sand: '#f0d472',
  cream: '#f9f5ef',
  lavender: '#8a8fc4',
};

/** '#rrggbb' -> 0xrrggbb for Phaser shapes. */
export const hex = (c) => parseInt(c.slice(1), 16);
