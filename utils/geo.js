export const COMPANY_LOCATION = {
  lat: parseFloat(process.env.OFFICE_LAT),
  lng: parseFloat(process.env.OFFICE_LNG),
};

export const TOLERANCE_METERS =
  parseFloat(process.env.OFFICE_TOLERANCE_METERS) || 200;

if (
  Number.isNaN(COMPANY_LOCATION.lat) ||
  Number.isNaN(COMPANY_LOCATION.lng)
) {
  console.warn(
    "[GEO] OFFICE_LAT or OFFICE_LNG is missing or invalid; onsite distance checks will be treated as unverifiable.",
  );
}

export const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  // Haversine formula for great-circle distance between two GPS coordinates.
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
