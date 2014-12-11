var fs = require('fs');
var path = require('path');
var changeCase = require('change-case');
var karma = require('karma').server;
var lazypipe = require('lazypipe');
var del = require('del');
var vinylPaths = require('vinyl-paths');
var stylish = require('jshint-stylish');
var conventionalChangelog = require('conventional-changelog');

var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var cssmin = require('gulp-cssmin');
var ngAnnotate = require('gulp-ng-annotate');
var header = require('gulp-header');
var footer = require('gulp-footer');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var html2js = require('gulp-ng-html2js');

var PREFIX_FILE = 'component.prefix',
    SUFFIX_FILE = 'component.suffix',
    HEADER_FILE = 'header.txt',
    JSHINT_FILE = '.jshintrc',
    CHANGELOG_FILE = 'CHANGELOG.md',
    KARMA_CONF_FILE = 'karma.conf.js',
    SOURCE_SOFA_JS_FILE = 'src/sofa.js',
    SOURCE_JS_FILES = 'src/**/*.js',
    SOURCE_SASS_FILES = 'src/*.scss',
    SOURCE_TEMPLATE_FILES = 'src/**/*.tpl.html',
    DIST_DIR = 'dist';

var banner = fs.readFileSync(path.join(__dirname, HEADER_FILE), 'utf-8');
var componentPrefix = fs.readFileSync(PREFIX_FILE, 'utf-8');
var componentSuffix = fs.readFileSync(SUFFIX_FILE, 'utf-8');

var jshintConfig = JSON.parse(fs.readFileSync(path.join(__dirname, JSHINT_FILE), 'utf-8'));
jshintConfig.lookup = false;

module.exports = function (gulp, config) {
  
  var componentName = changeCase.camelCase(config.pkg.name.replace('angular-', ''));
  var jshintTasks = lazypipe()
    .pipe(jshint, jshintConfig)
    .pipe(jshint.reporter, stylish)
    .pipe(jshint.reporter, 'fail');

  gulp.task('clean', function () {
    return gulp.src(DIST_DIR)
      .pipe(vinylPaths(del));
  });

  gulp.task('jshint:src', function () {
    return gulp.src(['src/**/*.js', '!src/**/*.tpl.js'])
      .pipe(jshintTasks());
  });

  gulp.task('jshint:specs', function () {
    return gulp.src('test/**/*.spec.js')
      .pipe(jshintTasks());
  });

  gulp.task('jshint', [
    'jshint:src',
    'jshint:specs'
  ]);

  gulp.task('test', function (done) {
    karma.start({
      configFile: path.join(config.baseDir, KARMA_CONF_FILE)
    }, done);
  });

  gulp.task('test:continuous', ['templates'], function (done) {
    karma.start({
      configFile: path.join(config.baseDir, KARMA_CONF_FILE),
      singleRun: true
    }, function () {
      done();
    });
  });

  gulp.task('test:debug', function (done) {
    karma.start({
      configFile: path.join(config.baseDir, KARMA_CONF_FILE),
      singleRun: false
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

  gulp.task('build', ['scripts', 'styles']);
  gulp.task('default', ['build']);

  gulp.task('scripts', ['clean', 'jshint', 'test:continuous'], function () {
    return gulp.src([
      SOURCE_SOFA_JS_FILE,
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
      date: new Date()
    }))
    .pipe(gulp.dest(DIST_DIR))
    .pipe(uglify())
    .pipe(rename({extname: '.min.js'}))
    .pipe(header(banner, {
      pkg: config.pkg,
      date: new Date()
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

  gulp.task('watch', ['build'], function () {
    gulp.watch([SOURCE_JS_FILES], ['scripts']);
    gulp.watch([SOURCE_SASS_FILES], ['styles']);
    gulp.watch([SOURCE_TEMPLATE_FILES], ['templates']);
  });
};
