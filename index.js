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

  //
  // Get an array of active npm mirrors.
  //
  var mirrors = Object.keys(Registry.mirrors).map(function map(mirror) {
    return Registry.mirrors[mirror];
  });

  options.registry = 'registry' in options ? options.registry : Registry.mirrors.nodejitsu;
  options.mirrors = 'mirrors' in options ? options.mirrors : mirrors;
  options.maxdelay = 'maxdelay' in options ? options.maxdelay : 60000;
  options.mindelay = 'mindelay' in options ? options.mindelay : 100;
  options.factor = 'factor' in options ? options.factor : 2;
  options.retries = 'retries' in options ? options.retries : 3;

  this.authorization = options.authorization;
  this.mirrors = options.mirrors;
  this.registry = options.registry;
  this.mindelay = options.mindelay;
  this.maxdelay = options.maxdelay;
  this.retries = options.retries;
  this.factor = options.factor;

  //
  // Pre-compile the basic authorization so we can do updates and deletes
  // against the registries.
  //
  if (!this.authorization && options.user && options.password) {
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
  var registry = this
    , alias = {
        'function': 'fn',       // My preferred callback name.
        'object':   'options',  // Objects are usually options.
        'string':   'str',      // Shorter to write.
        'number':   'nr'        // ditto.
      };

  return slice.call(args, 0).reduce(function parse(data, value) {
    var type = registry.type(value);
    data[type] = value;

    if (type in alias) {
      data[alias[type]] = data[type];
    }

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
 * @param {Arguments} args
 * @returns {Assign}
 * @api public
 */
Registry.prototype.send = function send(args) {
  args = this.args(arguments);

  var mirrors = [ this.registry ].concat(this.mirrors || [])
    , assign = new Assignment(this, args.fn)
    , options = args.options || {};

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

  this.downgrade(mirrors, function downgraded(err, root, next) {
    options.uri = url.resolve(root, args.str);

    /**
     * Handle the requests.
     *
     * @param {Error} err Optional error argument.
     * @param {Object} res HTTP response object.
     * @param {String} body The registry response.
     * @api private
     */
    function parse(err, res, body) {
      if (err || !res || res.statusCode !== 200) {
        if (err) err = err.message;
        else err = 'Received an invalid status code %s when requesting URL %s';

        debug(err, res ? res.statusCode : '', options.uri);
        return next();
      }

      //
      // In this case I prefer to manually parse the JSON response as it allows us
      // to return more readable error messages.
      //
      var data = body;

      if ('string' === typeof data) {
        try { data = JSON.parse(body); }
        catch (e) {
          debug('Failed to parse JSON: %s', err.message);
          return next();
        }
      }

      assign.write(data, { end: true });
    }

    //
    // The error indicates that we've ran out of mirrors, so we should try
    // a backoff operation against the default npm registry, which is provided
    // by the callback. If the backoff fails, we should completely give up and
    // return an useful error back to the client.
    //
    if (!err) return request(options, parse);

    back(function toTheFuture(err, backoff) {
      options.backoff = backoff;

      debug('Starting request again after back off attempt %s/%s', backoff.attempt, backoff.retries);
      if (!err) return request(options, parse);

      //
      // Okay, we can assume that shit is seriously wrong here.
      //
      return assign.destroy(new Error('Failed to process request'));
    }, options.backoff);
  });

  return assign;
};

/**
 * Downgrade the list of given npm mirrors so we can query against a different
 * server when our default registry is down.
 *
 * @param {Array} mirrors The list of npm registry mirrors we can query against.
 * @param {Function} fn The callback.
 * @api private
 */
Registry.prototype.downgrade = function downgrade(mirrors, fn) {
  var registry = this;

  //
  // Remove duplicates as we don't want to test against the same server twice as
  // we already received an error. An instant retry isn't that useful in most
  // cases as we should give the server some time to cool down.
  //
  mirrors = mirrors.filter(function dedupe(item, i, all) {
    if (!item) return false; // Removes undefined, null and other garbage.
    return all.indexOf(item) === i;
  });

  (function recursive() {
    var reg = mirrors.shift();

    //
    // We got a valid registry that we can query against.
    //
    if (reg) return fn(undefined, reg, recursive);

    //
    // No registries available, the callback should start an back off operation
    // against the default provided npm registry.
    //
    fn(
      new Error('No npm registries available, everything seems down.'),
      registry.registry,
      recursive
    );
  }());

  return this;
};

/**
 * Retrieve data from a CouchDB view.
 *
 * @returns {Assign}
 */
Registry.prototype.view = function view(args) {
  args = this.args(arguments);

  return this.send(args.fn);
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
