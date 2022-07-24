// file name: NDVI_Interpolation.js
// Version: 1.1
// Last updated: 11-07-2022
// Author: Kenneth Cassar

// Adapted from: https://courses.spatialthoughts.com/end-to-end-gee.html#savitzky-golay-smoothing

// Applying Savitzky-Golay Filter on a NDVI Time-Series
// This script uses the OEEL library to apply a 
// Savitzky-Golay filter on a imagecollection

// We require a regularly-spaced time-series without
// any masked pixels. So this script applies
// linear interpolation to created regularly spaced images
// from the original time-series

// Step-1: Prepare a NDVI Time-Series
// Step-2: Create an empty Time-Series with images at n days
// Step-3: Use Joins to find before/after images
// Step-4: Apply linear interpolation to fill each image
// Step-5: Apply Savitzky-Golay filter


//##############################################################
// Step-1: Prepare a NDVI time-series
//##############################################################

//roi = Hollin Hill CRNS location
var roi = ee.Geometry.Point(-0.959516,54.110676);
// Create circular buffer around sensor (200m).
var roip = roi.buffer(2e2);

var startDate = ee.Date('2019-01-01')
var endDate = startDate.advance(360, 'day')// n-year period 

// filter Sentinel-2 imagery
var s2 = ee.ImageCollection("COPERNICUS/S2") 
  .filter(ee.Filter.date(startDate, endDate))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40))
  .filter(ee.Filter.bounds(roip))
//print(filtered);

// Write a function for Cloud masking
var maskcloud = function (image) {
   var qa = image.select('QA60')
   var cloudBitMask = 1 << 10;
   var cirrusBitMask = 1 << 11;
   var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
              qa.bitwiseAnd(cirrusBitMask).eq(0))
   return image.updateMask(mask)
       .select("B.*")
       .copyProperties(image, ["system:time_start"])
}

// Write a function that computes NDVI for an image and adds it as a band
var addNDVI = function (image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).toFloat().rename('ndvi');
  return image.addBands(ndvi);
};

// Map the function over the collection
var cloud_masked = s2.map(maskcloud);
var withNdvi = cloud_masked.map(addNDVI)

// Select 'ndvi' band
var ndviCol = withNdvi.select('ndvi')

print('Original Collection', ndviCol)

//##############################################################
// Step-2: Create an empty Time-Series with images at n days
//##############################################################

// Select the interval. We will have an image every n days
var n = 2;
var totalDays = endDate.difference(startDate, 'day');
var daysToInterpolate = ee.List.sequence(1, totalDays, n)
//print(daysToInterpolate);

var initImages = daysToInterpolate.map(function(day) {
  var image = ee.Image().rename('ndvi').toFloat().set({
    'system:index': ee.Number(day).format('%d'),
    'system:time_start': startDate.advance(day, 'day').millis(),
    // Set a property so we can identify interpolated images
    'type': 'interpolated'
  })
  return image
})

var initCol = ee.ImageCollection.fromImages(initImages)
print('Empty Collection', initCol)

//##############################################################
// Step-3: Use Joins to find before/after images
//##############################################################

// Merge empty collection with the original collection so we can
// find images to interpolate from
var mergedCol = ndviCol.merge(initCol)

var mergedCol = mergedCol.map(function(image) {
  var timeImage = image.metadata('system:time_start').rename('timestamp')
  var timeImageMasked = timeImage.updateMask(image.mask().select(0))
  return image.addBands(timeImageMasked)
})

// Specify the time-window
// Set it so that we have at least 1 non-cloudy image in the period
var days = 60
var millis = ee.Number(days).multiply(1000*60*60*24)

var maxDiffFilter = ee.Filter.maxDifference({
  difference: millis,
  leftField: 'system:time_start',
  rightField: 'system:time_start'
})

var lessEqFilter = ee.Filter.lessThanOrEquals({
  leftField: 'system:time_start',
  rightField: 'system:time_start'
})


var greaterEqFilter = ee.Filter.greaterThanOrEquals({
  leftField: 'system:time_start',
  rightField: 'system:time_start'
})


var filter1 = ee.Filter.and(maxDiffFilter, lessEqFilter)
var join1 = ee.Join.saveAll({
  matchesKey: 'after',
  ordering: 'system:time_start',
  ascending: false})
  
var join1Result = join1.apply({
  primary: mergedCol,
  secondary: mergedCol,
  condition: filter1
})

var filter2 = ee.Filter.and(maxDiffFilter, greaterEqFilter)

var join2 = ee.Join.saveAll({
  matchesKey: 'before',
  ordering: 'system:time_start',
  ascending: true})
  
var join2Result = join2.apply({
  primary: join1Result,
  secondary: join1Result,
  condition: filter2
})

//##############################################################
// Step-4: Apply linear interpolation to fill each image
//##############################################################

// Once the joins are done, we don't need original NDVI images
// We keep only the blank images which now have matching NDVI images
// as properties
var filtered = join2Result.filter(ee.Filter.eq('type', 'interpolated'))

// Interpolation function
function interpolateImages(image) {
  var image = ee.Image(image)

  var beforeImages = ee.List(image.get('before'))
  var beforeMosaic = ee.ImageCollection.fromImages(beforeImages).mosaic()
  var afterImages = ee.List(image.get('after'))
  var afterMosaic = ee.ImageCollection.fromImages(afterImages).mosaic()

  var t1 = beforeMosaic.select('timestamp').rename('t1')
  var t2 = afterMosaic.select('timestamp').rename('t2')

  var t = image.metadata('system:time_start').rename('t')

  var timeImage = ee.Image.cat([t1, t2, t])

  var timeRatio = timeImage.expression('(t - t1) / (t2 - t1)', {
    't': timeImage.select('t'),
    't1': timeImage.select('t1'),
    't2': timeImage.select('t2'),
  })

  var interpolated = beforeMosaic
    .add((afterMosaic.subtract(beforeMosaic).multiply(timeRatio)))
  var result = image.unmask(interpolated)
  return result.copyProperties(image, ['system:time_start'])
}

var interpolatedColl = ee.ImageCollection(
  filtered.map(interpolateImages))
  
var interpolatedCol = ee.ImageCollection(
  filtered.map(interpolateImages)).select('ndvi')
//print('Interpolated Collection', interpolatedCol)


//##############################################################
// Step-4: Apply Savitzky-Golay filter
//##############################################################

var oeel=require('users/OEEL/lib:loadAll');
// https://www.open-geocomputing.org/OpenEarthEngineLibrary/#.ImageCollection.SavatskyGolayFilter

// Use the same maxDiffFilter we used earlier
var maxDiffFilter = ee.Filter.maxDifference({
  difference: millis,
  leftField: 'system:time_start',
  rightField: 'system:time_start'
})

// Use the default distanceFunction
var distanceFunction = function(infromedImage, estimationImage) {
  return ee.Image.constant(
      ee.Number(infromedImage.get('system:time_start'))
      .subtract(
        ee.Number(estimationImage.get('system:time_start')))
        );
  }

// Apply smoothing of order=3
var order = 3;
var smoothed = oeel.ImageCollection.SavatskyGolayFilter(
  interpolatedCol, 
  maxDiffFilter,
  distanceFunction,
  order)

// Select the d_0_ndvi band and rename it
var smoothed = smoothed.select(['d_0_ndvi'], ['smoothed_ndvi'])

// Define percentiles to threshold very high and very low NDVI
var P_95_NDVI = smoothed.reduce(ee.Reducer.percentile([95])).select('smoothed_ndvi_p95');
var P_05_NDVI = smoothed.reduce(ee.Reducer.percentile([5])).select('smoothed_ndvi_p5');

// Define a function to sort imagecollection image by image
function filterPercentiles(image) {
  
  var bool = image.lt(P_95_NDVI).and(image.gt(P_05_NDVI)); // Make a boolean showing if image meets conditions
  var boolMask = bool.selfMask(); // Create a mask from boolean

  return image.updateMask(boolMask); // Apply mask to image
}

// Map the filter function over entire smoothed ndvi ImageCollection
var ndviFilteredCollection = smoothed.map(filterPercentiles);

// Merge all images in the NDVI collection with the smoothed NDVI collection
var Allimages = ndviCol.merge(ndviFilteredCollection)

// NDVI visual parameters
// var visParams_ndvi = {min: -0.2, max: 0.8, palette: 'FFFFFF, CE7E45, DF923D, F1B555, FCD163, 99B718, 74A901, 66A000, 529400,' +
//     '3E8601, 207401, 056201, 004C00, 023B01, 012E01, 011D01, 011301'};

// Display NDVI as a map layer
// var shown = true; // true or false, 1 or 0 
// var opacity = 0.75; //layer opacity

// Display NDVI mean layer.
//Map.addLayer(ndviFinal.clip(roip), visParams_ndvi, 'NDVI', shown, opacity);

var title = 'Savitsky-Golay smoothing' +
  '(order = '+ order + ', window_size = ' + days + ')'

// Plot the original and fitted NDVI time-series
var chart = ui.Chart.image.series({
  imageCollection: Allimages,
  region: roip,
  scale: 20
}).setOptions({
      lineWidth: 1,
      title: title,
      interpolateNulls: true,
      vAxis: {title: 'NDVI'},
      hAxis: {title: '', format: 'YYYY-MMM'},
      series: {
        0: {color: 'blue', lineWidth: 1, 
          lineDashStyle: [1, 1], pointSize: 1,
          }, // Original NDVI
        1: {color: 'red', lineWidth: 2 }, // Smoothed NDVI
      },

    })
print(chart)
