/**
 * OSMLR tile utilities
 */
const VALHALLA_TILES = [
  { level: 2, size: 0.25 },
  { level: 1, size: 1.0 },
  { level: 0, size: 4.0 }
]

/**
 * Given a bounding box, returns an array of tuples of OSMLR tiles that
 * intersect the bounding box, where the first item in the tuple is the tile
 * level and the second item in the tuple is the tile's index
 *
 * @param {Number} left - western longitude
 * @param {Number} bottom - southern latitude
 * @param {Number} right - eastern longitude
 * @param {Number} top - northern latitude
 * @returns {Array} - of OSMLR tuples [tile level, tile index]
 */
export function getTilesForBoundingBox (left, bottom, right, top) {
  // if this is crossing the anti meridian split it up and combine
  if (left > right) {
    const east = getTilesForBoundingBox(left, bottom, 180.0, top)
    const west = getTilesForBoundingBox(-180.0, bottom, right, top)
    return east.concat(west)
  }

  // move these so we can compute percentages
  left += 180
  right += 180
  bottom += 90
  top += 90

  // for each size of tile
  return VALHALLA_TILES.reduce(function (tiles, tileSet) {
    const set = []

    // for each column
    for (let x = Math.floor(left / tileSet.size); x <= Math.floor(right / tileSet.size); x++) {
      // for each row
      for (let y = Math.floor(bottom / tileSet.size); y <= Math.floor(top / tileSet.size); y++) {
        // give back the level and the tile index
        set.push([ tileSet.level, Math.floor(y * (360.0 / tileSet.size) + x) ])
      }
    }

    return tiles.concat(set)
  }, [])
}
