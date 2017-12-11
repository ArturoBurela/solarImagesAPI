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
  const ODMDir = '/home/ODMProjects/test/';
  const image = ODMDir + 'odm_orthophoto/odm_orthophoto.tif';
  const UTMFile = ODMDir + 'odm_georeferencing/odm_georeferencing_model_geo.txt';
  const UTMFile2 = ODMDir + 'odm_orthophoto/odm_orthophoto_corners.txt';
  const BLUE = [255, 0, 0]; // B, G, R
  const RED = [0, 0, 255]; // B, G, R
  const GREEN = [0, 255, 0]; // B, G, R
  const WHITE = [255, 255, 255]; // B, G, R
  const request = require('request');
  var mapPhoto, results, cmd, x, y, zone, north, bounds;
  var lowThresh = 0;
  var highThresh = 100;
  var nIters = 2;
  var minArea = 2000;
  var center = new Array(2);
  var corner = new Array(2);
  var pi = 3.14159265358979;
  /* Ellipsoid model constants (actual values here are for WGS84) */
  var smA = 6378137.0;
  var smB = 6356752.314;
  var smEccSquared = 6.69437999013e-03;
  var UTMScaleFactor = 0.9996;

  /*
  * DegToRad
  *
  * Converts degrees to radians.
  *
  */
  function DegToRad(deg)  {
    return (deg / 180.0 * pi);
  }

  /*
  * RadToDeg
  *
  * Converts radians to degrees.
  *
  */
  function RadToDeg(rad)  {
    return (rad / pi * 180.0);
  }

  /*
  * ArcLengthOfMeridian
  *
  * Computes the ellipsoidal distance from the equator to a point at a
  * given latitude.
  *
  * Reference: Hoffmann-Wellenhof, B., Lichtenegger, H., and Collins, J.,
  * GPS: Theory and Practice, 3rd ed.  New York: Springer-Verlag Wien, 1994.
  *
  * Inputs:
  *     phi - Latitude of the point, in radians.
  *
  * Globals:
  *     sm_a - Ellipsoid model major axis.
  *     sm_b - Ellipsoid model minor axis.
  *
  * Returns:
  *     The ellipsoidal distance of the point from the equator, in meters.
  *
  */
  function ArcLengthOfMeridian(phi)  {
    var alpha, beta, gamma, delta, epsilon, n, result;

    /* Precalculate n */
    n = (smA - smB) / (smA + smB);

    /* Precalculate alpha */
    alpha = ((smA + smB) / 2.0) *
      (1.0 + (Math.pow(n, 2.0) / 4.0) + (Math.pow(n, 4.0) / 64.0));

    /* Precalculate beta */
    beta = (-3.0 * n / 2.0) + (9.0 * Math.pow(n, 3.0) / 16.0) +
      (-3.0 * Math.pow(n, 5.0) / 32.0);

    /* Precalculate gamma */
    gamma = (15.0 * Math.pow(n, 2.0) / 16.0) +
      (-15.0 * Math.pow(n, 4.0) / 32.0);

    /* Precalculate delta */
    delta = (-35.0 * Math.pow(n, 3.0) / 48.0) +
      (105.0 * Math.pow(n, 5.0) / 256.0);

    /* Precalculate epsilon */
    epsilon = (315.0 * Math.pow(n, 4.0) / 512.0);

    /* Now calculate the sum of the series and return */
    result = alpha *
      (phi + (beta * Math.sin(2.0 * phi)) +
        (gamma * Math.sin(4.0 * phi)) +
        (delta * Math.sin(6.0 * phi)) +
        (epsilon * Math.sin(8.0 * phi)));

    return result;
  }

  /*
  * UTMCentralMeridian
  *
  * Determines the central meridian for the given UTM zone.
  *
  * Inputs:
  *     zone - An integer value designating the UTM zone, range [1,60].
  *
  * Returns:
  *   The central meridian for the given UTM zone, in radians, or zero
  *   if the UTM zone parameter is outside the range [1,60].
  *   Range of the central meridian is the radian equivalent of [-177,+177].
  *
  */
  function UTMCentralMeridian(zone)  {
    var cmeridian;

    cmeridian = DegToRad(-183.0 + (zone * 6.0));

    return cmeridian;
  }

  /*
  * FootpointLatitude
  *
  * Computes the footpoint latitude for use in converting transverse
  * Mercator coordinates to ellipsoidal coordinates.
  *
  * Reference: Hoffmann-Wellenhof, B., Lichtenegger, H., and Collins, J.,
  *   GPS: Theory and Practice, 3rd ed.  New York: Springer-Verlag Wien, 1994.
  *
  * Inputs:
  *   y - The UTM northing coordinate, in meters.
  *
  * Returns:
  *   The footpoint latitude, in radians.
  *
  */
  function FootpointLatitude(y)  {
    var y_, alpha_, beta_, gamma_, delta_, epsilon_, n, result;

    /* Precalculate n (Eq. 10.18) */
    n = (smA - smB) / (smA + smB);

    /* Precalculate alpha_ (Eq. 10.22) */
    /* (Same as alpha in Eq. 10.17) */
    alpha_ = ((smA + smB) / 2.0) *
      (1 + (Math.pow(n, 2.0) / 4) + (Math.pow(n, 4.0) / 64));

    /* Precalculate y_ (Eq. 10.23) */
    y_ = y / alpha_;

    /* Precalculate beta_ (Eq. 10.22) */
    beta_ = (3.0 * n / 2.0) + (-27.0 * Math.pow(n, 3.0) / 32.0) +
      (269.0 * Math.pow(n, 5.0) / 512.0);

    /* Precalculate gamma_ (Eq. 10.22) */
    gamma_ = (21.0 * Math.pow(n, 2.0) / 16.0) +
      (-55.0 * Math.pow(n, 4.0) / 32.0);

    /* Precalculate delta_ (Eq. 10.22) */
    delta_ = (151.0 * Math.pow(n, 3.0) / 96.0) +
      (-417.0 * Math.pow(n, 5.0) / 128.0);

    /* Precalculate epsilon_ (Eq. 10.22) */
    epsilon_ = (1097.0 * Math.pow(n, 4.0) / 512.0);

    /* Now calculate the sum of the series (Eq. 10.21) */
    result = y_ + (beta_ * Math.sin(2.0 * y_)) +
      (gamma_ * Math.sin(4.0 * y_)) +
      (delta_ * Math.sin(6.0 * y_)) +
      (epsilon_ * Math.sin(8.0 * y_));

    return result;
  }

  /*
  * MapLatLonToXY
  *
  * Converts a latitude/longitude pair to x and y coordinates in the
  * Transverse Mercator projection.  Note that Transverse Mercator is not
  * the same as UTM; a scale factor is required to convert between them.
  *
  * Reference: Hoffmann-Wellenhof, B., Lichtenegger, H., and Collins, J.,
  * GPS: Theory and Practice, 3rd ed.  New York: Springer-Verlag Wien, 1994.
  *
  * Inputs:
  *    phi - Latitude of the point, in radians.
  *    lambda - Longitude of the point, in radians.
  *    lambda0 - Longitude of the central meridian to be used, in radians.
  *
  * Outputs:
  *    xy - A 2-element array containing the x and y coordinates
  *         of the computed point.
  *
  * Returns:
  *    The function does not return a value.
  *
  */
  function MapLatLonToXY(phi, lambda, lambda0, xy)  {
    var N, nu2, ep2, t, t2, l;
    var l3coef, l4coef, l5coef, l6coef, l7coef, l8coef;
    var tmp;

    /* Precalculate ep2 */
    ep2 = (Math.pow(smA, 2.0) - Math.pow(smB, 2.0)) / Math.pow(smB, 2.0);

    /* Precalculate nu2 */
    nu2 = ep2 * Math.pow(Math.cos(phi), 2.0);

    /* Precalculate N */
    N = Math.pow(smA, 2.0) / (smB * Math.sqrt(1 + nu2));

    /* Precalculate t */
    t = Math.tan(phi);
    t2 = t * t;
    tmp = (t2 * t2 * t2) - Math.pow(t, 6.0);

    /* Precalculate l */
    l = lambda - lambda0;

    /* Precalculate coefficients for l**n in the equations below
       so a normal human being can read the expressions for easting
       and northing
       -- l**1 and l**2 have coefficients of 1.0 */
    l3coef = 1.0 - t2 + nu2;

    l4coef = 5.0 - t2 + 9 * nu2 + 4.0 * (nu2 * nu2);

    l5coef = 5.0 - 18.0 * t2 + (t2 * t2) + 14.0 * nu2 -
      58.0 * t2 * nu2;

    l6coef = 61.0 - 58.0 * t2 + (t2 * t2) + 270.0 * nu2 -
      330.0 * t2 * nu2;

    l7coef = 61.0 - 479.0 * t2 + 179.0 * (t2 * t2) - (t2 * t2 * t2);

    l8coef = 1385.0 - 3111.0 * t2 + 543.0 * (t2 * t2) - (t2 * t2 * t2);

    /* Calculate easting (x) */
    xy[0] = N * Math.cos(phi) * l +
      (N / 6.0 * Math.pow(Math.cos(phi), 3.0) * l3coef * Math.pow(l, 3.0)) +
      (N / 120.0 * Math.pow(Math.cos(phi), 5.0) * l5coef * Math.pow(l, 5.0)) +
      (N / 5040.0 * Math.pow(Math.cos(phi), 7.0) * l7coef * Math.pow(l, 7.0));

    /* Calculate northing (y) */
    xy[1] = ArcLengthOfMeridian(phi) +
      (t / 2.0 * N * Math.pow(Math.cos(phi), 2.0) * Math.pow(l, 2.0)) +
      (t / 24.0 * N * Math.pow(Math.cos(phi), 4.0) * l4coef * Math.pow(l, 4.0)) +
      (t / 720.0 * N * Math.pow(Math.cos(phi), 6.0) * l6coef * Math.pow(l, 6.0)) +
      (t / 40320.0 * N * Math.pow(Math.cos(phi), 8.0) * l8coef * Math.pow(l, 8.0));
    return;
  }

  /*
  * MapXYToLatLon
  *
  * Converts x and y coordinates in the Transverse Mercator projection to
  * a latitude/longitude pair.  Note that Transverse Mercator is not
  * the same as UTM; a scale factor is required to convert between them.
  *
  * Reference: Hoffmann-Wellenhof, B., Lichtenegger, H., and Collins, J.,
  *   GPS: Theory and Practice, 3rd ed.  New York: Springer-Verlag Wien, 1994.
  *
  * Inputs:
  *   x - The easting of the point, in meters.
  *   y - The northing of the point, in meters.
  *   lambda0 - Longitude of the central meridian to be used, in radians.
  *
  * Outputs:
  *   philambda - A 2-element containing the latitude and longitude
  *               in radians.
  *
  * Returns:
  *   The function does not return a value.
  *
  * Remarks:
  *   The local variables Nf, nuf2, tf, and tf2 serve the same purpose as
  *   N, nu2, t, and t2 in MapLatLonToXY, but they are computed with respect
  *   to the footpoint latitude phif.
  *
  *   x1frac, x2frac, x2poly, x3poly, etc. are to enhance readability and
  *   to optimize computations.
  *
  */
  function MapXYToLatLon(x, y, lambda0, philambda)  {
    var phif, Nf, Nfpow, nuf2, ep2, tf, tf2, tf4, cf;
    var x1frac, x2frac, x3frac, x4frac, x5frac, x6frac, x7frac, x8frac;
    var x2poly, x3poly, x4poly, x5poly, x6poly, x7poly, x8poly;

    /* Get the value of phif, the footpoint latitude. */
    phif = FootpointLatitude(y);

    /* Precalculate ep2 */
    ep2 = (Math.pow(smA, 2.0) - Math.pow(smB, 2.0)) /
      Math.pow(smB, 2.0);

    /* Precalculate cos (phif) */
    cf = Math.cos(phif);

    /* Precalculate nuf2 */
    nuf2 = ep2 * Math.pow(cf, 2.0);

    /* Precalculate Nf and initialize Nfpow */
    Nf = Math.pow(smA, 2.0) / (smB * Math.sqrt(1 + nuf2));
    Nfpow = Nf;

    /* Precalculate tf */
    tf = Math.tan(phif);
    tf2 = tf * tf;
    tf4 = tf2 * tf2;

    /* Precalculate fractional coefficients for x**n in the equations
       below to simplify the expressions for latitude and longitude. */
    x1frac = 1.0 / (Nfpow * cf);

    Nfpow *= Nf;   /* now equals Nf**2) */
    x2frac = tf / (2.0 * Nfpow);

    Nfpow *= Nf;   /* now equals Nf**3) */
    x3frac = 1.0 / (6.0 * Nfpow * cf);

    Nfpow *= Nf;   /* now equals Nf**4) */
    x4frac = tf / (24.0 * Nfpow);

    Nfpow *= Nf;   /* now equals Nf**5) */
    x5frac = 1.0 / (120.0 * Nfpow * cf);

    Nfpow *= Nf;   /* now equals Nf**6) */
    x6frac = tf / (720.0 * Nfpow);

    Nfpow *= Nf;   /* now equals Nf**7) */
    x7frac = 1.0 / (5040.0 * Nfpow * cf);

    Nfpow *= Nf;   /* now equals Nf**8) */
    x8frac = tf / (40320.0 * Nfpow);

    /* Precalculate polynomial coefficients for x**n.
       -- x**1 does not have a polynomial coefficient. */
    x2poly = -1.0 - nuf2;

    x3poly = -1.0 - 2 * tf2 - nuf2;

    x4poly = 5.0 + 3.0 * tf2 + 6.0 * nuf2 - 6.0 * tf2 * nuf2 -
      3.0 * (nuf2 * nuf2) - 9.0 * tf2 * (nuf2 * nuf2);

    x5poly = 5.0 + 28.0 * tf2 + 24.0 * tf4 + 6.0 * nuf2 + 8.0 * tf2 * nuf2;

    x6poly = -61.0 - 90.0 * tf2 - 45.0 * tf4 - 107.0 * nuf2 +
      162.0 * tf2 * nuf2;

    x7poly = -61.0 - 662.0 * tf2 - 1320.0 * tf4 - 720.0 * (tf4 * tf2);

    x8poly = 1385.0 + 3633.0 * tf2 + 4095.0 * tf4 + 1575 * (tf4 * tf2);

    /* Calculate latitude */
    philambda[0] = phif + x2frac * x2poly * (x * x) +
      x4frac * x4poly * Math.pow(x, 4.0) +
      x6frac * x6poly * Math.pow(x, 6.0) +
      x8frac * x8poly * Math.pow(x, 8.0);

    /* Calculate longitude */
    philambda[1] = lambda0 + x1frac * x +
      x3frac * x3poly * Math.pow(x, 3.0) +
      x5frac * x5poly * Math.pow(x, 5.0) +
      x7frac * x7poly * Math.pow(x, 7.0);

    return;
  }

  /*
  * LatLonToUTMXY
  *
  * Converts a latitude/longitude pair to x and y coordinates in the
  * Universal Transverse Mercator projection.
  *
  * Inputs:
  *   lat - Latitude of the point, in radians.
  *   lon - Longitude of the point, in radians.
  *   zone - UTM zone to be used for calculating values for x and y.
  *          If zone is less than 1 or greater than 60, the routine
  *          will determine the appropriate zone from the value of lon.
  *
  * Outputs:
  *   xy - A 2-element array where the UTM x and y values will be stored.
  *
  * Returns:
  *   The UTM zone used for calculating the values of x and y.
  *
  */
  function LatLonToUTMXY(lat, lon, zone, xy)  {
    MapLatLonToXY(lat, lon, UTMCentralMeridian(zone), xy);

    /* Adjust easting and northing for UTM system. */
    xy[0] = xy[0] * UTMScaleFactor + 500000.0;
    xy[1] = xy[1] * UTMScaleFactor;
    if (xy[1] < 0.0)
      xy[1] = xy[1] + 10000000.0;

    return zone;
  }

  /*
  * UTMXYToLatLon
  *
  * Converts x and y coordinates in the Universal Transverse Mercator
  * projection to a latitude/longitude pair.
  *
  * Inputs:
  *	x - The easting of the point, in meters.
  *	y - The northing of the point, in meters.
  *	zone - The UTM zone in which the point lies.
  *	southhemi - True if the point is in the southern hemisphere;
  *               false otherwise.
  *
  * Outputs:
  *	latlon - A 2-element array containing the latitude and
  *            longitude of the point, in radians.
  *
  * Returns:
  *	The function does not return a value.
  *
  */
  function UTMXYToLatLon(x, y, zone, southhemi, latlon)  {
    var cmeridian;

    x -= 500000.0;
    x /= UTMScaleFactor;

    /* If in southern hemisphere, adjust y accordingly. */
    if (southhemi)
      y -= 10000000.0;

    y /= UTMScaleFactor;

    cmeridian = UTMCentralMeridian(zone);
    MapXYToLatLon(x, y, cmeridian, latlon);

    return;
  }

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

  function readCoordinates(callback) {
    // Read geo center of photo in UTM format and convert it to Lat,Long
    fs.readFile(UTMFile, 'utf8', function(err, data) {
      if (err) throw err;
      var s = data.split(/\n/);
      var s1 = s[0].split(' ');
      var s2 = s[1].split(' ');
      // Get UTM zone, north, x and y
      zone = Number(s1[2].substring(0, s1[2].length - 1));
      north = s1[2].charAt(s1[2].length - 1) == 'N' ? false : true;
      x = Number(s2[0]);
      y = Number(s2[1]);
      // Compute lat, long coordinates of the photo
      UTMXYToLatLon(x, y, zone, north, center);
      center[0] = RadToDeg(center[0]);
      center[1] = RadToDeg(center[1]);
      console.log(zone);
      console.log(north);
      console.log(x);
      console.log(y);
      console.log(center);
      // Read borders bounds in UTM
      fs.readFile(UTMFile2, 'utf8', function(err, data2) {
        if (err) throw err;
        var s = data2.split(' ');
        bounds = new Array(4);
        bounds[0] = Number(s[0]);
        bounds[1] = Number(s[1]);
        bounds[2] = Number(s[2]);
        bounds[3] = Number(s[3]);
        console.log('Bounds:');
        console.log(bounds[0]);
        console.log(bounds[1]);
        console.log(bounds[2]);
        console.log(bounds[3]);
        // Calculate UTM pos of one corner
        corner[0] = x + bounds[0];
        corner[1] = y + bounds[3];
        callback();
      });
    });
  }

  function measure(lat1, lon1, lat2, lon2) {  // generally used geo measurement function
    var R = 6378.137; // Radius of earth in KM
    var dLat = lat2 * Math.PI / 180 - lat1 * Math.PI / 180;
    var dLon = lon2 * Math.PI / 180 - lon1 * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d * 1000; // meters
  }

  function objectDetection(callback) {
    console.log('Running object detection');
    // Load Lat Long of image center
    readCoordinates(function() {
      cv.readImage(image, function(err, im) {
        if (err) throw err;
        // Get image width and height
        var width = im.width();
        var height = im.height();
        if (width < 1 || height < 1) throw new Error('Image has no size');
        // New matrix of image size
        var out = new cv.Matrix(height, width);
        // Calculate change in lat, long per pixel
        var change = (Math.abs((x + bounds[0]) - (x + bounds[2]))) / width;
        console.log(change);
        im.convertGrayscale();
        // Use canny algorithms
        var imCanny = im.copy();
        // Set threshold
        imCanny.canny(lowThresh, highThresh);
        imCanny.dilate(nIters);
        // Use canny to find contours
        var contours = imCanny.findContours();
        var j = 0;
        // Iterate through contours to draw and create result
        for (var i = 0; i < contours.size(); i++) {
          if (contours.area(i) < minArea) continue;
          var arcLength = contours.arcLength(i, true);
          contours.approxPolyDP(i, 0.00001 * arcLength, true);
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
          var temp = [];
          for (var c = 0; c < contours.cornerCount(i); ++c) {
            var p = new Array(2);
            var x1, y1;
            var point = contours.point(i, c);
            x1 = ((point.x * change) + corner[0]);
            y1 = ((point.y * change) + corner[1]);
            UTMXYToLatLon(x1, y1, zone, north, p);
            p[0] = RadToDeg(p[0]);
            p[1] = RadToDeg(p[1]);
            temp.push(p);
            console.log(p);
          }
          results.push(temp);
        }
        // Save
        out.save('shapes.png');
        console.log('Borders image saved correctly');
        console.log('New console.log');
        callback();
      });
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

  function getImages(id1, id2) {
    for (var i = id1; i <= id2; i++) {
      request('https://predix-solar-api.run.aws-usw02-pr.ice.predix.io/api/Photos/' + i, function(error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        var File;
        base64Decode(body, File);
      });
    }
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
    results = [];
    // Get all images from blobstore and store them locally
    getImages();
    // Use OpenDrone to create mapPhoto
    openDroneMap();
    // Identify Objects in global map image
    objectDetection(function() {
      console.log(results.length);
      // Convert map to base 64
      // return map picture and results
      callback(null, {mapPhoto: mapPhoto, results: results});
    });
  };
};
