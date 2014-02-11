'use strict';

var debug = require('debug')('npmjs')
  , Assignment = require('assign')
  , request = require('request')
  , url = require('url');

//
// Cached variables to improve performance.
//
var slice = Array.prototype.slice;

/**
 * A simple npm registry interface for data retrieval.
 *
 * @constructor
 * @param {String} URL The URL of the npm registry.
 * @api public
 */
function Registry(URL) {
  if (!(this instanceof Registry)) return new Registry(URL);

  this.registry = URL || Registry.mirrors.nodejitsu;
}

/**
 * Parse the given arguments because we don't want to do an optional queue check
 * for every single API endpoint.
 *
 * @param {Arguments} args Arguments
 * @returns {Object}
 * @api private
 */
Registry.prototype.args = function parser(args) {
  var optional = slice.call(arguments, 1);
  args = slice.call(args, 0);

  return optional.reduce(function optional(data, key, index) {
    data[key] = args[index];
    return data;
  }, { value: args.shift(), fn: args.pop() });
};

/**
 * Retrieve something from the CouchDB registry.
 *
 * @param {String} pathname The path.
 * @param {Function} fn The callback.
 * @api private
 */
Registry.prototype.send = function requesting(pathname, fn) {
  var location = url.resolve(this.registry, pathname)
    , assign = new Assignment(this, fn);

  debug('getting url: %s', location);

  request({
    method: 'GET',
    strictSSL: false,
    uri: location
  }, function received(err, res, body) {
    if (err) return assign.destroy(err);
    if (res.statusCode !== 200) {
      err = new Error([
        'Received an invalid status code',
        res.statusCode,
        ''
      ].join(' '));

      err.statusCode = res.statusCode;  // Reference to the status code.
      err.url = location;               // The URL location.

      debug(err.message);
      return assign.destroy(err);
    }

    //
    // In this case I prefer to manually parse the JSON response as it allows us
    // to return more readable error messages.
    //
    var data;
    try { data = JSON.parse(body); }
    catch (e) {
      err = new Error('Failed to parse the JSON response: '+ e.message);
      debug(err.message);
      assign.destroy(err);
      return;
    }

    assign.write(data, { end: true });
  });

  return assign;
};

/**
 * Define an lazy loading API.
 *
 * @param {Object} where Where should we define the property
 * @param {String} name The name of the property
 * @param {Function} fn The function that returns the new value
 * @api private
 */
Registry.define = function define(where, name, fn) {
  Object.defineProperty(where, name, {
    configurable: true,
    get: function get() {
      return Object.defineProperty(this, name, {
        value: fn.call(this)
      })[name];
    },
    set: function set(value) {
      return Object.defineProperty(this, name, {
        value: value
      })[name];
    }
  });
};

//
// Lazy load the various of endpoints so they only get initialized when we
// actually need them.
//
Registry.define(Registry.prototype, 'packages', function define() {
  return new Registry.Packages(this);
});

//
// Expose API end points
//
Registry.Packages = require('./endpoints/packages');

//
// Expose list of public endpoints that people can use to connect.
//
Registry.mirrors = {
  nodejitsu:  'http://registry.nodejitsu.com/',
  strongloop: 'http://npm.strongloop.com/',
  npmjsau:    'http://registry.npmjs.org.au/',
  npmjseu:    'http://registry.npmjs.eu/',
  npmjs:      'http://registry.npmjs.org/'
};

//
// Expose the module interface.
//
module.exports = Registry;
