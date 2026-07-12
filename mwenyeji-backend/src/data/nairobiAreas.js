// Mirrors the frontend's src/utils/nairobiAreas.js curated area list —
// used as a fallback source for /api/move_in/places/suggestions so
// autocomplete still returns something sensible before any real listings
// or landmarks exist in a given area.
const NAIROBI_AREAS = [
  { name: "Kawangware" },
  { name: "Kangemi" },
  { name: "Dagoretti" },
  { name: "Kabiria" },
  { name: "Riruta" },
  { name: "Umoja" },
  { name: "Donholm" },
  { name: "Buruburu" },
  { name: "South B" },
  { name: "South C" },
  { name: "Pipeline" },
  { name: "Utawala" },
  { name: "Kayole" },
  { name: "Embakasi" },
  { name: "Westlands" },
  { name: "Kilimani" },
  { name: "Kileleshwa" },
  { name: "Karen" },
  { name: "Lang'ata" },
  { name: "Ruaka" },
  { name: "Kasarani" },
  { name: "Roysambu" },
];

module.exports = { NAIROBI_AREAS };
