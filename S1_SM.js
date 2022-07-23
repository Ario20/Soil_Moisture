/* File: S1_SM.js
Version: 1.2
Date: 2022-07-07
Author: Kenneth Cassar

Script adapted from: MULLISSA,A., VOLLRATH,A., ODONGO-BRAUN, C.,SLAGTER, B.,BALLING, J.,GOU, Y.,GORELICK, N.&REICHE,J. 2021. Sentinel-1 SAR Backscatter Analysis Ready Data Preparation in Google Earth Engine. Remote Sensing, 13.
Licence: (Mullissa et al., 2021) script distributed under the MIT licence
Description: This script computes analysis ready S1 image collection optimised for Soil Moisture analysis

    Parameter:
        START_DATE: The earliest date to include images for (inclusive).
        END_DATE: The latest date to include images for (exclusive).
        POLARIZATION: The Sentinel-1 image polarization to select for processing.
            'VV' - selects the VV polarization.
            'VH' - selects the VH polarization.
            "VVVH' - selects both the VV and VH polarization for processing.
        ORBIT:  The orbits to include. (string: BOTH, ASCENDING or DESCENDING)
        GEOMETRY: The region to include imagery within.
                  The user can interactively draw a bounding box within the map window or define the edge coordinates.
        APPLY_BORDER_NOISE_CORRECTION: (Optional) true or false options to apply additional Border noise correction:
        APPLY_SPECKLE_FILTERING: (Optional) true or false options to apply speckle filter
        SPECKLE_FILTER: Type of speckle filtering to apply (String). If the APPLY_SPECKLE_FILTERING parameter is true then the selected speckle filter type will be used.
            'BOXCAR' - Applies a boxcar filter on each individual image in the collection
            'LEE' - Applies a Lee filter on each individual image in the collection based on [1]
            'GAMMA MAP' - Applies a Gamma maximum a-posterior speckle filter on each individual image in the collection based on [2] & [3]
            'REFINED LEE' - Applies the Refined Lee speckle filter on each individual image in the collection
                                  based on [4]
            'LEE SIGMA' - Applies the improved Lee sigma speckle filter on each individual image in the collection
                                  based on [5]
        SPECKLE_FILTER_FRAMEWORK: is the framework where filtering is applied (String). It can be 'MONO' or 'MULTI'. In the MONO case
                                  the filtering is applied to each image in the collection individually. Whereas, in the MULTI case,
                                  the Multitemporal Speckle filter is applied based on  [6] with any of the above mentioned speckle filters.
        SPECKLE_FILTER_KERNEL_SIZE: is the size of the filter spatial window applied in speckle filtering. It must be a positive odd integer.
        SPECKLE_FILTER_NR_OF_IMAGES: is the number of images to use in the multi-temporal speckle filter framework. All images are selected before the date of image to be filtered.
                                    However, if there are not enough images before it then images after the date are selected.
        TERRAIN_FLATTENING : (Optional) true or false option to apply Terrain correction based on [7] & [8]. 
        TERRAIN_FLATTENING_MODEL : model to use for radiometric terrain normalization (DIRECT, or VOLUME)
        DEM : digital elevation model (DEM) to use (as EE asset)
        TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER : additional buffer parameter for passive layover/shadow mask in meters
        FORMAT : the output format for the processed collection. this can be 'LINEAR' or 'DB'.
        CLIP_TO_ROI: (Optional) Clip the processed image to the region of interest.
        SAVE_ASSETS : (Optional) Exports the processed collection to an asset.
        
    Returns:
        An ee.ImageCollection with an analysis ready Sentinel 1 imagery with the specified polarization images and angle band.
        
References
  [1]  J. S. Lee, “Digital image enhancement and noise filtering by use of local statistics,” 
    IEEE Pattern Anal. Machine Intell., vol. PAMI-2, pp. 165–168, Mar. 1980. 
  [2]  A. Lopes, R. Touzi, and E. Nezry, “Adaptative speckle filters and scene heterogeneity,
    IEEE Trans. Geosci. Remote Sensing, vol. 28, pp. 992–1000, Nov. 1990 
  [3]  Lopes, A.; Nezry, E.; Touzi, R.; Laur, H.  Maximum a posteriori speckle filtering and first204order texture models in SAR images.  
    10th annual international symposium on geoscience205and remote sensing. Ieee, 1990, pp. 2409–2412.
  [4] J.-S. Lee, M.R. Grunes, G. De Grandi. Polarimetric SAR speckle filtering and its implication for classification
    IEEE Trans. Geosci. Remote Sens., 37 (5) (1999), pp. 2363-2373.
  [5] Lee, J.-S.; Wen, J.-H.; Ainsworth, T.L.; Chen, K.-S.; Chen, A.J. Improved sigma filter for speckle filtering of SAR imagery. 
    IEEE Trans. Geosci. Remote Sens. 2009, 47, 202–213.
  [6] S. Quegan and J. J. Yu, “Filtering of multichannel SAR images, IEEE Trans Geosci. Remote Sensing, vol. 39, Nov. 2001.
  [7] Vollrath, A., Mullissa, A., & Reiche, J. (2020). Angular-Based Radiometric Slope Correction for Sentinel-1 on Google Earth Engine. 
    Remote Sensing, 12(11), [1867]. https://doi.org/10.3390/rs12111867
  [8] Hoekman, D.H.;  Reiche, J.   Multi-model radiometric slope correction of SAR images of complex terrain using a two-stage semi-empirical approach.
    Remote Sensing of Environment2222015,156, 1–10.
**/

// wrapper code is where all the Sentinel-1 processing takes place
var wrapper = require('users/kennethcassar/S1_SM:wrapper');

// helper (utilities) code converts linear to Db format and exports images 
var helper = require('users/kennethcassar/S1_SM:utilities');

// speckle correction code applies speckle filtering as per user selection
var speckle_correction = require('users/kennethcassar/S1_SM:speckle_correction');

// CRNS location coordinates of Hollin Hill site
var roi = ee.Geometry.Point(-0.959516,54.110676);

// Circular buffer (200m) from CRNS sensor location
var roi_buf = roi.buffer(200);

//---------------------------------------------------------------------------//
// DEFINE PARAMETERS
//---------------------------------------------------------------------------//

var parameter = {//1. Data Selection
              START_DATE: "2019-01-01",
              STOP_DATE: "2019-12-31",
              POLARIZATION:'VV',
              ORBIT : 'ASCENDING',
              //GEOMETRY: defining a region of interest
              GEOMETRY: geometry,//roi_buf, 
              //2. Additional Border noise correction
              APPLY_ADDITIONAL_BORDER_NOISE_CORRECTION: true,
              //3.Speckle filter
              APPLY_SPECKLE_FILTERING: true,
              SPECKLE_FILTER_FRAMEWORK: 'MULTI',
              SPECKLE_FILTER: 'LEE',
              SPECKLE_FILTER_KERNEL_SIZE: 9,
              SPECKLE_FILTER_NR_OF_IMAGES: 10,
              //4. Slope Correction
              APPLY_TERRAIN_FLATTENING: true,
              DEM: ee.Image('users/kennethcassar/DEM/Bluesky_DTM_Clip'),//ee.Image('USGS/SRTMGL1_003'),
              TERRAIN_FLATTENING_MODEL: 'VOLUME',
              TERRAIN_FLATTENING_ADDITIONAL_LAYOVER_SHADOW_BUFFER: 0,
              //5. Output
              FORMAT : 'DB',
              CLIP_TO_ROI: true,
              SAVE_ASSETS: false
}
//---------------------------------------------------------------------------//
// DO THE JOB
//---------------------------------------------------------------------------//
      
//Preprocess the S1 collection 
var s1_preprocces = wrapper.s1_preproc(parameter);

var s1 = s1_preprocces[0]
    s1_preprocces = s1_preprocces[1]


//---------------------------------------------------------------------------//
// VISUALIZE
//---------------------------------------------------------------------------//

//Visualization of the first image in the collection in RGB for VV, VH, images
var visparam = {}
if (parameter.POLARIZATION=='VVVH'){
    if (parameter.FORMAT=='DB'){
    var s1_preprocces_view = s1_preprocces.map(helper.add_ratio_lin).map(helper.lin_to_db2);
    var s1_view = s1.map(helper.add_ratio_lin).map(helper.lin_to_db2);
    visparam = {bands:['VV','VH','VVVH_ratio'],min: [-20, -25, 1],max: [0, -5, 15]}
    }
    else {
    var s1_preprocces_view = s1_preprocces.map(helper.add_ratio_lin);
    var s1_view = s1.map(helper.add_ratio_lin);
    visparam = {bands:['VV','VH','VVVH_ratio'], min: [0.01, 0.0032, 1.25],max: [1, 0.31, 31.62]}
    }
}
else {
    if (parameter.FORMAT=='DB') {
    s1_preprocces_view = s1_preprocces.map(helper.lin_to_db);
    s1_view = s1.map(helper.lin_to_db);
    visparam = {bands:[parameter.POLARIZATION],min: -25,max: 0}   
    }
    else {
    s1_preprocces_view = s1_preprocces;
    s1_view = s1;
    visparam = {bands:[parameter.POLARIZATION],min: 0,max: 0.2}
    }
}

var unfiltered = s1_view // define original (unfiltered) S1 imagery
var filtered = s1_preprocces_view // define processed (filtered) S1 imagery

Map.setOptions('SATELLITE'); // Generate Satellite basemap
Map.centerObject(parameter.GEOMETRY, 15); // center & zoom on roi

// add the filtered imagery layer on the basemap 
Map.addLayer(filtered.median(), visparam, 'Median image of the Speckle filtered + Slope corrected S1 collection', true);

// var shown = true;
// var opacity = 0.15;
// Map.addLayer(roi_buf, {color: 'red'},'ROI',shown, opacity);

// Rename original VV polarisation
var unfiltered = s1_view.select(['VV'], ['VV unfiltered'])

// Rename filtered VV polirisation
var filtered_VV = s1_preprocces_view.select(['VV'], ['VV filtered'])
var angle = s1_preprocces_view.select(['angle']) // define incidence angle
var filtered = filtered_VV.combine(angle) // combine filtered VV with angle

var comb = unfiltered.combine(filtered) // combined unfiltered and filtered VV polarisations

//make time series of backscattered signal for filtered (Speckle filter & Slope correction) S1 collection
var sigma_chart = ui.Chart.image.series({
     imageCollection: comb, 
     region: parameter.GEOMETRY,
     reducer: ee.Reducer.median(),// calculate median backscatter values
     scale: 20
 })
sigma_chart.setOptions({
     title: 'Speckle filtered and Slope Corrected: Polarisation = ' + parameter.POLARIZATION + 
   '(Orbit = '+ parameter.ORBIT  +', Speckle filter framework = ' + parameter.SPECKLE_FILTER_FRAMEWORK 
  + ', Speckle filter = ' + parameter.SPECKLE_FILTER + ', Slope correction model = ' + parameter.TERRAIN_FLATTENING_MODEL +')',
     vAxis: {title: 'sigma0', maxValue: 5},
     hAxis: {title: 'date', format: 'MM-yy', gridlines: {count: 7}},
   });
// Print the chart
print(sigma_chart);

//---------------------------------------------------------------------------//
// EXPORT
//---------------------------------------------------------------------------//

//Convert format for export
if (parameter.FORMAT=='DB'){
  s1_preprocces = s1_preprocces.map(helper.lin_to_db);
}

//Save processed image collection to asset
if(parameter.SAVE_ASSETS) {
helper.Download.ImageCollection.toAsset(s1_preprocces, '', 
               {scale: 10, 
               region: s1_preprocces.geometry(),
                type: 'float'})
}

//---------------------------------------------------------------------------//

//Source: https://courses.spatialthoughts.com/end-to-end-gee.html#savitzky-golay-smoothing

// Aplying Savitzky-Golay Filter on a NDVI Time-Series
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

// Define percentiles to threshold NDVI
var P_75_NDVI = smoothed.reduce(ee.Reducer.percentile([75])).select('smoothed_ndvi_p75');
var P_05_NDVI = smoothed.reduce(ee.Reducer.percentile([5])).select('smoothed_ndvi_p5');

// Define a function to sort imagecollection image by image
function filterPercentiles(image) {
  
  var bool = image.lt(P_75_NDVI).and(image.gt(P_05_NDVI)); // Make a boolean showing if image meets conditions
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
