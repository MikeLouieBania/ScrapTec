var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session');
var { PrismaClient } = require('@prisma/client');


// Initialize Prisma client
const prisma = new PrismaClient(); 

// Middleware for handling session data
const authMiddlewareUser = require('./controllers/authMiddlewareUser');
const authMiddlewareManager = require('./controllers/authMiddlewareManager'); 

// Configure routes
var indexRoutes = require('./routes/index'); 
var userRoutes = require('./routes/user');
var managerRoutes = require('./routes/manager');
var adminRoutes = require('./routes/admin');

var app = express();

asdasd

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
  secret: 'randomkeyheehehehe', // Replace with a secret key for session data encryption
  resave: false,
  saveUninitialized: true
}));

app.use('/', indexRoutes); 
app.use('/user', authMiddlewareUser.requireLogin, userRoutes); 
app.use('/manager', managerRoutes);
app.use('/admin', adminRoutes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
