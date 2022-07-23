
// Script adapted from F. Greifeneder posted in the Google Developers discussion "Sentinel1 - Local incidence angle" forum: https://groups.google.com/g/google-earth-engine-developers/c/cO0o2yoGdr0/m/C8KYvbgWAQAJ
// This script should serve as a demonstrator for one possible way to calculate the local incidence angle for an S1 image
// The basic idea is to project the terrain slope into the line of sight plane. This can be done using a DEM (SRTM in this case)
// combined with the knowledge of the S1 azimuth angle. The projected slope can be transformed in the projected terrain zenith
// angle, which is then subtracted from the S1 incidence angle to derive the local incidence angle (LIA)

var roi = ee.Geometry.Point(-0.9595,54.110) // Hollin Hill CRNS Location

var geometry = roi
// filtering of the S1 image collection, considering polrization, instrument mode, orbit direction, and the area of interest
sentinel1 = sentinel1.filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                     .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                     .filter(ee.Filter.eq('instrumentMode', 'IW'))
                     .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
                     .filterBounds(geometry);

// we calculate the LIA for the first in the collection
var sentinel1_image = ee.Image(sentinel1.first());
Map.addLayer(sentinel1_image.select('VV'), {min: -18, max:0}, 'S1_VV');

// We can use the gradient of the "angle" band of the S1 image to derive the S1 azimuth angle.
var s1_inc = sentinel1_image.select('angle');
var s1_azimuth = ee.Terrain.aspect(s1_inc)
                           .reduceRegion(ee.Reducer.mean(), s1_inc.get('system:footprint'), 1000)
                           .get('aspect');
print(s1_azimuth);

// Here we derive the terrain slope and aspect
var srtm_slope = ee.Terrain.slope(srtm).select('slope');
var srtm_aspect = ee.Terrain.aspect(srtm).select('aspect');
// And then the projection of the slope
var slope_projected = srtm_slope.multiply(ee.Image.constant(s1_azimuth).subtract(srtm_aspect).multiply(Math.PI/180).cos());

// And finally the local incidence angle
var lia = s1_inc.subtract(ee.Image.constant(90).subtract(ee.Image.constant(90).subtract(slope_projected))).abs();

Map.centerObject(roi, 15)
Map.addLayer(lia, {min: 10, max: 50}, 'LIA');
// Show the CRS sensor location in red
Map.addLayer(roi, {color: 'red'}, 'CRS sensor Location')