'use strict';

var normalize = require('npm-normalize');

/**
 * @constructor
 * @param {Registry} api Reference to the wrapping registry.
 * @api private
 */
function User(api) {
  this.api = api;
  this.send = api.send.bind(api);
}

/**
 * Add a user as maintainer of a package.
 *
 * @param {String} name The user's name who needs to own the package.
 * @param {String} pkg The module it should become an owner off.
 * @param {Function} fn The callback.
 * @api public
 */
User.prototype.add = function add(name, pkg, fn) {

};

/**
 * List all packages for the given name.
 *
 * @param {String} name The user's name who's packages we want to list
 * @param {Function} fn The callback.
 * @api public
 */
User.prototype.list = function list(name, fn) {
  return this.send();
};

/**
 * Get profile information.
 *
 * @param {String} name The user's name.
 * @param {Function} fn The callback.
 * @api public
 */
User.prototype.get = function get(name, fn) {
  name = '/-/user/org.couchdb.user:'+ name;
  return this.send(name, fn).map(function map(data) {
    // @TODO github parsing
    // @TODO twitter normalization
    // @TODO email clean up
    // @TODO get all users packages
    return normalize(data || {});
  });
};

/**
 * Sync ownership of npm modules with another account. This is useful if you
 * have one base owner of modules like a corporate account and you want to
 * on-board a new user.
 *
 * @param {String} source The user's packages that needs to be synced.
 * @param {String} target The user who needs to have ownership.
 * @param {Object} options Configuration of the sync process.
 * @api public
 */
User.prototype.sync = function sync(source, target, options, fn) {
  if ('function' === typeof options) {
    fn = options;
    options = null;
  }

  options = options || {};
  options.add = 'add' in options ? options.add : true;
  options.packages = 'packages' in options ? options.packages : false;

  var user = this;

  this.list(source, function (err, packages) {
    user.api.async.each(packages, function (name, next) {
      user.add(target, name, next);
    }, fn);
  });
};
