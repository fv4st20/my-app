import { SiderealTime, Equator, Body, Observer, Constellation } from 'astronomy-engine';

// Helper: Calculate spherical angular distance in degrees
export function angularDistanceDeg(ra1Deg, dec1Deg, ra2Deg, dec2Deg) {
  const rad = Math.PI / 180;
  const dLat = (dec2Deg - dec1Deg) * rad;
  const dLon = (ra2Deg - ra1Deg) * rad;
  const lat1 = dec1Deg * rad;
  const lat2 = dec2Deg * rad;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return c * (180 / Math.PI);
}

// Get the zenith coordinates (Right Ascension and Declination) for a given location and time.
export function getZenithCoordinates(latitude, longitude, date = new Date()) {
  // LST is in hours (0 to 24)
  const lst = SiderealTime(date);
  
  // Convert longitude degrees to hours
  let localSiderealTime = lst + (longitude / 15.0);
  while (localSiderealTime < 0) localSiderealTime += 24.0;
  while (localSiderealTime >= 24) localSiderealTime -= 24.0;
  
  // RA is equal to LST (in hours), convert to degrees (1 hour = 15 degrees)
  const ra = localSiderealTime * 15.0;
  
  // Declination is equal to latitude
  const dec = latitude;

  return { ra, dec, localSiderealTime };
}

// Major Constellation Descriptions and Lore
export const CONSTELLATION_NAMES = {
  And: { name: 'Andromeda', title: 'The Chained Maiden' },
  Ant: { name: 'Antlia', title: 'The Air Pump' },
  Aps: { name: 'Apus', title: 'The Bird of Paradise' },
  Aqr: { name: 'Aquarius', title: 'The Water Bearer' },
  Aql: { name: 'Aquila', title: 'The Celestial Eagle' },
  Ara: { name: 'Ara', title: 'The Altar' },
  Ari: { name: 'Aries', title: 'The Golden Ram' },
  Aur: { name: 'Auriga', title: 'The Charioteer' },
  Boo: { name: 'Boötes', title: 'The Herdsman' },
  Cae: { name: 'Caelum', title: 'The Chisel' },
  Cam: { name: 'Camelopardalis', title: 'The Giraffe' },
  Cnc: { name: 'Cancer', title: 'The Crab' },
  CVn: { name: 'Canes Venatici', title: 'The Hunting Dogs' },
  CMa: { name: 'Canis Major', title: 'The Great Dog' },
  CMi: { name: 'Canis Minor', title: 'The Lesser Dog' },
  Cap: { name: 'Capricornus', title: 'The Sea Goat' },
  Car: { name: 'Carina', title: 'The Keel of the Argo' },
  Cas: { name: 'Cassiopeia', title: 'The Queen of the Heavens' },
  Cen: { name: 'Centaurus', title: 'The Centaur' },
  Cep: { name: 'Cepheus', title: 'The King of Ethiopia' },
  Cet: { name: 'Cetus', title: 'The Sea Monster' },
  Cha: { name: 'Chamaeleon', title: 'The Chameleon' },
  Cir: { name: 'Circinus', title: 'The Drafting Compass' },
  Col: { name: 'Columba', title: 'Noah\'s Dove' },
  Com: { name: 'Coma Berenices', title: 'Berenice\'s Hair' },
  CrA: { name: 'Corona Australis', title: 'The Southern Crown' },
  CrB: { name: 'Corona Borealis', title: 'The Northern Crown' },
  Crv: { name: 'Corvus', title: 'The Sacred Raven' },
  Crt: { name: 'Crater', title: 'The Cup of Apollo' },
  Cru: { name: 'Crux', title: 'The Southern Cross' },
  Cyg: { name: 'Cygnus', title: 'The Celestial Swan' },
  Del: { name: 'Delphinus', title: 'The Sacred Dolphin' },
  Dor: { name: 'Dorado', title: 'The Golden Fish' },
  Dra: { name: 'Draco', title: 'The Celestial Dragon' },
  Equ: { name: 'Equuleus', title: 'The Little Foal' },
  Eri: { name: 'Eridanus', title: 'The Celestial River' },
  For: { name: 'Fornax', title: 'The Chemical Furnace' },
  Gem: { name: 'Gemini', title: 'The Heavenly Twins' },
  Gru: { name: 'Grus', title: 'The Sacred Crane' },
  Her: { name: 'Hercules', title: 'The Mythic Champion' },
  Hor: { name: 'Horologium', title: 'The Pendulum Clock' },
  Hya: { name: 'Hydra', title: 'The Great Water Snake' },
  Hyi: { name: 'Hydrus', title: 'The Lesser Water Snake' },
  Ind: { name: 'Indus', title: 'The Star Voyager' },
  Lac: { name: 'Lacerta', title: 'The Cosmic Lizard' },
  Leo: { name: 'Leo', title: 'The Nemean Lion' },
  LMi: { name: 'Leo Minor', title: 'The Little Lion' },
  Lep: { name: 'Lepus', title: 'The Moon Hare' },
  Lib: { name: 'Libra', title: 'The Scales of Justice' },
  Lup: { name: 'Lupus', title: 'The Wolf' },
  Lyn: { name: 'Lynx', title: 'The Sharp-Eyed Lynx' },
  Lyr: { name: 'Lyra', title: 'The Celestial Harp' },
  Men: { name: 'Mensa', title: 'The Table Mountain' },
  Mic: { name: 'Microscopium', title: 'The Microscope' },
  Mon: { name: 'Monoceros', title: 'The Unicorn' },
  Mus: { name: 'Musca', title: 'The Fly' },
  Nor: { name: 'Norma', title: 'The Surveyor\'s Level' },
  Oct: { name: 'Octans', title: 'The Navigational Octant' },
  Oph: { name: 'Ophiuchus', title: 'The Serpent Bearer' },
  Ori: { name: 'Orion', title: 'The Great Hunter' },
  Pav: { name: 'Pavo', title: 'The Royal Peacock' },
  Peg: { name: 'Pegasus', title: 'The Winged Horse' },
  Per: { name: 'Perseus', title: 'The Gorgon Slayer' },
  Phe: { name: 'Phoenix', title: 'The Firebird' },
  Pic: { name: 'Pictor', title: 'The Painter\'s Easel' },
  Psc: { name: 'Pisces', title: 'The Two Fishes' },
  PsA: { name: 'Piscis Austrinus', title: 'The Southern Fish' },
  Pup: { name: 'Puppis', title: 'The Stern of the Argo' },
  Pyx: { name: 'Pyxis', title: 'The Mariner\'s Compass' },
  Ret: { name: 'Reticulum', title: 'The Reticle' },
  Sge: { name: 'Sagitta', title: 'The Golden Arrow' },
  Sgr: { name: 'Sagittarius', title: 'The Galactic Archer' },
  Sco: { name: 'Scorpius', title: 'The Giant Scorpion' },
  Scl: { name: 'Sculptor', title: 'The Sculptor\'s Studio' },
  Sct: { name: 'Scutum', title: 'The Sobieski Shield' },
  Ser: { name: 'Serpens', title: 'The Sacred Serpent' },
  Sex: { name: 'Sextans', title: 'The Astronomical Sextant' },
  Tau: { name: 'Taurus', title: 'The Celestial Bull' },
  Tel: { name: 'Telescopium', title: 'The Stargazer\'s Telescope' },
  Tri: { name: 'Triangulum', title: 'The Triangle' },
  TrA: { name: 'Triangulum Australe', title: 'The Southern Triangle' },
  Tuc: { name: 'Tucana', title: 'The Toucan' },
  UMa: { name: 'Ursa Major', title: 'The Great Bear / Big Dipper' },
  UMi: { name: 'Ursa Minor', title: 'The Little Bear / North Star' },
  Vel: { name: 'Vela', title: 'The Sails of the Argo' },
  Vir: { name: 'Virgo', title: 'The Maiden of Harvest' },
  Vol: { name: 'Volans', title: 'The Flying Fish' },
  Vul: { name: 'Vulpecula', title: 'The Little Fox' }
};

// Curated Star and Deep Sky Catalog covering the entire night sky
export const CELESTIAL_CATALOG = [
  // Northern & Circumpolar Stars
  { name: 'Polaris (North Star)', constellation: 'Ursa Minor', ra: 37.95, dec: 89.26, distLy: 433, type: 'Yellow Supergiant Star', desc: 'The historic navigational pole star directly aligning with Earth\'s northern rotational axis.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Kochab', constellation: 'Ursa Minor', ra: 222.68, dec: 74.16, distLy: 131, type: 'Orange Giant Star', desc: 'Ancient Guardian of the Pole, formerly serving as the celestial north marker in 1000 BC.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Alioth', constellation: 'Ursa Major', ra: 193.51, dec: 55.96, distLy: 82.6, type: 'Luminous White Star', desc: 'The brightest star in Ursa Major, forming the base of the Great Bear\'s tail.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Dubhe', constellation: 'Ursa Major', ra: 165.93, dec: 61.75, distLy: 123, type: 'Orange Giant Binary Star', desc: 'The northern pointer star of the Big Dipper pointing directly across to the North Star.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Alkaid', constellation: 'Ursa Major', ra: 206.89, dec: 49.31, distLy: 104, type: 'Blue-White Main Sequence Star', desc: 'The glowing star at the tip of the Great Bear\'s tail, blazing at 17,000 Kelvin.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Mizar & Alcor', constellation: 'Ursa Major', ra: 200.98, dec: 54.92, distLy: 83, type: 'Multiple Star System', desc: 'The ancient eyesight test star system, revealed to be a magnificent sextuple star system.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Thuban', constellation: 'Draco', ra: 211.10, dec: 64.38, distLy: 303, type: 'White Giant Star', desc: 'The historic Pole Star during the building of the Great Pyramids of Giza around 2700 BC.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Eltanin', constellation: 'Draco', ra: 269.15, dec: 51.49, distLy: 154, type: 'Orange Giant Star', desc: 'The luminous right eye of the Dragon, 600 times more luminous than our Sun.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },

  // Perseus, Andromeda, Cassiopeia Sector
  { name: 'Mirfak (Alpha Persei)', constellation: 'Perseus', ra: 36.08, dec: 49.86, distLy: 510, type: 'Yellow-White Supergiant Star', desc: 'Brilliant supergiant 5,000 times brighter than the Sun, anchoring the Alpha Persei Cluster.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Algol (The Demon Star)', constellation: 'Perseus', ra: 47.04, dec: 40.96, distLy: 93, type: 'Eclipsing Binary System', desc: 'The famous blinking eye of Medusa, eclipsing every 2.87 days in predictable cosmic clockwork.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Schedar', constellation: 'Cassiopeia', ra: 10.13, dec: 56.54, distLy: 228, type: 'Orange Giant Star', desc: 'The glowing heart of the Queen\'s Celestial Throne in the distinct cosmic W shape.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Caph', constellation: 'Cassiopeia', ra: 2.29, dec: 59.15, distLy: 54.7, type: 'Yellow-White Subgiant Star', desc: 'A Delta Scuti variable star marking the western point of the Cassiopeia throne.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Navi (Gamma Cas)', constellation: 'Cassiopeia', ra: 14.18, dec: 60.72, distLy: 550, type: 'Variable Eruptive Star', desc: 'A rapidly spinning eruptive star surrounded by a dynamic glowing disc of gas.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Alpheratz', constellation: 'Andromeda', ra: 2.10, dec: 29.09, distLy: 97, type: 'Binary Mercury-Manganese Star', desc: 'The bridge star connecting Andromeda to the Great Square of Pegasus.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Mirach', constellation: 'Andromeda', ra: 17.43, dec: 35.62, distLy: 197, type: 'Red Giant Star', desc: 'A stunning ruby giant, famously used by stargazers to hop directly to the Andromeda Galaxy.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Andromeda Galaxy (M31)', constellation: 'Andromeda', ra: 10.68, dec: 41.27, distLy: 2500000, type: 'Spiral Galaxy', desc: 'The majestic twin spiral galaxy to our Milky Way, containing over one trillion stars.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Triangulum Galaxy (M33)', constellation: 'Triangulum', ra: 23.46, dec: 30.66, distLy: 2730000, type: 'Spiral Galaxy', desc: 'The third-largest spiral galaxy in our Local Group, rich in glowing starburst nebulae.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },

  // Taurus, Auriga, Orion & Winter Hexagon
  { name: 'Capella', constellation: 'Auriga', ra: 79.17, dec: 45.99, distLy: 42.9, type: 'Golden Quadruple Star', desc: 'The sixth brightest star in the entire sky, consisting of two pairs of binary suns.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Menkalinan', constellation: 'Auriga', ra: 89.88, dec: 44.95, distLy: 81, type: 'Subgiant Binary Star', desc: 'The celestial shoulder of the Charioteer, orbiting in a tight eclipsing period of 4 days.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Aldebaran', constellation: 'Taurus', ra: 68.98, dec: 16.51, distLy: 65.3, type: 'Red Giant Star', desc: 'The glowing red Eye of the Bull, 44 times the solar diameter and anchoring the Taurus constellation.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Pleiades / Seven Sisters (M45)', constellation: 'Taurus', ra: 56.75, dec: 24.11, distLy: 444, type: 'Open Star Cluster & Reflection Nebula', desc: 'A dazzling cluster of hot blue stars surrounded by deep sapphire interstellar dust reflection.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Elnath', constellation: 'Taurus', ra: 81.57, dec: 28.61, distLy: 134, type: 'Blue-White Giant Star', desc: 'The northern tip of the Bull\'s horn, blazing with mercury and manganese abundances.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Betelgeuse', constellation: 'Orion', ra: 88.79, dec: 7.41, distLy: 550, type: 'Red Supergiant Star', desc: 'A gargantuan pulsating supergiant destined to explode in a glorious nearby supernova.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Rigel', constellation: 'Orion', ra: 78.63, dec: -8.20, distLy: 860, type: 'Blue Supergiant Star', desc: 'The radiant foot of Orion, emitting 120,000 times more light energy than our Sun.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Alnilam', constellation: 'Orion', ra: 84.05, dec: -1.20, distLy: 2000, type: 'Blue Supergiant Star', desc: 'The massive central pearl of Orion\'s belt, 40 times the mass of the Sun.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Orion Nebula (M42)', constellation: 'Orion', ra: 83.82, dec: -5.39, distLy: 1344, type: 'Diffuse Emission Nebula', desc: 'A cosmic star factory visible to the naked eye, birthing thousands of infant planetary systems.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Sirius (The Dog Star)', constellation: 'Canis Major', ra: 101.29, dec: -16.72, distLy: 8.6, type: 'Main Sequence Binary Star', desc: 'The brightest star in Earth\'s night sky, blazing with double the luminosity of our Sun.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Procyon', constellation: 'Canis Minor', ra: 114.83, dec: 5.22, distLy: 11.5, type: 'Yellow-White Subgiant Star', desc: 'One of the nearest star systems to Earth, accompanied by a faint white dwarf companion.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Pollux', constellation: 'Gemini', ra: 116.33, dec: 27.99, distLy: 33.8, type: 'Orange Giant with Exoplanet', desc: 'The immortal twin of Gemini, known to harbor the massive gas giant exoplanet Thestias.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Castor', constellation: 'Gemini', ra: 113.65, dec: 31.89, distLy: 51.6, type: 'Sextuple Star System', desc: 'Three pairs of binary stars gravitationally dancing together in one complex stellar harmony.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },

  // Spring & Summer Champions
  { name: 'Regulus', constellation: 'Leo', ra: 152.09, dec: 11.97, distLy: 79.3, type: 'Quadruple Blue-White Star', desc: 'The royal Heart of the Lion, rotating so rapidly it is squashed into an oblate ellipsoid.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Denebola', constellation: 'Leo', ra: 177.26, dec: 14.57, distLy: 35.9, type: 'A-type Main Sequence Star', desc: 'The tail of the Lion, surrounded by a luminous dusty circumstellar debris disk.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Arcturus', constellation: 'Boötes', ra: 213.91, dec: 19.18, distLy: 36.7, type: 'Red Giant Luminary', desc: 'The brightest star in the northern celestial hemisphere, an ancient relic of the Galactic Halo.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Spica', constellation: 'Virgo', ra: 201.30, dec: -11.16, distLy: 250, type: 'Blue Giant Binary Star', desc: 'The pure sheaf of wheat held by the Maiden, composed of two intense blue stars in close orbit.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Cor Caroli', constellation: 'Canes Venatici', ra: 194.01, dec: 38.32, distLy: 110, type: 'Magnetic Binary Star', desc: 'The Heart of Charles, famous prototype for stars with colossal astronomical magnetic fields.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Whirlpool Galaxy (M51)', constellation: 'Canes Venatici', ra: 202.47, dec: 47.20, distLy: 23000000, type: 'Grand Design Spiral Galaxy', desc: 'A stunning cosmic face-on spiral actively interacting with its dwarf companion galaxy NGC 5195.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Alphecca', constellation: 'Corona Borealis', ra: 233.67, dec: 26.71, distLy: 75, type: 'Eclipsing Binary Star', desc: 'The shimmering jewel in the delicate Northern Crown, glowing with blue-white radiance.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },

  // Summer Triangle & Milky Way Stream
  { name: 'Vega', constellation: 'Lyra', ra: 279.23, dec: 38.78, distLy: 25.0, type: 'Blue-White Luminary', desc: 'The crown jewel of the Summer Triangle, historically the foundation of astronomical magnitude zero.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Ring Nebula (M57)', constellation: 'Lyra', ra: 283.40, dec: 33.03, distLy: 2570, type: 'Planetary Nebula', desc: 'A glowing smoke ring of ionized gas expelled by a dying central white dwarf star.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Deneb', constellation: 'Cygnus', ra: 310.36, dec: 45.28, distLy: 2600, type: 'White Supergiant Star', desc: 'A colossal luminary 200,000 times more luminous than our Sun, tail of the Celestial Swan.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Albireo', constellation: 'Cygnus', ra: 292.68, dec: 27.96, distLy: 430, type: 'Gold and Sapphire Double Star', desc: 'Celebrated by astronomers as the single most breathtaking color-contrast double star in the sky.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Altair', constellation: 'Aquila', ra: 297.70, dec: 8.87, distLy: 16.7, type: 'A-type Fast Rotator Star', desc: 'A neighboring star spinning at 286 km/s, flattening its diameter by 20% at the equator.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Hercules Cluster (M13)', constellation: 'Hercules', ra: 250.42, dec: 36.46, distLy: 22200, type: 'Great Globular Cluster', desc: 'A dense gravitational ball of 300,000 ancient stars, recipient of the 1974 Arecibo radio message.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Antares', constellation: 'Scorpius', ra: 247.35, dec: -26.43, distLy: 550, type: 'Red Supergiant Star', desc: 'The pulsing ruby Heart of the Scorpion, rivaling the fiery redness of the planet Mars.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Fomalhaut', constellation: 'Piscis Austrinus', ra: 344.41, dec: -29.62, distLy: 25.1, type: 'A-type Star with Debris Ring', desc: 'The solitary southern beacon surrounded by a spectacular ring of comet and asteroid debris.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Markab', constellation: 'Pegasus', ra: 346.19, dec: 15.21, distLy: 133, type: 'Giant Star', desc: 'The southwest anchor of the Great Square of Pegasus, marking the wing of the mythical steed.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },

  // Southern Skies
  { name: 'Alpha Centauri (Rigil Kentaurus)', constellation: 'Centaurus', ra: 219.90, dec: -60.83, distLy: 4.37, type: 'Closest Triple Star System', desc: 'Our Sun\'s nearest stellar neighbors, hosting Proxima Centauri and habitable zone exoplanets.', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' },
  { name: 'Canopus', constellation: 'Carina', ra: 95.99, dec: -52.70, distLy: 310, type: 'Bright White Supergiant', desc: 'The second brightest star in the entire heavens, standard reference star for spacecraft attitude navigation.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Acrux', constellation: 'Crux', ra: 186.65, dec: -63.10, distLy: 320, type: 'Multiple Blue Subgiant Star', desc: 'The southernmost brilliant star of the famous Southern Cross constellation.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
  { name: 'Achernar', constellation: 'Eridanus', ra: 24.43, dec: -57.24, distLy: 139, type: 'Rapidly Oblate Blue Star', desc: 'The end of the celestial river, spinning so fiercely that its equatorial diameter is 56% wider than its poles.', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' }
];

// Check local dynamic solar system objects (Moon, Sun, Planets)
export function getLocalSolarSystemObject(latitude, longitude, date, zenithRa, zenithDec) {
  const bodies = [
    { body: Body.Moon, name: 'The Moon', type: 'Natural Satellite', img: 'https://images.unsplash.com/photo-1522030299830-16b8d3d049fe?q=80&w=600&auto=format&fit=crop' },
    { body: Body.Jupiter, name: 'Jupiter', type: 'Gas Giant Planet', img: 'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?q=80&w=600&auto=format&fit=crop' },
    { body: Body.Saturn, name: 'Saturn', type: 'Ringed Planet', img: 'https://images.unsplash.com/photo-1614732414444-096e5f1122d5?q=80&w=600&auto=format&fit=crop' },
    { body: Body.Mars, name: 'Mars', type: 'Terrestrial Planet', img: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=600&auto=format&fit=crop' },
    { body: Body.Venus, name: 'Venus', type: 'Terrestrial Planet', img: 'https://images.unsplash.com/photo-1614728423169-3f65fd722b7e?q=80&w=600&auto=format&fit=crop' },
    { body: Body.Mercury, name: 'Mercury', type: 'Terrestrial Planet', img: 'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?q=80&w=600&auto=format&fit=crop' },
    { body: Body.Sun, name: 'The Sun', type: 'Yellow Dwarf Star (G2V)', img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop' }
  ];

  let closest = null;
  let minAngDist = Infinity;

  const observer = new Observer(latitude, longitude, 0);

  for (const item of bodies) {
    try {
      const eq = Equator(item.body, date, observer, true, true);
      const bodyRaDeg = eq.ra * 15.0;
      const bodyDecDeg = eq.dec;
      const angDist = angularDistanceDeg(zenithRa, zenithDec, bodyRaDeg, bodyDecDeg);

      // If a major planet or Moon is within 18 degrees of zenith, it is considered directly overhead!
      if (angDist < 18.0 && angDist < minAngDist) {
        minAngDist = angDist;
        const kmDist = eq.dist * 149597870.7;
        const distStr = item.body === Body.Moon 
          ? `${Math.round(kmDist).toLocaleString()} km`
          : kmDist > 100000000 
            ? `${(kmDist / 1000000).toFixed(1)} Million km (${eq.dist.toFixed(2)} AU)`
            : `${Math.round(kmDist).toLocaleString()} km`;

        closest = {
          name: item.name,
          type: item.type,
          distanceStr: distStr,
          distLy: null,
          ra: bodyRaDeg,
          dec: bodyDecDeg,
          angularSep: angDist,
          desc: `Our solar system's ${item.name} is currently aligned in your overhead sky hemisphere!`,
          img: item.img,
          isSolarSystem: true
        };
      }
    } catch (e) {
      // Continue on any calculation edge case
    }
  }

  return closest;
}

// Master function: Always returns the real star, planet, or deep sky object overhead
export async function getClosestObject(latitude, longitude) {
  const date = new Date();
  const { ra, dec } = getZenithCoordinates(latitude, longitude, date);

  // 1. Identify official IAU constellation directly overhead
  let constellationName = 'Perseus';
  let constellationTitle = 'The Celestial Realm';
  try {
    const info = Constellation(ra / 15.0, dec);
    if (info && info.name) {
      constellationName = info.name;
      if (CONSTELLATION_NAMES[info.symbol]) {
        constellationTitle = CONSTELLATION_NAMES[info.symbol].title;
      }
    }
  } catch (e) {
    console.warn('Constellation lookup error:', e);
  }

  // 2. Check dynamic Solar System objects (Moon, Jupiter, Saturn, etc.)
  const solarObj = getLocalSolarSystemObject(latitude, longitude, date, ra, dec);
  if (solarObj) {
    return {
      ...solarObj,
      constellation: constellationName,
      constellationTitle: constellationTitle,
      zenithRa: ra,
      zenithDec: dec
    };
  }

  // 3. Find closest cataloged Star or Deep Space Landmark to exact Zenith
  let closestStar = CELESTIAL_CATALOG[0];
  let minDistance = Infinity;

  for (const item of CELESTIAL_CATALOG) {
    const ang = angularDistanceDeg(ra, dec, item.ra, item.dec);
    if (ang < minDistance) {
      minDistance = ang;
      closestStar = { ...item, angularSep: ang };
    }
  }

  return {
    name: closestStar.name,
    type: closestStar.type,
    constellation: closestStar.constellation || constellationName,
    constellationTitle: constellationTitle,
    distanceStr: closestStar.distLy > 10000 
      ? `${(closestStar.distLy).toLocaleString()} Light Years` 
      : `${closestStar.distLy.toFixed(1)} Light Years`,
    angularSep: closestStar.angularSep,
    desc: closestStar.desc,
    img: closestStar.img,
    ra: closestStar.ra,
    dec: closestStar.dec,
    zenithRa: ra,
    zenithDec: dec,
    isSolarSystem: false
  };
}
