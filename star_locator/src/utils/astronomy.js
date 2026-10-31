import { SiderealTime, Equator, Body, Observer } from 'astronomy-engine';
import axios from 'axios';

// Get the zenith coordinates (Right Ascension and Declination) for a given location and time.
export function getZenithCoordinates(latitude, longitude, date) {
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

  return { ra, dec };
}

// Check local solar system objects (Moon, Planets)
// to see if they are in the line of sight (within a small angular tolerance, e.g., 2 degrees)
export function getLocalClosestObject(latitude, longitude, date, ra, dec) {
  const bodies = [Body.Moon, Body.Sun, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune, Body.Pluto];
  
  let closestBody = null;
  let minAngularDistance = Infinity;

  // We are looking straight up.
  for (const body of bodies) {
    const observer = new Observer(latitude, longitude, 0);
    const eq = Equator(body, date, observer, true, true);
    
    // RA is in hours from Equator, convert to degrees
    const bodyRaDeg = eq.ra * 15.0;
    const bodyDecDeg = eq.dec;
    
    // Simple angular distance calculation (spherical law of cosines or haversine)
    // Convert to radians
    const rad = Math.PI / 180;
    const ra1 = ra * rad;
    const dec1 = dec * rad;
    const ra2 = bodyRaDeg * rad;
    const dec2 = bodyDecDeg * rad;

    const angle = Math.acos(
      Math.sin(dec1) * Math.sin(dec2) +
      Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2)
    );
    
    const degAngle = angle / rad;
    
    if (degAngle < 2.0 && degAngle < minAngularDistance) {
      minAngularDistance = degAngle;
      closestBody = {
        name: body,
        type: body === Body.Moon ? 'Moon' : body === Body.Sun ? 'Star' : body === Body.Pluto ? 'Dwarf Planet' : 'Planet',
        distance: eq.dist, // in AU
        angularDistance: degAngle
      };
    }
  }

  return closestBody;
}

// Query SIMBAD via TAP for the closest physical object (using parallax) in the line of sight
export async function getDeepSpaceClosestObject(ra, dec) {
  // Query for objects within a 2-degree radius (cone) around the coordinates.
  // We want the object with the highest parallax (plx_value) because distance = 1/parallax.
  // Using TAP ADQL query.
  const query = `
    SELECT TOP 1 
      main_id, otype, ra, dec, plx_value
    FROM basic
    WHERE 1=CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra}, ${dec}, 2))
    AND plx_value IS NOT NULL
    AND plx_value > 0
    ORDER BY plx_value DESC
  `;

  try {
    const response = await axios.get('https://simbad.u-strasbg.fr/simbad/sim-tap/sync', {
      params: {
        request: 'doQuery',
        lang: 'ADQL',
        format: 'json',
        query: query
      }
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const row = response.data.data[0];
      // row looks like: [main_id, otype, ra, dec, plx_value]
      const name = row[0];
      const type = row[1];
      const objRa = row[2];
      const objDec = row[3];
      const parallax = row[4]; // in milliarcseconds (mas)
      
      // Distance in parsecs = 1000 / parallax_in_mas
      const distanceParsecs = 1000 / parallax;
      // Convert to light years
      const distanceLy = distanceParsecs * 3.26156;

      return {
        name: name,
        type: type,
        distanceLy: distanceLy,
        ra: objRa,
        dec: objDec
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching from SIMBAD:", error);
    return null;
  }
}

// Main function to get the absolute closest object
export async function getClosestObject(latitude, longitude) {
  const date = new Date();
  const { ra, dec } = getZenithCoordinates(latitude, longitude, date);
  
  // 1. Check if there's a solar system object in the line of sight
  const solarSystemObject = getLocalClosestObject(latitude, longitude, date, ra, dec);
  
  if (solarSystemObject) {
    // Solar system objects are always closer than stars/deep space
    return {
      name: solarSystemObject.name,
      type: solarSystemObject.type,
      // Convert AU to light minutes or km for display
      distanceStr: `${(solarSystemObject.distance * 149597870.7).toLocaleString(undefined, {maximumFractionDigits: 0})} km`,
      local: true,
      ra, dec
    };
  }
  
  // 2. Query SIMBAD for the closest star/deep space object
  const deepSpaceObject = await getDeepSpaceClosestObject(ra, dec);
  
  if (deepSpaceObject) {
    return {
      name: deepSpaceObject.name,
      type: deepSpaceObject.type,
      distanceStr: `${deepSpaceObject.distanceLy.toFixed(2)} Light Years`,
      local: false,
      ra: deepSpaceObject.ra,
      dec: deepSpaceObject.dec
    };
  }
  
  // Fallback if nothing is found (unlikely, but possible if SIMBAD fails)
  return {
    name: "Deep Space Void",
    type: "Empty Space",
    distanceStr: "Unknown",
    local: false,
    ra, dec
  };
}
