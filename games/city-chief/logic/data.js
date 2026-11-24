// Names, call types and text for City Chief.

export const FIRST = ['Ana', 'Ben', 'Cara', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivan', 'Jo', 'Kai', 'Lena', 'Marco', 'Nia', 'Omar', 'Pia',
  'Quinn', 'Rosa', 'Sam', 'Tess', 'Uri', 'Vic', 'Wes', 'Xena', 'Yara', 'Zed', 'Abe', 'Bea', 'Cole', 'Dina', 'Ezra', 'Gwen', 'Hugo', 'Iris', 'Jack', 'Kira'];
export const LAST = ['Reyes', 'Novak', 'Park', 'Okafor', 'Haas', 'Brennan', 'Silva', 'Kowal', 'Duarte', 'Lind', 'Moss', 'Tanaka', 'Price', 'Abara',
  'Quist', 'Ruiz', 'Stone', 'Ferro', 'Vance', 'Wolfe', 'Yoon', 'Adler', 'Bishop', 'Cruz', 'Doyle', 'Eng', 'Frost', 'Grady', 'Holt', 'Ito', 'Keller', 'Lowe'];

export const RANKS = {
  rookie: { title: 'Rookie', short: 'Rk.', pay: 80 },
  officer: { title: 'Officer', short: 'Ofc.', pay: 100 },
  sergeant: { title: 'Sergeant', short: 'Sgt.', pay: 125 },
  detective: { title: 'Detective', short: 'Det.', pay: 135 },
};

export const STREETS_H = ['Pine St', 'Main St', 'Elm St', 'Canal St', 'Dock Rd'];
export const STREETS_V = ['1st Ave', '2nd Ave', '3rd Ave', '4th Ave'];
export const SHOPS = ["Lou's Bar", 'Quick Mart', "Sal's Diner", 'Pawn & Loan', 'Gold Rush Jewelers', 'Corner Pharmacy', 'Lucky Liquor', 'Night Owl Club', 'Bargain Electronics', 'Rosie\'s Bakery'];

// Organised crime, from small to big. Each type unlocks on a later day.
export const GROUP_TYPES = {
  gang: { title: 'Street gang', day: 2, strength: 25, names: ['Rust Vipers', 'Dock Rats', 'Neon Saints', 'Low Riders', 'Ninth Street Kings', 'Alley Cats'] },
  drugs: { title: 'Drug ring', day: 5, strength: 35, names: ['The Sugar Line', 'Blue Moon Crew', "The Chemist's Ring", 'Snowmen'] },
  mob: { title: 'Mob', day: 9, strength: 50, names: ['The Grayline Syndicate', 'The Silk Glove Mob', 'The Canal Street Outfit'] },
  mafia: { title: 'Mafia family', day: 14, strength: 70, names: ['The Marlowe Family', 'The Vance Family', 'The Corvin Family'] },
};

/**
 * Call types. d = how many average patrol cars it takes (the call text always gives a clue).
 * flee = chance suspects drive off (a car chase); risk = chance of officers getting hurt.
 */
export const CALLS = {
  noise: { name: 'Noise complaint', icon: 'speech', d: () => 1, risk: 0, dur: [8, 16], patience: 70,
    text: ({ street }) => `Neighbours on ${street} report a party that won't quit.` },
  shoplift: { name: 'Shoplifting', icon: 'bag', d: () => 1, risk: 0, dur: [10, 18], patience: 50,
    text: ({ shop }) => `The owner of ${shop} is holding a shoplifter at the till.` },
  vandal: { name: 'Vandalism', icon: 'spray', d: () => 1, risk: 0, dur: [8, 15], patience: 45,
    text: ({ street }) => `Kids spray-painting walls on ${street}.` },
  breakin: { name: 'Car break-in', icon: 'car', d: () => 1, risk: 0.02, dur: [10, 20], patience: 40,
    text: ({ street }) => `Someone is smashing car windows on ${street}. One suspect.` },
  accident: { name: 'Traffic accident', icon: 'crash', d: () => 1, risk: 0, dur: [15, 25], patience: 60, ambulance: true,
    text: ({ street }) => `Two cars collided on ${street}. Traffic is backing up.` },
  burglary: { name: 'Burglary', icon: 'house', d: (n) => n, n: [2, 2], risk: 0.06, dur: [15, 25], patience: 45,
    text: ({ street, n }) => `House alarm on ${street}. ${n} people seen climbing in a window.` },
  assault: { name: 'Assault', icon: 'fist', d: (n) => n, n: [2, 2], risk: 0.1, dur: [12, 22], patience: 35, ambulance: true,
    text: ({ shop, n }) => `A fight outside ${shop}: ${n} men swinging, one is bleeding.` },
  domestic: { name: 'Domestic call', icon: 'house', d: () => 2, risk: 0.12, dur: [15, 25], patience: 40,
    text: ({ street }) => `Screaming and breaking glass in an apartment on ${street}. Caller thinks there's a gun.` },
  cartheft: { name: 'Car theft', icon: 'car', d: () => 2, risk: 0.04, flee: 0.65, dur: [10, 18], patience: 30,
    text: ({ street }) => `A car was just stolen on ${street}. The thief is still nearby and driving fast.` },
  drugdeal: { name: 'Drug dealing', icon: 'pill', d: (n) => n, n: [2, 3], risk: 0.1, flee: 0.25, dur: [15, 25], patience: 40, gang: true,
    text: ({ street, n }) => `${n} dealers working the corner of ${street}, lookouts on both ends.` },
  robbery: { name: 'Armed robbery', icon: 'gun', d: (n) => n, n: [3, 4], risk: 0.22, flee: 0.45, dur: [15, 25], patience: 30, gang: true,
    text: ({ shop, n }) => `${n} armed men are robbing ${shop} right now.` },
  gangfight: { name: 'Gang fight', icon: 'fist', d: (n) => Math.ceil(n / 3) + 1, n: [6, 10], risk: 0.28, dur: [20, 30], patience: 35, gang: true, ambulance: true,
    text: ({ street, n, group }) => `${n} people brawling on ${street}${group ? `, ${group} colours seen` : ''}. Weapons out.` },
  shooting: { name: 'Shots fired', icon: 'gun', d: () => 4, risk: 0.3, flee: 0.35, dur: [20, 30], patience: 30, gang: true, ambulance: true,
    text: ({ street }) => `Several shots fired near ${street}. Callers say a car sped off and someone is down.` },
};

/** How common each call is: [minor weight, needs gangs?]. */
export const CALL_WEIGHTS = {
  noise: 10, shoplift: 9, vandal: 7, breakin: 8, accident: 6,
  burglary: 6, assault: 5, domestic: 4, cartheft: 5, drugdeal: 3, robbery: 2.5, gangfight: 1, shooting: 0.8,
};

export const HQ_NAMES = { hq: 'Police HQ', bank: 'First City Bank', fire: 'Fire Station', hospital: 'Mercy Hospital', jail: 'County Jail' };

export const MAYOR = 'Mayor Hollis';
