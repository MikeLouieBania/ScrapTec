const express = require('express');
const router = express.Router();
const session = require('express-session');
const app = express();
app.use(express.json());
const bcrypt = require('bcrypt');

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient();

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000 // 24 hours
  }
}));

// Middleware to check if user is authenticated
function authenticate(req, res, next) {
  if (!req.session.userId) {
    res.redirect('/login');
  } else {
    next();
  }
}

// Middleware to check user type and restrict access to specific routes
async function restrictAccess(userType, req, res, next) {
  if (req.session.userId) {
    try {
      const user = await prisma.User.findUnique({
        where: { id: req.session.userId },
      });

      if (user.usertype !== userType) {
        if (user.usertype === 'Admin') {
          res.redirect('/admin');
        } else if (user.usertype === 'Manager') {
          res.redirect('/manager');
        } else {
          res.redirect('/user');
        }
      } else {
        next();
      }
    } catch (err) {
      console.log(err);
      res.status(500).send('Internal server error');
    }
  } else {
    if (user.usertype === 'Admin') {
      res.redirect('/admin');
    } else if (user.usertype === 'Manager') {
      res.redirect('/manager');
    } else {
      res.redirect('/user');
    }
  }
}

/* GET home page. */
router.get('/login', async function(req, res, next) {
  var users = await prisma.User.findMany()
  if (req.session.userId) {
    res.redirect('/user');
  } else {
    res.render('index', { title: 'Express', users: users });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // check if user already has an active session
  if (req.session.userId) {
    const user = await prisma.User.findUnique({
      where: { id: req.session.userId },
    });

    if (user.usertype === 'Admin') {
      res.redirect('/admin');
    } else if (user.usertype === 'Manager') {
      res.redirect('/manager');
    } else {
      res.redirect('/user');
    }
  } else {
    try {
      const user = await prisma.User.findUnique({
        where: { email: email },
      });

      if (!user) {
        res.render('index', { errorMessage: 'Incorrect Email / Password.' });
      } else {
        const match = await bcrypt.compare(password, user.password);
        if (match) {
          const userId = user.id;
          req.session.userId = userId;
          console.log(req.session.userId);

          // check user role and redirect to appropriate page
          if (user.usertype === 'Admin') {
            res.redirect('/admin');
          } else if (user.usertype === 'Manager') {
            res.redirect('/manager');
          } else {
            res.redirect('/user');
          }
        } else {
          res.render('index', { errorMessage: 'Incorrect Password.' });
        }
      }
    } catch (err) {
      console.log(err);
      console.log(req.session.userId);
      res.render('index', { errorMessage: 'Something went wrong: ${err.message}' });
    }
  }
});

router.get('/logout', async (req, res) => {  
  try {
    req.session.destroy();
    res.redirect('/login');
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

// Protected routes
router.get('/admin', authenticate, async (req, res, next) => {
  await restrictAccess('Admin', req, res, next);
}, async (req, res) => {
  try {
    const users = await prisma.User.findMany();
    res.render('admin', { title: 'Admin Page', users: users });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.get('/manager', authenticate, async (req, res, next) => {
  await restrictAccess('Manager', req, res, next);
}, async (req, res) => {
  try {
    const users = await prisma.User.findMany();
    res.render('manager', { title: 'Manager Page', users: users });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.get('/user', authenticate, async (req, res, next) => {
  await restrictAccess('User', req, res, next);
}, async (req, res) => {
  try {
    const users = await prisma.User.findMany();
    res.render('user', { title: 'User Page', users: users });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

app.use('/', router);

module.exports = app;