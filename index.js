'use strict';

var debug = require('debug')('npmjs')
  , mana = require('mana');

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
var Registry = mana.extend({
  /**
   * Initialise the module.
   *
   * @param {Object} options npmjs configuration.
   * @api private
   */
  initialise: function initialise(options) {
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
    options.githulk = 'githulk' in options ? options.githulk : null;
    options.retries = 'retries' in options ? options.retries : 3;
    options.factor = 'factor' in options ? options.factor : 2;

    this.authorization = options.authorization;
    this.mirrors = options.mirrors;
    this.mindelay = options.mindelay;
    this.maxdelay = options.maxdelay;
    this.githulk = options.githulk;
    this.retries = options.retries;
    this.factor = options.factor;
    this.api = options.registry;

    //
    // Pre-compile the basic authorization so we can do updates and deletes
    // against the registries.
    //
    if (!this.authorization && options.user && options.password) {
      debug('received authorization information for %s', options.user);
      this.authorization = new Buffer(
        options.user +':'+ options.password
      ).toString('base64');
    }

    if (Buffer.isBuffer(this.authorization)) {
      this.authorization = 'Basic '+ this.authorization;
    }
  },

  /**
   * Common map operations that can be shared between the different endpoints.
   *
   * @type {Object}
   * @private
   */
  map: {
    simple: function simple(data) {
      return {
        name: data[1],
        description: data[2]
      };
    }
  }
}).drink(module);

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
