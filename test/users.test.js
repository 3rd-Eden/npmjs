describe('.users', function() {
  'use strict';

  var chai = require('chai')
    , expect = chai.expect;

  var Registry = require('../')
    , registry = new Registry({ registry: 'https://registry.npmjs.org' });

  var user = 'shwetasabne';

  it('has a users endpoint', function() {
    expect(registry.users).to.be.a('object');
  });

  describe('#starred', function() {
    it('retrieves packages starred by the user if such packages exist', function(next) {
      registry.users.starred('shwetasabne', function (err, data) {
        if (err) return next(err);
        expect(data).to.be.an.Array;
        next();
      });
    });
  });
});