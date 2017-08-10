import protobuf from 'protobufjs'
import { filter, uniqWith, isEqual } from 'lodash'
import speedTileDescriptor from '../proto/speedtile.proto.json'
import { getTileUrlSuffix } from '../lib/tiles'

const STATIC_DATA_TILE_PATH = 'https://s3.amazonaws.com/speed-extracts/2017/0/'
const tileCache = {}

/**
 * Uses `protobuf.js` module to parse and read a `SpeedTile` protocol buffer.
 * Throws an error if the message cannot be verified.
 * Relies on the imported `speedtile.proto` descriptor in JSON format. This
 * is pre-generated, which allows us to skip making a network request for
 * the original protobuf file.
 *
 * @param {ArrayBuffer} buffer - the raw ArrayBuffer response from `fetch()`
 * @return {Object} - the protobuf, converted to JavaScript object
 */
function readDataTiles (buffer) {
  const root = protobuf.Root.fromJSON(speedTileDescriptor)
  const SpeedTile = root.lookupType('SpeedTile')
  const message = SpeedTile.decode(new Uint8Array(buffer))

  // Verifies that the result satisfies the requirements of a valid message.
  // The verification method returns `null` if it is okay, and a string
  // (error message) if it is not okay.
  // Throws an error if the error message is present.
  const verify = SpeedTile.verify(message)
  if (verify) {
    throw new Error(verify)
  }

  // Returns the message as a plain JavaScript object
  return SpeedTile.toObject(message)
}

/**
 * Consolidates an array of data tiles into an object with tile level and index
 * keys so it's easier to look up
 *
 * @param {Array<Object>} tiles - array of data tiles (as parsed from protobuf)
 * @return {Object} - a single object. Top-level keys are tile level.
 *            Second-level keys are tile index. Each second-level key
 *            contains an array of subtiles.
 */
export function consolidateTiles (tiles) {
  return tiles.reduce((construct, source) => {
    const lv = source.level
    const ix = source.index

    if (!construct[lv]) construct[lv] = {}

    if (!construct[lv][ix]) {
      construct[lv][ix] = [source]
    } else {
      construct[lv][ix].push(source)
    }

    return construct
  }, {})
}

/**
 * Stores tiles in module's `tileCache` variable.
 *
 * Returns the original input.
 */
function cacheTiles (tiles) {
  Object.assign(tileCache, tiles)

  return tiles
}

/**
 * Fetches all requested OpenTraffic data tiles and concatenates them into
 * a single object. If tiles are cached, retrieve those instead of performing
 * the actual network request.
 *
 * @todo: Cache urls and tile responses so that anything that is already
 * in cache do not need to be re-fetched. We may need to set a dynamic
 * cache limit based on available memory, if that's something we can determine.
 *
 * @param {Array<Object>} ids - a list of ids in the format { level, tile }
 * @return {Promise} - resolved with an object where tiles with level and
 *            tile index mapped to a nested key structure.
 */
export function fetchDataTiles (ids) {
  // Obtain a list of ids of just level and tile, which allows us to easily
  // filter out duplicates.
  const simpleIds = ids.map(id => { return { level: id.level, tile: id.tile } })
  const uniqueIds = uniqWith(simpleIds, isEqual)

  const promises = uniqueIds.map(id => {
    // If the id is already in tile cache, return it directly.
    if (tileCache[id.level] && tileCache[id.level][id.tile]) {
      return tileCache[id.level][id.tile]
    }

    // If the id is not in the cache, make a request for it.
    const suffix = getTileUrlSuffix(id)
    const subtile = 0
    const url = `${STATIC_DATA_TILE_PATH}${suffix}.spd.${subtile}.gz`

    return window.fetch(url)
      .then((response) => {
        // If a data tile fails to fetch, don't immediately reject; instead,
        // resolve with an error object. We'll deal with these later.
        if (!response.ok) {
          return Promise.resolve({
            url,
            error: true,
            status: response.status
          })
        }

        return response.arrayBuffer()
      })
  })

  return Promise.all(promises)
    // Reject from the responses all tiles that have errored out. Log the
    // broken tile url with status code to the console. Return a final array
    // of ArrayBuffers.
    .then(responses => {
      return filter(responses, (response) => {
        if (response.constructor === ArrayBuffer) {
          return true
        } else {
          if (typeof response === 'object' && response.error === true) {
            console.warn(`[analyst-ui] Unable to fetch a data tile from ${response.url}. The status code given was ${response.status}.`)
          }
          return false
        }
      })
    })
    // Read all protobuf messages and convert to plain objects
    .then(results => results.map(readDataTiles))
    // Move all subtiles into one array
    .then(objs => objs.reduce((a, b) => a.concat(b.subtiles), []))
    // Sort all subtiles according to lowest `startSegmentIndex`
    .then(array => array.sort((a, b) => a.startSegmentIndex - b.startSegmentIndex))
    // Consolidate all subtiles into a single object with lookup keys
    .then(consolidateTiles)
    .then(cacheTiles)
}
