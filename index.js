var fs = require('fs');
var path = require('path');
var changeCase = require('change-case');
var karma = require('karma').server;
var lazypipe = require('lazypipe');
var del = require('del');
var vinylPaths = require('vinyl-paths');
var stylish = require('jshint-stylish');
var conventionalChangelog = require('conventional-changelog');
var exec = require('child_process').exec;
var minimist = require('minimist');

var jshint = require('gulp-jshint');
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

var PREFIX_FILE = 'component.prefix',
    SUFFIX_FILE = 'component.suffix',
    PREFIX_NG_FILE = 'component.prefix.angular',
    SUFFIX_NG_FILE = 'component.suffix.angular',
    HEADER_FILE = 'header.txt',
    JSHINT_FILE = '.jshintrc',
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
      'node_modules/sofa-core/dist/sofa.core.js',
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

var jshintConfig = JSON.parse(fs.readFileSync(path.join(__dirname, JSHINT_FILE), 'utf-8'));
jshintConfig.lookup = false;

var argv = minimist(process.argv.slice(2));
var versionType = null;

['prerelease', 'minor', 'patch', 'major'].forEach(function (type) {
  if (argv[type]) {
    versionType = type;
  }
});

module.exports = function (gulp, config) {
  
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

  var jshintTasks = lazypipe()
    .pipe(jshint, jshintConfig)
    .pipe(jshint.reporter, stylish)
    .pipe(jshint.reporter, 'fail');

  gulp.task('clean', function () {
    return gulp.src(DIST_DIR)
      .pipe(vinylPaths(del));
  });

  gulp.task('jshint:src', function () {
    return gulp.src([SOURCE_JS_FILES, '!src/**/*.tpl.js'])
      .pipe(jshintTasks());
  });

  gulp.task('jshint:specs', function () {
    return gulp.src(SOURCE_SPEC_FILES)
      .pipe(jshintTasks());
  });

  gulp.task('jshint', [
    'jshint:src',
    'jshint:specs'
  ]);

  gulp.task('test', function (done) {
    karma.start({
      configFile: path.join(__dirname, KARMA_CONF_FILE),
      files: KARMA_TEST_FILES
    }, done);
  });

  gulp.task('test:continuous', ['templates'], function (done) {
    karma.start({
      configFile: path.join(__dirname, KARMA_CONF_FILE),
      singleRun: true,
      files: KARMA_TEST_FILES
    }, function () {
      done();
    });
  });

  gulp.task('test:debug', function (done) {
    karma.start({
      configFile: path.join(__dirname, KARMA_CONF_FILE),
      singleRun: false,
      files: KARMA_TEST_FILES
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

  gulp.task('build', ['scripts', 'copy', 'styles']);
  gulp.task('default', ['build']);

  gulp.task('copy', ['styles', 'scripts'], function () {

    var date = new Date();

    return gulp.src(['src/module.js', 'src/*angular.js'], { base: 'src/' })
      .pipe(ngAnnotate({
        single_quote: true,
        add: true
      }))
      .pipe(concat(componentName + '.angular.js'))
      .pipe(header(componentNGPrefix))
      .pipe(footer(componentNGSuffix))
      .pipe(header(banner, {
        pkg: config.pkg,
        date: date
      }))
      .pipe(gulp.dest(DIST_DIR))
      .pipe(uglify())
      .pipe(rename({
        extname: '.min.js'
      }))
      .pipe(header(banner, {
        pkg: config.pkg,
        date: date
      }))
      .pipe(gulp.dest(DIST_DIR));
  });

  gulp.task('scripts', ['clean', 'jshint', 'test:continuous'], function () {

    var date = new Date();

    gulp.src([
      SOURCE_SOFA_JS_FILE,
      '!src/**/*.angular.js',
      '!src/module.js',
      SOURCE_JS_FILES
    ])
    .pipe(ngAnnotate({
      single_quote: true,
      add: true
    }))
    .pipe(concat(componentName + '.js'))
    .pipe(header(componentPrefix))
    .pipe(footer(componentSuffix))
    .pipe(header(banner, {
      pkg: config.pkg,
      date: date
    }))
    .pipe(gulp.dest(DIST_DIR))
    .pipe(uglify())
    .pipe(rename({extname: '.min.js'}))
    .pipe(header(banner, {
      pkg: config.pkg,
      date: date
    }))
    .pipe(gulp.dest(DIST_DIR));


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

  gulp.task('watch', ['build'], function () {
    gulp.watch([SOURCE_JS_FILES], ['scripts']);
    gulp.watch([SOURCE_SASS_FILES], ['styles']);
    gulp.watch([SOURCE_TEMPLATE_FILES], ['templates']);
  });
};
