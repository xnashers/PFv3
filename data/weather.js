export const WEATHER_TYPES = [
  { id: 'sunny', name: 'Sunny', emoji: '☀️', mutation: 'Sun-Kissed', mutationEmoji: '🌟', priceBonus: 8, weight: 25 },
  { id: 'rain', name: 'Rain', emoji: '🌧️', mutation: 'Waterlogged', mutationEmoji: '💧', priceBonus: 15, weight: 20 },
  { id: 'heatwave', name: 'Heatwave', emoji: '🔥', mutation: 'Scorched', mutationEmoji: '🔥', priceBonus: 30, weight: 10 },
  { id: 'windstorm', name: 'Windstorm', emoji: '🌪️', mutation: 'Windblown', mutationEmoji: '💨', priceBonus: 20, weight: 10 },
  { id: 'fog', name: 'Fog', emoji: '🌫️', mutation: 'Misty', mutationEmoji: '👻', priceBonus: 25, weight: 12 },
  { id: 'cherry', name: 'Cherry Blossom', emoji: '🌸', mutation: 'Blooming', mutationEmoji: '🌸', priceBonus: 50, weight: 8 },
  { id: 'thunderstorm', name: 'Thunderstorm', emoji: '⛈️', mutation: 'Shocked', mutationEmoji: '⚡', priceBonus: 35, weight: 8 },
  { id: 'autumn', name: 'Autumn Wind', emoji: '🍂', mutation: 'Autumn', mutationEmoji: '🍁', priceBonus: 40, weight: 5 },
  { id: 'snow', name: 'Snow', emoji: '❄️', mutation: 'Frozen', mutationEmoji: '🧊', priceBonus: 45, weight: 5 },
  { id: 'fullmoon', name: 'Full Moon', emoji: '🌙', mutation: 'Moonlit', mutationEmoji: '🌙', priceBonus: 80, weight: 4 },
  { id: 'rainbow', name: 'Rainbow', emoji: '🌈', mutation: 'Rainbow', mutationEmoji: '🌈', priceBonus: 65, weight: 3 },
  { id: 'meteor', name: 'Meteor Shower', emoji: '☄️', mutation: 'Cosmic', mutationEmoji: '☄️', priceBonus: 120, weight: 3 },
  { id: 'aurora', name: 'Aurora', emoji: '✨', mutation: 'Aurora', mutationEmoji: '💜', priceBonus: 160, weight: 2 },
  { id: 'eclipse', name: 'Eclipse', emoji: '🌌', mutation: 'Eclipse', mutationEmoji: '🌑', priceBonus: 200, weight: 1 },
  { id: 'divine', name: 'Divine Weather', emoji: '👑', mutation: 'Divine', mutationEmoji: '✨', priceBonus: 400, weight: 0.5 },
];

export const SECRET_MUTATIONS = [
  { id: 'lunar_prism', name: 'Lunar Prism', emoji: '🌌', requires: ['rainbow', 'fullmoon'], priceBonus: 150 },
  { id: 'galactic_storm', name: 'Galactic Storm', emoji: '⚡', requires: ['thunderstorm', 'meteor'], priceBonus: 200 },
  { id: 'crystal', name: 'Crystal', emoji: '💎', requires: ['snow', 'aurora'], priceBonus: 250 },
  { id: 'celestial', name: 'Celestial', emoji: '👑', requires: ['eclipse', 'divine'], priceBonus: 500 },
];

export const WEATHER_CHANGE_INTERVAL = 120000;
export const MUTATION_CHANCE = 0.7;
