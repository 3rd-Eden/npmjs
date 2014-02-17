# npmjs

To keep myself sane while working with the npm registry I decided to write my
own library to deal with all the incomplete, inconsistent and horrible data
structures that are available in the npm registry. NoSQL is nice and all, but
that doesn't mean you should leave your data unmaintained. This library is never
meant as a full replacement of the `npm-registry-client` which the `npm` bin is
using. Unless those API's and methods are so poorly implemented or designed that
I get a mental breakdown, then yes, this will become a full and usable
replacement of the above said module.

This module is written with high availability in mind. The main reason behind
this is that npm inc. has added a lot of moving parts on top of the registry
which frequently breaks. In order to combat that we've implemented automatic
downgrading to multiple registries. If all other supplied registries fail to
work an automatic exponential randomized back off algorithm kicks in place and
retries the query once more. This functionality is all provided by the awesome
[mana] package which provides core functionality for writing sane api-clients.

## Installation

This module is released in the `npm` registry as `npmjs` because nobody bothered
registering it before. HA.

```
npm install --save npmjs
```

And that is all you need to type in your terminal in order to prevent becoming
terminal. The `--save` tells `npm` to automatically add the package and latest
version to your `package.json`.

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

## License

MIT

[mana]: http://github.com/3rd-Eden/mana
