const express = require('express');
const router = express.Router();
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const app = express();
app.use(express.json());
const bcrypt = require('bcrypt');
const prisma = require('./prisma');
const redisClient = require('redis').createClient();

const sessionStore = new RedisStore({
  client: redisClient,
});

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000 // 24 hours
  },
  store: sessionStore, // Use RedisStore for session storage
}));

// Middleware to check if user is authenticated
async function authenticate(req, res, next) {
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
      const user = await prisma.user.findUnique({
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
    // It seems you forgot to define `user` in this block, so I'm removing it for now
    res.redirect('/login');
  }
}

/* GET home page. */
router.get('/login', async function(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/user');
  }

  try {
    const users = await prisma.user.findMany();
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      res.render('index', { errorMessage: 'Incorrect Email / Password.' });
    } else {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const userId = user.id;
        req.session.userId = userId;

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
    res.render('index', { errorMessage: `Something went wrong: ${err.message}` });
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