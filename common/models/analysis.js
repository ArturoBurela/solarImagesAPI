'use strict';

module.exports = function(Analysis) {
  /**
   * Start images analysis
   * @param {number} firstPhotoId First photo Id to start analysis
   * @param {number} lastPhotoId Last photo Id to stop analysis
   * @param {Function(Error, string, object)} callback
   */
  const exec = require('child_process').execSync;
  const cv = require('opencv');
  const fs = require('fs');
  const image = '/home/ODMProjects/test/odm_orthophoto/odm_orthophoto.tif';
  const BLUE = [255, 0, 0]; // B, G, R
  const RED = [0, 0, 255]; // B, G, R
  const GREEN = [0, 255, 0]; // B, G, R
  const WHITE = [255, 255, 255]; // B, G, R
  var mapPhoto, results, cmd;
  var lowThresh = 0;
  var highThresh = 100;
  var nIters = 2;
  var minArea = 2000;

  function openDroneMap() {
    console.log('Runnig open drone map');
    // Execute python command to call openDrone
    cmd = 'python /usr/local/OpenDrone/run.py -i /home/tempImages/ test';
    exec(cmd, function(error, stdout, stderr) {
      // command output is in stdout
      console.log(error);
      console.log(stdout);
      console.log(stderr);
    });
  }

  function objectDetection() {
    console.log('Running object detection');
    cv.readImage(image, function(err, im) {
      if (err) throw err;
      // Get image width and height
      var width = im.width();
      var height = im.height();
      if (width < 1 || height < 1) throw new Error('Image has no size');
      // New matrix of image size
      var out = new cv.Matrix(height, width);
      im.convertGrayscale();
      // Use canny algorithms
      var imCanny = im.copy();
      // Set threshold
      imCanny.canny(lowThresh, highThresh);
      imCanny.dilate(nIters);
      // Use canny to find contours
      var contours = imCanny.findContours();
      // Iterate through contours to draw and create result
      for (var i = 0; i < contours.size(); i++) {
        if (contours.area(i) < minArea) continue;
        var arcLength = contours.arcLength(i, true);
        contours.approxPolyDP(i, 0.001 * arcLength, true);
        switch (contours.cornerCount(i)) {
          case 3:
            out.drawContour(contours, i, GREEN);
            break;
          case 4:
            out.drawContour(contours, i, RED);
            break;
          default:
            out.drawContour(contours, i, WHITE);
        }
      }
      // Save
      out.save('shapes.png');
      console.log('Borders image saved correctly');
    });
  }

  // function to encode file data to base64 encoded string
  function base64Encode(file) {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    var x = Buffer(bitmap).toString('base64');
    console.log(x);
    return new Buffer(bitmap).toString('base64');
  }

// function to create file from base64 encoded string
  function base64Decode(base64str, file) {
    // create buffer object from base64 encoded string, it is important to tell the constructor that the string is base64 encoded
    var bitmap = new Buffer(base64str, 'base64');
    // write buffer to file
    fs.writeFileSync(file, bitmap);
  }

  function getImages() {
    console.log('Running copy of images');
    cmd = 'cp /home/imagesSD/* /home/tempImages';
    exec(cmd, function(error, stdout, stderr) {
      // command output is in stdout
      console.log(error);
      console.log(stdout);
      console.log(stderr);
    });
  }

  function clean() {
    // Command to delete ODM Project
    cmd = 'rm -rf /home/ODMProjects/test/';
    exec(cmd, function(error, stdout, stderr) {
      // command output is in stdout
      console.log(error);
      console.log(stdout);
      console.log(stderr);
    });
    // Command to delete tmpImages
    cmd = 'rm -rf /home/tempImages/*';
    exec(cmd, function(error, stdout, stderr) {
      // command output is in stdout
      console.log(error);
      console.log(stdout);
      console.log(stderr);
    });
    // Delete borders png
    cmd = 'rm /home/solarImagesAPI/shapes.png';
    exec(cmd, function(error, stdout, stderr) {
      // command output is in stdout
      console.log(error);
      console.log(stdout);
      console.log(stderr);
    });
  }

  Analysis.start = function(firstPhotoId, lastPhotoId, callback) {
    results = {};
    // Get all images from blobstore and store them locally
    getImages();
    // Use OpenDrone to create mapPhoto
    openDroneMap();
    // Identify Objects in global map image
    objectDetection();
    // Convert map to base 64
    console.log('Converting photo');
    var bitmap = fs.readFileSync(image);
    // convert binary data to base64 encoded string
    var x = Buffer(bitmap).toString('base64');
    // Delete files to save space
    // clean();
    mapPhoto = x;
    // return map picture and results
    callback(null, {mapPhoto: mapPhoto, results: results});
  };
};
