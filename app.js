var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var logger = require('morgan');
var cors = require('cors')

var indexRouter = require('./routes/index');
var apiRouter = require('./routes/apis');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.all('/*', function(req, res, next) {
  const origin_url = req.get('Origin');
  if (origin_url === 'https://aqoom.chat' || origin_url === 'https://ghobekang.github.io' || origin_url === 'http://e08c90e1dd2c.ngrok.io') {
    res.header('Access-Control-Allow-Origin', origin_url);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/static',express.static('uploads'));

app.use('/', indexRouter);
app.use('/api', apiRouter)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

module.exports = app;
