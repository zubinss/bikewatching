// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoienViaW5zcyIsImEiOiJjbTdiNWd0Z3AwYzJmMmpvc25vdTQ2bzZ4In0.HgDojjO5xxAhNMZyVU6OHA';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

// Declare stations in the outer scope
let stations = [];

map.on('load', () => { 
    // Add Boston Route
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });
    map.addLayer({
        id: 'bike-lanes-boston',
        type: 'line',
        source: 'boston_route',
        paint: {
          'line-color': 'green',
          'line-width': 5,
          'line-opacity': 0.4
        }
    });

    // Add Cambridge Route
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });
    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: {
          'line-color': 'green',
          'line-width': 5,
          'line-opacity': 0.4
        }
    });

    // Load Bluebike Stations
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    d3.json(jsonurl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);
        stations = jsonData.data.stations; // Assign to outer scope variable
        console.log('Stations Array:', stations);

        // Load CSV trip data **after stations are set**
        const csv_url = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        d3.csv(csv_url).then(trips => {
            const departures = d3.rollup(
                trips,
                (v) => v.length,
                (d) => d.start_station_id,
            );
            
            const arrivals = d3.rollup(
                trips,
                (v) => v.length,
                (d) => d.end_station_id,
            );

            // Ensure stations exist before modifying them
            stations = stations.map((station) => {
                let id = station.short_name;
                station.arrivals = arrivals.get(id) ?? 0;
                station.departures = departures.get(id) ?? 0;
                station.totalTraffic = station.arrivals + station.departures;
                return station;
            });

            console.log('Updated Stations with Traffic:', stations);    

            // Define radius scale **after totalTraffic is set**
            const radiusScale = d3
                .scaleSqrt()
                .domain([0, d3.max(stations, (d) => d.totalTraffic) || 1]) // Prevent domain from being [0, undefined]
                .range([0, 25]);

            // Append circles to the SVG **after traffic data is available**
            const svg = d3.select('#map').select('svg');

            function getCoords(station) {
                const point = new mapboxgl.LngLat(+station.lon, +station.lat);
                const { x, y } = map.project(point);
                return { cx: x, cy: y };
            }

            const circles = svg.selectAll('circle')
                .data(stations)
                .enter()
                .append('circle')
                .attr('r', d => radiusScale(d.totalTraffic)) // Now safe to use totalTraffic
                .attr('fill', 'steelblue')
                .attr('stroke', 'white')
                .attr('stroke-width', 1)
                .attr('opacity', 0.6)
                .each(function(d) {
                    // Add <title> for browser tooltips
                    d3.select(this)
                      .append('title')
                      .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`)});

            console.log('Circles:', circles);

            // Function to update circle positions when the map moves/zooms
            function updatePositions() {
                circles
                    .attr('cx', d => getCoords(d).cx)
                    .attr('cy', d => getCoords(d).cy);
            }

            // Initial position update
            updatePositions();

            // Reposition markers on map interactions
            map.on('move', updatePositions);
            map.on('zoom', updatePositions);
            map.on('resize', updatePositions);
            map.on('moveend', updatePositions);

        }).catch(error => {
            console.error('Error loading CSV:', error);
        });
    }).catch(error => {
        console.error('Error loading JSON:', error);
    });
});
