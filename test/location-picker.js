// Initialize map
var map = L.map('map').setView([51.505, -0.09], 13);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

var marker;

// Add click event listener to the map
map.on('click', function(e) {
  var latlng = e.latlng;

  // Remove existing marker if present
  if (marker) {
    map.removeLayer(marker);
  }

  // Add a new marker at the clicked location
  marker = L.marker(latlng).addTo(map);
});

// Optional: Get the selected location's coordinates
function getSelectedLocation() {
  if (marker) {
    var latlng = marker.getLatLng();
    return {
      latitude: latlng.lat,
      longitude: latlng.lng
    };
  } else {
    return null;
  }
}

// Initialize map
var map = L.map('map').setView([51.505, -0.09], 13);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

var marker;

// Add click event listener to the map
map.on('click', function(e) {
  var latlng = e.latlng;

  // Remove existing marker if present
  if (marker) {
    map.removeLayer(marker);
  }

  // Add a new marker at the clicked location
  marker = L.marker(latlng).addTo(map);
});

// Optional: Get the selected location's coordinates
function getSelectedLocation() {
  if (marker) {
    var latlng = marker.getLatLng();
    return {
      latitude: latlng.lat,
      longitude: latlng.lng
    };
  } else {
    return null;
  }
}
