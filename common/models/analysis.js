'use strict';

module.exports = function(Analysis) {
  /**
   * Start images analysis
   * @param {number} firstPhotoId First photo Id to start analysis
   * @param {number} lastPhotoId Last photo Id to stop analysis
   * @param {Function(Error, string, object)} callback
   */
  const exec = require('child_process');

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
    // Identify Objects in global map image
    // Convert map to base 64
    // return map picture and results
    var x = {mapPhoto: mapPhoto, results: results};
    callback(null, x);
  };
};
