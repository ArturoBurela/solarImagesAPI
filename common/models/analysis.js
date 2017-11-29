'use strict';

module.exports = function(Analysis) {
  /**
   * Start images analysis
   * @param {number} firstPhotoId First photo Id to start analysis
   * @param {number} lastPhotoId Last photo Id to stop analysis
   * @param {Function(Error, string, object)} callback
   */

  Analysis.start = function(firstPhotoId, lastPhotoId, callback) {
    var mapPhoto, results;
    mapPhoto = 'hola';
    results = {};
    // TODO
    callback(null, mapPhoto, results);
  };

  Analysis.remoteMethod('start');

};
