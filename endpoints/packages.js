'use strict';

var debug = require('debug')('npmjs::packages')
  , normalize = require('../normalize')
  , licenses = require('licenses')
  , semver = require('../semver');

/**
 * Get all package information.
 *
 * @constructor
 * @param {Registry} api Reference to the wrapping registry.
 * @api private
 */
function Packages(api) {
  this.api = api;

  this.send = api.send.bind(api);
  this.view = api.view.bind(api);
}

/**
 * Get information from the npm package.
 *
 * @param {String} name The name of the node module.
 * @param {Function} fn The callback.
 * @returns {Assign}
 * @api public
 */
Packages.prototype.get = function get(name, fn) {
  return this.send(name, fn).map(normalize.packages);
};

/**
 * Get all packages that are depended upon a given package name.
 *
 * @param {String} name The name of the node module.
 * @param {Function} fn The callback
 * @returns {Assign}
 * @api public
 */
Packages.prototype.depended = function depended(name, fn) {
  return this.view('dependedUpon', {
    key: name
  }, fn).map(this.api.map.simple);
};

/**
 * Find out which users have starred the given package.
 *
 * @param {String} name The name of the node module.
 * @param {Function} fn The callback
 * @returns {Assign}
 * @api public
 */
Packages.prototype.starred = function starred(name, fn) {
  return this.view('browseStarPackage', {
    key: name
  }, fn).map(function map(data) {
    return data[2];
  });
};

/**
 * Find all packages that matches the giving keywords.
 *
 * @param {String} name The keyword.
 * @param {Function} fn The callback.
 * @returns {Assign}
 * @api public
 */
Packages.prototype.keyword = function keyword(name, fn) {
  return this.view('byKeyword', {
    key: name
  }, fn).map(this.api.map.simple);
};

/**
 * Retrieve all release specific information for the given package name.
 *
 * @param {String} name The package name.
 * @param {Function} fn The callback.
 * @api public
 */
Packages.prototype.releases = function releases(name, fn) {
  return this.get(name, fn).emits(function emit(data, add) {
    if (!data.versions) return;

    //
    // Add all versions of the given module.
    //
    Object.keys(data.versions).forEach(function addmore(version) {
      var release = data.versions[version];
      release.date = data.time[version];

      add(release);
    });

    //
    // Also add each tag to the releases.
    //
    if ('dist-tags' in data) Object.keys(data['dist-tags']).forEach(function (key) {
      var version = data['dist-tags'][key]
        , release = JSON.parse(JSON.stringify(data.versions[version]));

      //
      // The JSON.parse(JSON.stringify)) is needed to create a full clone of the
      // data structure as we're adding tags. That would be override during the
      // `reduce` procedure.
      //

      release.date = data.time[version];
      release.tag = key;

      add(release);
    });

    return false;
  }).map(function map(release) {
    return {
        tag: release.tag || ''
      , name: release.name || ''
      , version: release.version || '0.0.0'
      , shasum: release.dist.shasum || ''
      , dependencies: release.dependencies || {}
      , license: release.license || release.licenses
      , devDependencies: release.devDependencies || {}
      , peerDependencies: release.peerDependencies || {}
      , date: release.date || '1970-01-01T00:00:00.000Z'
    };
  }).reduce(function reduce(memo, release) {
      memo[release.tag || release.version] = release;
      return memo;
  }, {});
};

/**
 * Get a version for a specific release.
 *
 * @param {String} name The name of the package.
 * @param {String} version The version number we should retrieve.
 * @param {Function} fn The callback.
 * @api public
 */
Packages.prototype.release = function release(name, range, fn) {
  return this.releases(name, function releases(err, versions) {
    if (err) return fn(err);

    if (range in versions) {
      debug('found and direct range (%s) match for %s', range, name);
      return fn(undefined, versions[range]);
    }

    var version = semver.maxSatisfying(Object.keys(versions), range);

    debug('max satisfying version for %s is %s', name, version);
    fn(undefined, versions[version]);
  });
};

/**
 * Retrieve additional details for the package information. This a lot slower
 * than a simple `.get` but much more detailed and accurate as it uses custom
 * parsers and mapping operations to parse the data as good as possible.
 *
 * @param {String} name The name of the node module.
 * @param {Function} fn The callback.
 * @returns {Assign}
 * @api public
 */
Packages.prototype.details = function details(name, fn) {
  return this.get(name, fn).async.map(function map(data, next) {
    licenses(data, function parsed(err, licenses) {
      if (err) return next(err);

      data.licenses = licenses;
      next(undefined, data);
    });
  });
};

//
// Expose the module.
//
module.exports = Packages;
