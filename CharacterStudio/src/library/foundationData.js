export const FOUNDATION_CATEGORIES = [
  {
    id: "fantasy-sci-fi",
    name: "Fantasy / Sci-Fi",
    description: "Mythic lineages and speculative lifeforms",
    index: "01",
  },
  {
    id: "animals-beasts",
    name: "Animals / Beasts",
    description: "Wild forms, ancient megafauna, and legendary predators",
    index: "02",
  },
]

export const builtInSpecies = [
  { id: "human", name: "Human", category: "fantasy-sci-fi", description: "An adaptable, familiar starting point for new lineages.", imageSrc: null },
  { id: "elf", name: "Elf", category: "fantasy-sci-fi", description: "A graceful lineage shaped by long memory and keen senses.", imageSrc: null },
  { id: "dwarf", name: "Dwarf", category: "fantasy-sci-fi", description: "A sturdy people with deep ties to craft and stone.", imageSrc: null },
  { id: "orc", name: "Orc", category: "fantasy-sci-fi", description: "A powerful lineage with a strong physical presence.", imageSrc: null },
  { id: "goblin", name: "Goblin", category: "fantasy-sci-fi", description: "A compact, quick-witted people built for resourcefulness.", imageSrc: null },
  { id: "halfling", name: "Halfling", category: "fantasy-sci-fi", description: "A small, nimble lineage with a grounded nature.", imageSrc: null },
  { id: "giant", name: "Giant", category: "fantasy-sci-fi", description: "A monumental form defined by scale and strength.", imageSrc: null },
  { id: "dragonkin", name: "Dragonkin", category: "fantasy-sci-fi", description: "A draconic humanoid lineage with a commanding silhouette.", imageSrc: null },
  { id: "troll", name: "Troll", category: "fantasy-sci-fi", description: "A resilient, broad-framed creature with formidable presence.", imageSrc: null },
  { id: "vampire", name: "Vampire", category: "fantasy-sci-fi", description: "An uncanny lineage with a poised, nocturnal bearing.", imageSrc: null },
  { id: "werewolf", name: "Werewolf", category: "fantasy-sci-fi", description: "A shifting form that bridges human and wolf-like traits.", imageSrc: null },
  { id: "demon", name: "Demon", category: "fantasy-sci-fi", description: "An otherworldly being with a striking, unconventional form.", imageSrc: null },
  { id: "celestial", name: "Celestial", category: "fantasy-sci-fi", description: "A radiant lineage marked by an elevated, ethereal presence.", imageSrc: null },
  { id: "beastfolk", name: "Beastfolk", category: "fantasy-sci-fi", description: "A flexible foundation for people with animal traits.", imageSrc: null },
  { id: "alien", name: "Alien", category: "fantasy-sci-fi", description: "A speculative lifeform with unfamiliar anatomy and features.", imageSrc: null },
  { id: "wolf", name: "Wolf", category: "animals-beasts", description: "A social predator with a lean, enduring build.", imageSrc: null },
  { id: "lion", name: "Lion", category: "animals-beasts", description: "A powerful feline form with a commanding profile.", imageSrc: null },
  { id: "tiger", name: "Tiger", category: "animals-beasts", description: "A solitary hunter with a muscular, agile frame.", imageSrc: null },
  { id: "bear", name: "Bear", category: "animals-beasts", description: "A large, robust form built for strength and endurance.", imageSrc: null },
  { id: "eagle", name: "Eagle", category: "animals-beasts", description: "A keen-eyed raptor with a powerful winged silhouette.", imageSrc: null },
  { id: "raven", name: "Raven", category: "animals-beasts", description: "An intelligent corvid with a distinctive, light frame.", imageSrc: null },
  { id: "serpent", name: "Serpent", category: "animals-beasts", description: "A sinuous reptilian form defined by fluid movement.", imageSrc: null },
  { id: "crocodile", name: "Crocodile", category: "animals-beasts", description: "An armored reptile with a powerful, low-slung form.", imageSrc: null },
  { id: "shark", name: "Shark", category: "animals-beasts", description: "A streamlined aquatic predator with a distinctive profile.", imageSrc: null },
  { id: "panther", name: "Panther", category: "animals-beasts", description: "A stealthy feline form with a sleek, athletic build.", imageSrc: null },
  { id: "boar", name: "Boar", category: "animals-beasts", description: "A sturdy wild form with a strong, compact frame.", imageSrc: null },
  { id: "aurochs", name: "Aurochs", category: "animals-beasts", description: "An ancient wild bovine with an imposing build.", imageSrc: null },
  { id: "mammoth", name: "Mammoth", category: "animals-beasts", description: "A massive prehistoric form with a broad, heavy silhouette.", imageSrc: null },
  { id: "dire-wolf", name: "Dire Wolf", category: "animals-beasts", description: "A larger, more formidable wolf-like foundation.", imageSrc: null },
  { id: "dragon", name: "Dragon", category: "animals-beasts", description: "A legendary scaled creature with a vast, powerful form.", imageSrc: null },
]

export const foundations = builtInSpecies

export const createCharacterSpeciesCatalog = (userCreatedSpecies = []) => ({
  builtInSpecies,
  userCreatedSpecies,
})

export const getFoundationById = (id) => foundations.find((foundation) => foundation.id === id) ?? null