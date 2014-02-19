'use strict';

var creation = '2010-01-14T01:41:08-08:00'  // The date that the registry got spec'd.
  , toString = Object.prototype.toString
  , semver = require('./semver');

/**
 * Get accurate type information for the given JavaScript class.
 *
 * @param {Mixed} of The thing who's type class we want to figure out.
 * @returns {String} lowercase variant of the name.
 * @api private
 */
function type(of) {
  return toString.call(of).slice(8, -1).toLowerCase();
}

/**
 * Normalize user profile information.
 *
 * @param {Object} data The profile data.
 * @returns {Object} The cleaned up data structure.
 * @api public
 */
function users(data) {
  if (!data || 'object' !== type(data)) return {};

  //
  // Clean up github information by extracting github user name from the URL and
  // reconstructing it. People can put anything in here, so we just want to make
  // sure that WE decided on the our internal structure, not the users.
  //
  if (data.github) {
    var github = /github\.com\/([^\/]+)\/?/gi;

    if ('string' !== typeof data.github) {
      delete data.github;
    } else if (github.test(data.github)) {
      data.github = github.exec(data.github)[1];
    } else {
      data.github = data.github.replace(/^https?:\/\/(www\.)?github\.com\//i, '');
    }
  }

  //
  // It's possible that the twitter profile is stored with an `@` prefix or with
  // a full URL. We only need the twitter handle as we can construct the URL's
  // our self.
  //
  if (data.twitter) {
    var twitter = /twitter.com\/[#!@\/]{0,}([^\/]+)\/?/gi;

    if ('string' !== typeof data.twitter) {
      delete data.twitter;
    } else if (data.twitter.indexOf('@') === 0) {
      data.twitter = data.twitter.slice(1);
    } else if (twitter.test(data.twitter)) {
      data.twitter = twitter.exec(data.twiter)[1];
    } else {
      data.twitter = data.twitter
        .replace(/^@*(.*)/, '$1')
        .replace(/^https?:\/\/twitter.com\//i, '');
    }
  }

  return data;
}

/**
 * Normalize package data.
 *
 * @param {Object} data The package data.
 * @returns {Object} The cleaned up data structure.
 * @api public
 */
function packages(data) {
  if (!data || 'object' !== type(data)) return {};

  var releases = Object.keys(data.versions || data.times || {})
    , latest;

  releases.filter(function clean(version) {
    try { return !!semver.valid(version, true); }
    catch (e) { return false; }
  }).sort(function sort(a, b) {
    return semver.gt(a, b) ? -1 : 1;
  });

  //
  // Clean up the dist-tags before we can figure out the latest package.
  //
  if ('object' !== typeof data['dist-tags']) data['dist-tags'] = {};
  if (!('latest' in data['dist-tags'])) data['dist-tags'].latest = releases[0];

  latest = (data.versions || {})[data['dist-tags'].latest] || {};

  [
    { key: 'bundledDependencies',   value: [] },
    { key: 'dependencies',          value: {} },
    { key: 'description',           value: '' },
    { key: 'devDependencies',       value: {} },
    { key: 'engines',               value: {} },
    { key: 'keywords',              value: [] },
    { key: 'maintainers',           value: [] },
    { key: 'optionalDependencies',  value: {} },
    { key: 'peerDependencies',      value: {} },
    { key: 'readme',                value: '' },
    { key: 'readmeFilename',        value: '' },
    { key: 'scripts',               value: {} },
    { key: 'time',                  value: {} },
    { key: 'version',               value: '' },
    { key: 'versions',              value: {} },
  ].forEach(function each(transform) {
    var key = transform.key;

    data[key] = data[key] || latest[key] || transform.value;

    //
    // Additional check to ensure that the field has the correct value. Or we
    // will default to our normal value.
    //
    if (type(data[transform.key]) !== type(transform.value)) {
      data[transform.key] = transform.value;
    }
  });

  // These can not be transformed to a normal value that easily
  data._id = data.name = data.name || data._id || latest.name || latest._id;
  data.releases = releases;
  data.latest = latest;

  //
  // Transform keywords in to an array.
  //
  if ('string' === typeof data.keywords) data.keywords.split(/[\s|,]{1,}/);
  if (!Array.isArray(data.keywords)) delete data.keywords;

  //
  // Add modification and creation as real date objects to the data structure.
  // They are hidden in a `time` object.
  //
  if (!data.modified || !data.created) {
    data.modified = data.modified || data.mtime;
    data.created = data.created || data.time;

    if ('object' === typeof data.time) {
      if (data.time.modified && !data.modified) data.modified = data.time.modified;
      if (data.time.created && !data.created) data.created = data.time.created;
    }

    data.modified = data.modified || creation;
    data.created = data.created || creation;
  }

  //
  // Transform all dates to valid Date instances.
  //
  if ('string' === typeof data.modified) data.modified = new Date(data.modified);
  if ('string' === typeof data.created) data.created = new Date(data.created);

  Object.keys(data.time).forEach(function normalize(version) {
    data.time[version] = new Date(data.time[version]);
  });

  //
  // data.users is actually the people who've starred this module using npm.star
  // nobody in their right minds would have known that if you know what you're
  // looking for.
  //
  data.starred = Object.keys(data.users || latest.users || {});

  //
  // Clean up the data structure with information that is not needed or is
  // pointlessly recursive. Or should not be defined if it's empty.
  //
  if (!data.readmeFilename) delete data.readmeFile;
  if (data._attachments) delete data._attachments;
  if (!data.readme) delete data.readme;

  // @TODO reuse github information for missing bugs fields.
  // @TODO normalize .web / .url in repo, license author etc.
  // @TODO reuse github for homepage.
  return data;
}

//
// Expose the packages and users.
//
exports.packages = packages;
exports.users = users;
