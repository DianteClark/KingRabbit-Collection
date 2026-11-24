export const RULES = {
  title: 'Tiny Town Builder',
  sections: [
    { heading: 'Your job', text: 'You are the mayor of an empty valley with a highway running in. Lay out roads and zones, keep the power on and the people happy, and the town builds itself, house by house.' },
    {
      heading: 'Moving around',
      items: [
        'Drag the map to look around and pinch to zoom.',
        'While drawing roads, zones or bulldozing, one finger draws: use two fingers to move the map.',
        'Pick a tool from the bar at the bottom. Look (the hand) inspects anything you tap.',
        'Undo (bottom right) takes back your last few builds and refunds them.',
      ],
    },
    {
      heading: 'Building a town',
      items: [
        'Roads: drag to draw. Zones only grow within 3 tiles of a road.',
        'Zones: drag a rectangle. Green Residential = homes, blue Commercial = shops and offices, yellow Industrial = factories, brown Farm = fields that need no power.',
        'Power: buildings need it. Power flows along roads, through zones and buildings, and along power lines. Place plants touching a road or zone.',
        'Water: towers water everything nearby. Homes and shops need it to grow bigger than the smallest size.',
        'The RCI meter (top) shows what people want more of: bars up mean build more, bars down mean too much.',
      ],
    },
    {
      heading: 'Growing bigger',
      items: [
        'Buildings grow when there is demand, power, water and good land value.',
        'Land value rises with parks, schools, clinics, police, water views and landmarks, and falls with smoke, crime and traffic.',
        'Keep factories and coal plants away from homes: smoke drags everything down.',
        'Commuters drive from homes to the nearest jobs. Add road links and bus stops if traffic backs up.',
        'Population milestones (Village 250, Town 1,200, City 3,500, Metropolis 7,500) unlock bigger buildings, services and landmarks.',
      ],
    },
    {
      heading: 'Money',
      items: [
        'Taxes come in every month; services, roads and loans cost upkeep. Open More, then Money, to change tax rates by zone and funding by service.',
        'Low taxes make people want to move in; high taxes slow growth and lower happiness.',
        'Short on cash? Take a loan of $5,000 (up to 3). You pay it back over 5 years.',
      ],
    },
    {
      heading: 'Happiness and advisors',
      items: [
        'Happiness (the smiley at the top) comes from services, clean air, low crime, jobs, power, fair taxes and landmarks. Tap the population to see the breakdown.',
        'Your advisors post tips at the bottom of the screen. Tap the tip line to see them all.',
      ],
    },
    {
      heading: 'Disasters',
      items: [
        'Off by default for a calm game. Turn them on under More, then Risks.',
        'Fires spread unless a fire station is in range. Police drive off UFOs. Earthquakes, meteors and tornadoes leave rubble that gets cleared after a few months.',
        'In Sandbox you can also start any disaster yourself.',
      ],
    },
    {
      heading: 'Modes',
      items: [
        'Sandbox: build freely, no goals, no way to lose.',
        'Scenarios: reach a goal before time runs out. Your city saves itself as you play: tap Continue on the title screen to carry on.',
        'Time: tap the pause, 1x and 3x buttons at the top. Panels pause the game while open.',
      ],
    },
    { heading: 'Credits', text: 'Art: Tiny Tile Town and BAS Town by Aleksandr Makarov (iknowkingrabbit). Font: BoldPixels.' },
  ],
};
