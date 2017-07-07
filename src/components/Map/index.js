/* global Tangram */
import React from 'react'
import PropTypes from 'prop-types'
import { Map as Leaflet, ScaleControl } from 'react-leaflet'
// import Tangram from 'tangram'
import 'leaflet/dist/leaflet.css'
import './Map.css'

const ATTRIBUTION = '<a href="https://mapzen.com/">Mapzen</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://whosonfirst.mapzen.com#License">Who’s on First</a>'

export default class Map extends React.Component {
  static propTypes = {
    className: PropTypes.string,
    children: PropTypes.any,
    config: PropTypes.object.isRequired,
    center: PropTypes.array,
    zoom: PropTypes.number,
    onChange: PropTypes.func,
    onClick: PropTypes.func
  }

  static defaultProps = {
    center: [0, 0],
    zoom: 3,
    onChange: function () {},
    onClick: function () {}
  }

  componentDidMount () {
    const layer = Tangram.leafletLayer({
      scene: {
        import: [
          'https://mapzen.com/carto/refill-style/7/refill-style.zip',
          // 'https://mapzen.com/carto/refill-style/7/themes/gray.zip'
          'https://mapzen.com/carto/refill-style/7/themes/gray-gold.zip'
        ],
        global: {
          'sdk_mapzen_api_key': this.props.config.mapzen.apiKey
        }
      },
      attribution: ATTRIBUTION
    })

    layer.addTo(this.map.leafletElement)
  }

  render () {
    const { className, children, center, zoom, onChange, onClick } = this.props

    return (
      <Leaflet
        className={className}
        center={center}
        zoom={zoom}
        onLeafletClick={onClick}
        onLeafletZoomEnd={(e) => onChange({ zoom: e.target._zoom })}
        ref={(ref) => { this.map = ref }}
      >
        <ScaleControl />
        {children}
      </Leaflet>
    )
  }
}
