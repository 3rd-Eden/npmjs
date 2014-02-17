'use strict';

var normalize = require('../normalize');

/**
 * Access users based request information.
 *
 * @constructor
 * @param {Registry} api Reference to the wrapping registry.
 * @api private
 */
function Users(api) {
  this.api = api;
  this.send = api.send.bind(api);
  this.view = api.view.bind(api);
}

/**
 * Add a user as maintainer of a package.
 *
 * @param {String} name The user's name who needs to own the package.
 * @param {String} pkg The module it should become an owner off.
 * @param {Function} fn The callback.
 * @returns {Assign}
 * @api public
 */
Users.prototype.add = function add(name, pkg, fn) {
  return this.send(name, {
    method: 'PUT',
    json: {}
  }, fn);
};

/**
 * List all packages for the given name.
 *
 * @param {String} name The user's name who's packages we want to list.
 * @param {Function} fn The callback.
 * @returns {Assign}
 * @api public
 */
Users.prototype.list = function list(name, fn) {
  return this.view('browseAuthors', {
    key: name
  }, fn).map(this.api.map.simple);
};

/**
 * List all packages that the user has starred.
 *
 * @param {String} name The user's name
 * @param {Function} fn The callback.
 * @returns {Assign}
 * @api public
 */
Users.prototype.starred = function starred(name, fn) {
  return this.view('browseStarUser', {
    key: name
  }, fn).map(this.api.map.simple);
};

/**
 * Get profile information.
 *
 * @param {String} name The user's name.
 * @param {Function} fn The callback.
 * @returns {Assign}
 * @api public
 */
Users.prototype.get = function get(name, fn) {
  name = '/-/user/org.couchdb.user:'+ name;

  return this.send(name, fn).map(normalize);
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
Users.prototype.sync = function sync(source, target, options, fn) {
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

//
// Expose module.
//
module.exports = Users;
