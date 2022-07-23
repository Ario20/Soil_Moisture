/* File: speckle_correction.js
Version: 1.1
Date: 2022-07-07
Author: Kenneth Cassar

Script adapted from: MULLISSA,A., VOLLRATH,A., ODONGO-BRAUN, C.,SLAGTER, B.,BALLING, J.,GOU, Y.,GORELICK, N.&REICHE,J. 2021. Sentinel-1 SAR Backscatter Analysis Ready Data Preparation in Google Earth Engine. Remote Sensing, 13.
Licence: (Mullissa et al., 2021) script distributed under the MIT licence
Description: This script applies Speckle filtering to the S1 image collection.

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
**/

// speckle_filters code is where all the Sentinel-1 processing takes place
var speckle = require('users/kennethcassar/S1_SM:speckle_filters');

// helper (utilities) code converts linear to Db format and exports images 
var helper = require('users/kennethcassar/S1_SM:utilities');

// CRNS location coordinates of Hollin Hill site
var roi = ee.Geometry.Point(-0.959516,54.110676);

// Application of 200m circular buffer 
var roi_buf = roi.buffer(200);

//---------------------------------------------------------------------------//
// DEFINE PARAMETERS
//---------------------------------------------------------------------------//

var parameter = {//1. Data Selection
              START_DATE: "2019-01-01",
              STOP_DATE: "2019-12-31",
              POLARIZATION:'VV',
              ORBIT : 'ASCENDING',
              //GEOMETRY: defining the region of interest
              GEOMETRY: geometry,//roi_buf, 
              //2. Additional Border noise correction
              APPLY_ADDITIONAL_BORDER_NOISE_CORRECTION: true,
              //3.Speckle filter
              APPLY_SPECKLE_FILTERING: true,
              SPECKLE_FILTER_FRAMEWORK: 'MULTI',
              SPECKLE_FILTER: 'LEE',
              SPECKLE_FILTER_KERNEL_SIZE: 9,
              SPECKLE_FILTER_NR_OF_IMAGES: 10,
              //4. Output
              FORMAT : 'DB',
              CLIP_TO_ROI: false,
              SAVE_ASSETS: false
}

//---------------------------------------------------------------------------//
// DO THE JOB
//---------------------------------------------------------------------------//
      
//Preprocess the S1 collection 

var s1_preprocces = speckle.s1_preproc(parameter);

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


Map.centerObject(parameter.GEOMETRY, 13); // center & zoom on roi

// add the original imagery layer on the basemap 
Map.addLayer(unfiltered.median(), visparam, 'Median image of the input (original) S1 collection', true);
Map.addLayer(filtered.median(), visparam, 'Median image of the Speckle filtered S1 collection', true);

// Display roi polygon at 15% transparency

// var shown = true;
// var opacity = 0.10;
// Map.addLayer(roi_buf, {color: 'red'},'ROI',shown, opacity); 
Map.addLayer(roi,{'color': 'red'},'CRNS point location');

// Rename original VV for labelling in chart
var unfiltered = s1_view.select(['VV'], ['VV unfiltered'])

// Rename filtered VV for labelling in chart
var filtered_VV = s1_preprocces_view.select(['VV'], ['VV filtered'])
var angle = s1_preprocces_view.select(['angle']) // define incidence angle
var filtered = filtered_VV.combine(angle) // combine filtered VV with angle

// Combine renamed original & filtered bands
var comb = unfiltered.combine(filtered)

//make time series of backscattered signal for filtered (speckle filter & slope correction) S1 collection
var sigma_chart = ui.Chart.image.series({
     imageCollection: comb, 
     region: parameter.GEOMETRY,
     reducer: ee.Reducer.median(),
     scale: 20
 })
sigma_chart.setOptions({
     title: 'Speckle filtered: Polarisation = ' + parameter.POLARIZATION + 
   '( Orbit = '+ parameter.ORBIT  +', Speckle filter framework = ' + parameter.SPECKLE_FILTER_FRAMEWORK 
  + ', Speckle filter = ' + parameter.SPECKLE_FILTER + ')',
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
