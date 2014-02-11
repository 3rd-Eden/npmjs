# npmjs

To keep myself sane while working with the npm registry I decided to write my
own library to deal with all the incomplete, inconsistent and horrible data
structures that are available in the npm registry. NoSQL is nice and all, but
that doesn't mean you should leave your data unmaintained. This library is never
meant as a full replacement of the `npm-registry-client` which the `npm` bin is
using. Unless those API's and methods are so poorly implemented or designed that
I get a mental breakdown, then yes, this will become a full and usable
replacement of the above said module.

## Installation

This module is released in the `npm` registry as `npmjs` because nobody bothered
registering it before. HA.

```
npm install --save npmjs
```

And that is all you need to type in your terminal in order to prevent becoming
terminal. The `--save` tells `npm` to automatically add the package and latest
version to your `package.json`.

## License

MIT
