# Shared Sofa Component Tasks

> All build tasks shared across sofa components in one place


## Installation

In your sofa component repository run:

```sh
$ npm install --save-dev gulp shared-sofa-component-tasks
```

Then add a `gulpfile.js` with the following contents:

```js
require('shared-sofa-component-tasks')(require('gulp'), {
    pkg: require('./package.json'),
    baseDir: __dirname
});
```

You can now run `gulp watch` or just `gulp build` to generate a build of your component.
