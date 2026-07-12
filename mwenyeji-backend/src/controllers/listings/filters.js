const normalize = (value) => String(value || "").toLowerCase().trim().replace(/[\s-]+/g, "_");

const splitList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => normalize(item))
    .filter(Boolean);

const roomTypeFor = (unit) => {
  const bedrooms = Number(unit.bedrooms);
  const typeText = normalize(`${unit.unitType || ""} ${unit.title || ""}`);

  if (typeText.includes("bedsitter")) return "bedsitter";
  if (typeText.includes("studio") || bedrooms === 0) return "studio";
  if (bedrooms === 1) return "1_bedroom";
  if (bedrooms === 2) return "2_bedroom";
  if (bedrooms === 3) return "3_bedroom";
  if (bedrooms >= 4) return "4_bedroom_plus";
  return "";
};

const matchesRoomTypes = (unit, requested) => {
  if (!requested.length) return true;
  return requested.includes(roomTypeFor(unit));
};

const matchesLifestyle = (unit, requested) => {
  if (!requested.length) return true;
  const amenities = (unit.amenities || []).map(normalize);
  return requested.every((item) => {
    if (item === "pool") return amenities.some((a) => a.includes("pool") || a.includes("swimming"));
    if (item === "parking") return amenities.some((a) => a.includes("parking") || a.includes("car"));
    if (item === "family_friendly") return amenities.some((a) => a.includes("family") || a.includes("children"));
    if (item === "pet_friendly") return amenities.some((a) => a.includes("pet"));
    return amenities.some((a) => a.includes(item));
  });
};

const matchesType = (unit, type) => {
  const wanted = normalize(type);
  if (!wanted) return true;

  const haystack = normalize(`${unit.listingType || ""} ${unit.unitType || ""} ${unit.title || ""}`);

  if (wanted === "house") {
    return ["house", "bungalow", "maisonette", "townhouse", "villa"].some((t) => haystack.includes(t));
  }
  if (wanted === "commercial") {
    return ["commercial", "office", "shop", "retail"].some((t) => haystack.includes(t));
  }
  if (wanted === "apartment") {
    return haystack.includes("apartment");
  }

  const mappedRoom = roomTypeFor({ ...unit, unitType: type });
  if (mappedRoom) return roomTypeFor(unit) === mappedRoom;

  return true;
};

module.exports = { normalize, splitList, roomTypeFor, matchesRoomTypes, matchesLifestyle, matchesType };
