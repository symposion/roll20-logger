'use strict';
const gulp = require('gulp');
const mocha = require('gulp-mocha');
const eslint = require('gulp-eslint');

gulp.task('default', ['test', 'lint']);

gulp.task('lint', () =>
  gulp.src('./lib/*.js')
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
);

gulp.task('test', () =>
  gulp.src('test/test-*.js', { read: false })
    .pipe(mocha())
);
