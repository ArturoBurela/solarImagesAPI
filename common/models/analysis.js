'use strict';

module.exports = function(Analysis) {
  /**
   * Start images analysis
   * @param {number} firstPhotoId First photo Id to start analysis
   * @param {number} lastPhotoId Last photo Id to stop analysis
   * @param {Function(Error, string, object)} callback
   */
  const exec = require('child_process').exec;
  const cv = require('opencv');

  Analysis.start = function(firstPhotoId, lastPhotoId, callback) {
    var mapPhoto, results;
    mapPhoto = 'hola';
    results = firstPhotoId.toString();
    // Get all images from blobstore and store them locally
    // Use OpenDrone
    var cmd = 'pwd';
    exec(cmd, function(error, stdout, stderr) {
      // command output is in stdout
      console.log(error);
      console.log(stdout);
      console.log(stderr);
    });
    var lowThresh = 0;
    var highThresh = 100;
    var nIters = 2;
    var minArea = 2000;
    var BLUE = [255, 0, 0]; // B, G, R
    var RED = [0, 0, 255]; // B, G, R
    var GREEN = [0, 255, 0]; // B, G, R
    var WHITE = [255, 255, 255]; // B, G, R
    cv.readImage('/home/ODMProjects/test/odm_orthophoto/odm_orthophoto.png', function(err, im) {
      if (err) throw err;
      var width = im.width();
      var height = im.height();
      if (width < 1 || height < 1) throw new Error('Image has no size');
      var out = new cv.Matrix(height, width);
      im.convertGrayscale();
      var imCanny = im.copy();
      imCanny.canny(lowThresh, highThresh);
      imCanny.dilate(nIters);
      var contours = imCanny.findContours();
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
      out.save('detect-shapes.png');
      console.log('Image saved to ./tmp/detect-shapes.png');
    });
    // Identify Objects in global map image
    // Convert map to base 64
    // return map picture and results
    var x = {mapPhoto: mapPhoto, results: results};
    callback(null, x);
  };
};
