'use strict';

var debug = require('debug')('npmjs')
  , Assignment = require('assign')
  , request = require('request')
  , back = require('back')
  , url = require('url');

//
// Cached variables to improve performance.
//
var toString = Object.prototype.toString
  , slice = Array.prototype.slice;

/**
 * A simple npm registry interface for data retrieval.
 *
 * The following options are accepted:
 *
 * - registry: Registry URL we want to connect to.
 * - user: Name of the account.
 * - password: Password of the account.
 * - mirrors: Alternate mirrors we should use when we receive an error.
 * - factor: Backoff factor.
 * - mindelay: Minimum backoff delay.
 * - maxdelay: Maximum backoff delay.
 * - retries: Maximum amount of retries.
 *
 * @constructor
 * @param {Object} options Configuration
 * @api public
 */
function Registry(options) {
  if (!(this instanceof Registry)) return new Registry(options);

  options = options || {};

  options.registry = 'registry' in options ? options.registry : Registry.mirrors.nodejitsu;
  options.mirrors = 'mirrors' in options ? options.mirros : Object.keys(Registry.mirrors);
  options.maxdelay = 'maxdelay' in options ? options.maxdelay : 60000;
  options.mindelay = 'mindelay' in options ? options.mindelay : 100;
  options.factor = 'factor' in options ? options.factor : 2;

  this.mirrors = options.mirrors;
  this.registry = options.registry;
  this.mindelay = options.mindelay;
  this.maxdelay = options.maxdelay;
  this.retries = options.retries;
  this.factor = options.factor;
  this.authorization = undefined;

  //
  // Pre-compile the basic authorization so we can do updates and deletes
  // against the registries.
  //
  if (options.user && options.password) {
    this.authorization = 'Basic '+ new Buffer(
      options.user +':'+ options.password
    ).toString('base64');
  }
}

/**
 * Parse the given arguments because we don't want to do an optional queue check
 * for every single API endpoint.
 *
 * @param {Arguments} args Arguments.
 * @returns {Object} type => based object.
 * @api private
 */
Registry.prototype.args = function parser(args) {
  var registry = this;

  return slice.call(args, 0).reduce(function parse(data, value) {
    data[registry.type(value)] = value;
    return data;
  }, {});
};

/**
 * Get accurate type information for the given JavaScript class.
 *
 * @param {Mixed} of The thing who's type class we want to figure out.
 * @returns {String} lowercase variant of the name
 * @api private
 */
Registry.prototype.type = function type(of) {
  return toString.call(of).slice(8, -1).toLowerCase();
};

/**
 * Retrieve something from the CouchDB registry.
 *
 * @param {String} pathname The path.
 * @param {Function} fn The callback.
 * @api private
 */
Registry.prototype.send = function requesting(args) {
  args = this.args(arguments);

  var location = url.resolve(this.registry, args.string)
    , assign = new Assignment(this, args.function)
    , options = args.object || {};

  options.uri = 'uri' in options ? options.uri : location;
  options.method = 'method' in options ? options.method : 'GET';
  options.strictSSL = 'strictSSL' in options ? options.strictSSL : false;
  options.headers = 'headers' in options ? options.headers : {};
  options.backoff = {
    retries: 'retries' in options ? options.retires : this.retries,
    minDelay: 'mindelay' in options ? options.mindelay : this.mindelay,
    maxDelay: 'maxdelay' in options ? options.maxdelay : this.maxdelay,
    factor: 'factor' in options ? options.factor : this.factor
  };

  //
  // Add some extra HTTP headers so it would be easier to get a normal response
  // from the server.
  //
  [
    {
      key: 'User-Agent',
      value: 'npmjs/'+ this.version + ' node/'+ process.version
    }, {
      key: 'Authorization',
      value: this.authorization
    }, {
      key: 'Accept',
      value: 'application/json'
    }
  ].forEach(function each(header) {
    if (
         header.key in options.headers                // Already defined.
      || header.key.toLowerCase() in options.headers  // Alternate.
      || !header.value                                // No value, ignore this.
    ) return;

    options.headers[header.key] = header.value;
  });

  debug('getting url: %s', options.uri);

  /**
   *
   * @param {Error} err Optional error argument.
   * @param {Object} res HTTP response object.
   * @param {String} body The registry response.
   * @api private
   */
  function parse(err, res, body) {
    if (err) return assign.destroy(err);
    if (res.statusCode !== 200) {
      err = new Error([
        'Received an invalid status code',
        res.statusCode,
        'when requesting URL',
        location
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
    var data = body;

    if ('string' === typeof data) {
      try { data = JSON.parse(body); }
      catch (e) {
        err = new Error('Failed to parse the JSON response: '+ e.message);
        debug(err.message);
        return assign.destroy(err);
      }
    }

    assign.write(data, { end: true });
  }

  request(options, parse);
  return assign;
};

/**
 *
 */
Registry.prototype.view = function view(args) {
  args = this.args(arguments);

  return this.request();
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
Registry.define(Registry.prototype, 'packages', function defined() {
  return new Registry.Packages(this);
});

Registry.define(Registry.prototype, 'users', function defined() {
  return new Registry.Users(this);
});

//
// Expose API end points.
//
Registry.Packages = require('./endpoints/packages');
Registry.Users    = require('./endpoints/users');

//
// Expose list of public endpoints that people can use to connect.
//
Registry.mirrors = {
  nodejitsu:    'http://registry.nodejitsu.com/',
  strongloop:   'http://npm.strongloop.com/',
  npmjsau:      'http://registry.npmjs.org.au/',
  npmjseu:      'http://registry.npmjs.eu/',
  npmjs:        'http://registry.npmjs.org/'
};

//
// Expose the module interface.
//
module.exports = Registry;
