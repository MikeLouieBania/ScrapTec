const express = require('express');
const router = express.Router();
const session = require('express-session');
const app = express();
app.use(express.json());
const bcrypt = require('bcrypt');

const { PrismaClient } = require("@prisma/client");
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
          res.redirect('/adminDashboard');
        } else if (user.usertype === 'Manager') {
          res.redirect('/managerDashboard');
        } else {
          res.redirect('/studentDashboard');
        }
      } else {
        next();
      }
    } catch (err) {
      console.log(err);
      res.status(500).send('Internal server error');
    }
  } else {
    res.redirect('/login');
  }
}

/* GET home page. */
router.get('/login', async function(req, res, next) {
  if (req.session.userId) {
    res.redirect('/studentinfo');
  } else {
    try {
      const users = await prisma.User.findMany();
      res.render('index', { title: 'Express', users: users });
    } catch (err) {
      console.log(err);
      res.status(500).send('Internal server error');
    }
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // check if user already has an active session
  if (req.session.userId) {
    res.redirect('/dashboard');
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

          res.redirect('/dashboard');
        } else {
          res.render('index', { errorMessage: 'Incorrect Password.' });
        }
      }
    } catch (err) {
      console.log(err);
      console.log(req.session.userId);
      res.render('index', { errorMessage: `Something went wrong: ${err.message}` });
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
router.get('/dashboard', authenticate, async (req, res, next) => {
  await restrictAccess('User', req, res, next);
}, async (req, res) => {
  try {
    const user = await prisma.User.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      res.status(404).send('User not found');
    } else {
      // Check if the user is an admin
      if (user.usertype === 'Admin') {
        res.render('adminDashboard', { title: 'Admin Page', user: user });
      } else if (user.usertype === 'Manager') {
        res.render('managerDashboard', { title: 'Manager Page', user: user });
      } else {
        res.render('studentDashboard', { title: 'User Page', user: user });
      }
    }
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.get('/viewData', authenticate, async (req, res, next) => {
  await restrictAccess('User', req, res, next);
}, async (req, res) => {
  try {
    const user = await prisma.User.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      res.status(404).send('User not found');
    } else {
      // Retrieve and render the data specific to the user
      const userData = await prisma.User.findUnique({
        where: { id: req.session.userId },
        include: { data: true },
      });

      if (!userData) {
        res.status(404).send('User data not found');
      } else {
        res.render('viewData', { title: 'View Data', userData: userData });
      }
    }
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

app.use('/', router);

module.exports = app;
