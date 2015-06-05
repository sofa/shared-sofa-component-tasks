var fs = require('fs');
var path = require('path');
var changeCase = require('change-case');
var karma = require('karma').server;
var lazypipe = require('lazypipe');
var del = require('del');
var vinylPaths = require('vinyl-paths');
var conventionalChangelog = require('conventional-changelog');
var exec = require('child_process').exec;
var minimist = require('minimist');

var eslint = require('gulp-eslint');
var babel = require('gulp-babel');
var sass = require('gulp-sass');
var cssmin = require('gulp-cssmin');
var ngAnnotate = require('gulp-ng-annotate');
var header = require('gulp-header');
var footer = require('gulp-footer');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var ifThen = require('gulp-if');
var rename = require('gulp-rename');
var html2js = require('gulp-ng-html2js');
var bump = require('gulp-bump');
var replace = require('gulp-replace');
var sofaAnnotate = require('gulp-sofa-define-annotation');

var PREFIX_FILE = 'component.prefix',
    SUFFIX_FILE = 'component.suffix',
    PREFIX_NG_FILE = 'component.prefix.angular',
    SUFFIX_NG_FILE = 'component.suffix.angular',
    HEADER_FILE = 'header.txt',
    ESLINT_FILE = '.eslintrc',
    BOWER_JSON_FILE = 'bower.json',
    PACKAGE_JSON_FILE = 'package.json',
    CHANGELOG_FILE = 'CHANGELOG.md',
    KARMA_CONF_FILE = 'karma.conf.js',
    SOURCE_SOFA_JS_FILE = 'src/sofa.js',
    SOURCE_NG_MODULE_FILE = 'src/module.js',
    SOURCE_NG_JS_FILES = 'src/*.angular.js',
    SOURCE_JS_FILES = 'src/**/*.js',
    SOURCE_SASS_FILES = 'src/*.scss',
    SOURCE_TEMPLATE_FILES = 'src/**/*.tpl.html',
    SOURCE_SPEC_FILES = 'test/**/*.spec.js',
    DIST_DIR = 'dist';
    KARMA_TEST_FILES = [
      'node_modules/sofa-core/dist/sofaCore.js',
      'node_modules/sofa-storages/dist/sofa.storages.js',
      'node_modules/sofa-testing/mocks/sofa.config.mock.js',
      'node_modules/angular/angular.js',
      'node_modules/angular-mocks/angular-mocks.js',
    ];

var banner = fs.readFileSync(path.join(__dirname, HEADER_FILE), 'utf-8');
var componentPrefix = fs.readFileSync(path.join(__dirname, PREFIX_FILE), 'utf-8');
var componentSuffix = fs.readFileSync(path.join(__dirname, SUFFIX_FILE), 'utf-8');
var componentNGPrefix = fs.readFileSync(path.join(__dirname, PREFIX_NG_FILE), 'utf-8');
var componentNGSuffix = fs.readFileSync(path.join(__dirname, SUFFIX_NG_FILE), 'utf-8');

var argv = minimist(process.argv.slice(2));
var versionType = null;

['prerelease', 'minor', 'patch', 'major'].forEach(function (type) {
  if (argv[type]) {
    versionType = type;
  }
});

module.exports = function (gulp, config) {
  var sequence = require('run-sequence').use(gulp);

  if (config.componentPrefix) {
    componentPrefix = fs.readFileSync(path.join(config.baseDir, config.componentPrefix), 'utf-8');
  }

  if (config.componentSuffix) {
    componentSuffix = fs.readFileSync(path.join(config.baseDir, config.componentSuffix), 'utf-8');
  }
  
  var componentName = changeCase.camelCase(config.pkg.name.replace('angular-', ''));
  config.testDependencyFiles = config.testDependencyFiles || [];

  var isAngularPackage = config.pkg.name.indexOf('angular-') != -1;

  KARMA_TEST_FILES = KARMA_TEST_FILES.concat(config.testDependencyFiles.map(function (file) {
    return path.join(config.baseDir, file);
  }));


  if (config.sourceFiles) {
    KARMA_TEST_FILES = KARMA_TEST_FILES.concat(config.sourceFiles.map(function (file) {
      return path.join(config.baseDir, file);
    }));
  } else {
    KARMA_TEST_FILES.push(path.join(config.baseDir, SOURCE_JS_FILES));
  }

  KARMA_TEST_FILES.push(path.join(config.baseDir, SOURCE_SPEC_FILES));

  var eslintTasks = lazypipe()
    .pipe(eslint, {
      configFile: path.join(__dirname, ESLINT_FILE),
      reset: true
    })
    .pipe(eslint.formatEach, 'stylish')
    .pipe(eslint.failOnError);

  gulp.task('clean', function () {
    return gulp.src(DIST_DIR)
      .pipe(vinylPaths(del));
  });

  gulp.task('linting:src', function () {
    return gulp.src([SOURCE_JS_FILES, '!src/**/*.tpl.js'])
      .pipe(eslintTasks());
  });

  gulp.task('linting:specs', function () {
    return gulp.src(SOURCE_SPEC_FILES)
      .pipe(eslintTasks());
  });

  gulp.task('linting', [
    'linting:src',
    'linting:specs'
  ]);

  gulp.task('test', function (done) {
    var preproc = {};
    preproc[path.join(config.baseDir, SOURCE_SPEC_FILES)] = ['babel'];
    preproc[path.join(config.baseDir, SOURCE_JS_FILES)] = ['sofa-define-annotation', 'babel'];
    karma.start({
      configFile: path.join(__dirname, KARMA_CONF_FILE),
      files: KARMA_TEST_FILES,
      preprocessors: preproc
    }, done);
  });

  gulp.task('test:continuous', ['templates'], function (done) {
    var preproc = {};
    preproc[path.join(config.baseDir, SOURCE_SPEC_FILES)] = ['babel'];
    preproc[path.join(config.baseDir, SOURCE_JS_FILES)] = ['sofa-define-annotation', 'babel'];
    karma.start({
      configFile: path.join(__dirname, KARMA_CONF_FILE),
      singleRun: true,
      files: KARMA_TEST_FILES,
      preprocessors: preproc
    }, function () {
      done();
    });
  });

  gulp.task('test:debug', function (done) {
    var preproc = {};
    preproc[path.join(config.baseDir, SOURCE_SPEC_FILES)] = ['babel'];
    preproc[path.join(config.baseDir, SOURCE_JS_FILES)] = ['sofa-define-annotation', 'babel'];
    karma.start({
      configFile: path.join(__dirname, KARMA_CONF_FILE),
      singleRun: false,
      files: KARMA_TEST_FILES,
      preprocessors: preproc
    }, done);
  });

  gulp.task('test:autowatch', function (done) {
    var preproc = {};
    preproc[path.join(config.baseDir, SOURCE_SPEC_FILES)] = ['babel'];
    preproc[path.join(config.baseDir, SOURCE_JS_FILES)] = ['sofa-define-annotation', 'babel'];
    karma.start({
      configFile: path.join(__dirname, KARMA_CONF_FILE),
      singleRun: false,
      files: KARMA_TEST_FILES,
      autoWatch: true,
      preprocessors: preproc
    }, done);
  });

  gulp.task('templates', function () {
    return gulp.src(SOURCE_TEMPLATE_FILES)
      .pipe(html2js())
      .pipe(gulp.dest('src'));
  });

  gulp.task('changelog', function (done) {

    var file = path.join(config.baseDir, CHANGELOG_FILE);

    conventionalChangelog({
      repository: config.pkg.repository.url,
      version: config.pkg.version
    }, function (err, log) {
      fs.writeFileSync(file, log);
      done()
    });
  });

  gulp.task('bump', function () {
    return gulp.src([
      path.join(config.baseDir, BOWER_JSON_FILE),
      path.join(config.baseDir, PACKAGE_JSON_FILE)
    ]).pipe(bump({ type: versionType }))
      .pipe(gulp.dest(config.baseDir));
  });

  gulp.task('build', ['scripts', 'angular:transpiling', 'styles']);
  gulp.task('default', ['build']);

  function decorateScripts (files, type, headerStream, footerStream, angularSuffix) {
    type = (type === 'ignore') ? '' : type;
    var date = new Date();
    var concatName = (angularSuffix) ? componentName + '.angular.js' : componentName + '.js';
    return files
      .pipe(ngAnnotate({
        single_quote: true,
        add: true
      }))
      .pipe(ifThen(type === 'ignore', concat(concatName)))
      .pipe(headerStream)
      .pipe(footerStream)
      .pipe(header(banner, {
        pkg: config.pkg,
        date: date
      }))
      .pipe(gulp.dest(DIST_DIR + '/' + type))
      .pipe(uglify())
      .pipe(rename({extname: '.min.js'}))
      .pipe(header(banner, {
        pkg: config.pkg,
        date: date
      }))
      .pipe(gulp.dest(DIST_DIR + '/' + type));
  }


  ['common', 'amd', 'system', 'ignore'].forEach(function (type) {
    gulp.task('scripts:transpile:' + type, function () {
        var files = gulp.src([
          SOURCE_SOFA_JS_FILE,
          '!src/**/*.angular.js',
          '!src/module.js',
          SOURCE_JS_FILES
        ])
        .pipe(sofaAnnotate())
        .pipe(babel({
          modules: type
        }));


        return decorateScripts(
          files, 
          type,
          isAngularPackage ? header(componentNGPrefix) : header(componentPrefix),
          isAngularPackage ? footer(componentNGSuffix) : footer(componentSuffix)
        );
      });

      gulp.task('angular:transpile:' + type, function () {
        var files = gulp.src(['src/module.js', 'src/*angular.js'], { base: 'src/' })
          .pipe(babel({
              modules: type
          }));

          return decorateScripts(files, type, header(componentNGPrefix), footer(componentNGSuffix), true);
      });
  });

  gulp.task('scripts:copy', function () { 
      var date = new Date();
      return gulp.src([
          SOURCE_SOFA_JS_FILE,
          '!src/**/*.angular.js',
          '!src/module.js',
          SOURCE_JS_FILES
        ])
        .pipe(header(banner, {
          pkg: config.pkg,
          date: date
        }))
        .pipe(gulp.dest(DIST_DIR + '/es6'));
  });

  gulp.task('scripts', ['clean', 'linting', 'test:continuous'], function (done) {
    return sequence(
      [
        'scripts:transpile:common',
        'scripts:transpile:amd',
        'scripts:transpile:system',
        'scripts:transpile:ignore',
        'scripts:copy'
      ],
      done
    );
  });

  gulp.task('angular:copy', function () {
    var date = new Date();
    return gulp.src(['src/module.js', 'src/*angular.js'], { base: 'src/' })
      .pipe(header(banner, {
        pkg: config.pkg,
        date: date
      }))
      .pipe(gulp.dest(DIST_DIR + '/es6'));
  });

  gulp.task('angular:transpiling', ['styles', 'scripts'], function (done) {
    return sequence(
      [
        'angular:transpile:common',
        'angular:transpile:amd',
        'angular:transpile:system',
        'angular:transpile:ignore',
        'angular:copy'
      ],
      done
    );
  });


  gulp.task('styles', ['clean'], function () {
    return gulp.src(SOURCE_SASS_FILES)
      .pipe(sass())
      .pipe(gulp.dest(DIST_DIR))
      .pipe(cssmin())
      .pipe(rename({extname: '.min.css'}))
      .pipe(gulp.dest(DIST_DIR));
  });

  gulp.task('deploy', ['bump', 'build', 'changelog'], function (done) {
    var version = JSON.parse(fs.readFileSync(path.join(config.baseDir, PACKAGE_JSON_FILE), 'utf-8')).version;
    var commitMessage = 'chore(' + componentName + '): release ' + version;

    var commands = [
      'git add .',
      'git commit -m "' + commitMessage + '"',
      'git tag ' + version,
      'git push --tags origin master',
      'npm publish'
    ].join(' && ');

    exec(commands, function (err, stdout) {
      console.log(stdout);
      done(err);
    });
  });

  gulp.task('npm-owners', function(done) {
    exec(path.join(__dirname, 'node_modules/.bin/npm-owners') + ' ' +
         path.join(__dirname, 'npm-owners'), function(err, stdout) {
        console.log(stdout);
        done(err);
    }); 
  });

  gulp.task('watch', ['build'], function () {
    gulp.watch([SOURCE_JS_FILES], ['scripts']);
    gulp.watch([SOURCE_SASS_FILES], ['styles']);
    gulp.watch([SOURCE_TEMPLATE_FILES], ['templates']);
  });
};
