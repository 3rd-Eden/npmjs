# npm-registry

To keep myself sane while working with The npm Registry I decided to write my
own library to deal with all the incomplete, inconsistent and horrible data
structures that are available in The npm Registry. NoSQL is nice and all, but
that doesn't mean you should leave your data unmaintained. This library is never
meant as a full replacement of the `npm-registry-client` which the `npm` bin
file is using. Unless those API's and methods are so poorly implemented or
designed that I get a mental breakdown, then yes, this will become a full and
usable replacement of the above said module.

This module is written with high availability in mind. The main reason behind
this is that npm Inc. has added a lot of moving parts on top of the registry
which frequently breaks. In order to combat this I've implemented automatic
downgrading to multiple registries. If all other supplied registries fail to
work an automatic exponential randomized back off algorithm kicks in place and
retries the query once more. This functionality is all provided by the awesome
[mana] package which provides core functionality for writing sane api-clients.

## Installation

```
npm install --save npm-registry
```

And that is all you need to type in your terminal in order to prevent becoming
terminal. The `--save` tells `npm` to automatically add the package and latest
version to your `package.json`.

## Getting started

Now that you've installed the `npm-registry` module you can require and
initialize it using:

```js
'use strict';

var Registry = require('npm-registry');

var npm = new Registry({ options });
```

As seen in the example above, the `Registry` constructor allows an `Object` with
options to customize the npm registry client. The following options are supported:

- `registry` The URL of the npm registry. Defaults to Nodejitsu's mirror.
- `stats` URL of the download stats service. Defaults to npm's API server.
- `mirrors` Array of mirrors to use when a registry is down.
- `maxdelay` Maximum delay for exponential back off.
- `mindelay` Minimum delay for exponential back off.
- `githulk` Reference to a pre-configured [GitHulk] instance.
- `retries` The amount of retries we should do before giving up.
- `factor` Exponential backoff factor.
- `authorization` Optional authorization header for authorized requests.
- `user,password` Optional user/password for authorized requests.

The fully configured npm registry client can then be used to access the various
of API endpoints using:

```js
//
// npm.<endpoint>.<method>(<arg>, <callback>);
//
npm.packages.get('npm-registry', function (err, data) {
  ..
});
```

The following endpoints are available:

### Packages

The `.packages` endpoints allows you to retrieve detailed information about npm
packages. The following methods are implemented:

- `npm.packages.get`: Basic module information.
- `npm.packages.depended`: List modules that depend on the given module.
- `npm.packages.starred`: List users who starred the module.
- `npm.packages.keyword`: List packages who use this keyword.
- `npm.packages.releases`: All releases for a module.
- `npm.packages.release`: The latest release.
- `npm.packages.details`: Highly detailed information about the package.

### Users

The `.users` endpoint allows you to retrieve detailed information about a given
npm account. The following methods are implemented:


- `npm.users.list`: All packages released by the user.
- `npm.users.starred`: Packages that the user has starred.
- `npm.users.get`: Get the profile information.

## Normalization

As the internal data structure is do damn awkward and unmaintained in npm we
need to normalize the data structures before we can even try to use it. While
this normalization is part automatically done for you internally there might be
use cases where you want to manually normalize a given dataset. The normalize
module can be required directly using:

```js
var normalize = require('npmjs/normalize');
```

The `normalize` variable now contains two different functions, `users` and
`packages`. As you might have guessed, these functions normalize different data
structures. The function accepts a simple single argument which is the data
object that you receive from the npm registry endpoints.

```js
data = normalize.packages(data);
```

## License

MIT

[mana]: http://github.com/3rd-Eden/mana
[Githulk]: http://github.com/3rd-Eden/githulk
