import { STORY_DAYS } from './logic/data.js';

export const RULES = {
  title: "Alchemist's Shop",
  sections: [
    { heading: 'Your shop', text: `Aunt Hazel has left you her little potion shop. Brew potions, keep the townsfolk happy and pay the rent. On day ${STORY_DAYS} the town holds the Festival of Flasks: beat Madame Vex to become the town's champion alchemist. After that you can keep the shop open for as long as you like.` },
    {
      heading: 'Each day',
      items: [
        'Morning: gather ingredients, shop at the market and brew potions. Take as long as you like.',
        'Open the shop: customers come in one at a time and ask for something. Sell them a potion from your shelves.',
        'Night: see how the day went, pay the rent, and buy upgrades. Then sleep.',
        'Your game saves after every action. Leave any time and carry on later.',
      ],
    },
    {
      heading: 'Gathering',
      items: [
        'Tap a plant, rock or crystal to pick one ingredient. Each spot has a few picks a day (the dots), and your basket allows a few picks each morning.',
        'The Forest and the Cave open up later and have stronger ingredients.',
        'Gremlins and golems guard the rarest finds. Tap them to shoo them away (each tap uses a pick). They come back the next day.',
        'The market sells Rock Salt, Honeycomb, Sunwater and Fire Peppers, plus one special every day.',
      ],
    },
    {
      heading: 'Brewing',
      items: [
        'Put 2 or 3 ingredients in the cauldron. Each ingredient has element dots: Fire, Water, Earth, Air and Life.',
        'Add up the dots. If one element has at least twice as many dots as any other, you get its pure potion.',
        'Otherwise the two strongest elements make a pair potion (Fire + Water = Steam Elixir). If the 2nd and 3rd strongest are tied, you get Murky Sludge.',
        'Two legendary potions need rare ingredients from the guarded spots. The recipe book hints at them.',
        'Stir: tap STIR when the needle is in the green (gold is perfect). Three stirs decide 1 to 3 stars.',
        'A potent brew (7 or more dots in total) gets one extra star.',
        'Every new potion goes in your recipe book, with what each one is for.',
      ],
    },
    {
      heading: 'Selling',
      items: [
        'Listen to what the customer needs, check your recipe book and offer a matching potion.',
        'Pick a price. The fair price is shown; 3-star potions are worth more, 1-star potions less.',
        'Customers who ask for a strong potion want 2 stars or more. A weaker one sells for less and earns no thanks.',
        'Ask too much and they will haggle. Accept their offer, insist on your price (they may walk out), or let them go.',
        'Good matches at fair prices raise your reputation. Overcharging, insisting and sending story customers away lower it.',
        'More reputation brings more customers each day and opens the Cave.',
      ],
    },
    {
      heading: 'Money',
      items: [
        'Rent is due every night and slowly goes up. An apprentice also wants a wage.',
        'If you end a night in debt you get a warning. Three nights in debt in a row and the shop closes for good.',
        'Upgrades: a bigger cauldron makes more potions and makes stirring easier; a basket gives more picks; a sign brings more customers; shelves hold more potions; the apprentice brews for you each morning.',
      ],
    },
    {
      heading: 'The festival',
      items: [
        'Three rounds: a potion with Fire in it, a Healing Salve, and your finest potion. Elder Rowan announces the themes on day 20.',
        'Each round scores a matching potion, its stars and its value. Your reputation adds a bonus at the end.',
        'Keep your best potions back for the big day!',
      ],
    },
    { heading: 'Credits', text: 'Art by Aleksandr Makarov (LAS Alchemist Lab and LAS Adventure Pack). Font BoldPixels by YukiPixels (CC BY-SA 4.0). Music and sounds made in code.' },
  ],
};
