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
          res.redirect('/admin');
        } else if (user.usertype === 'Manager') {
          res.redirect('/manager');
        } else {
          res.redirect('/studentinfo');
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
      res.redirect('/studentinfo');
    }
  }
}

/* GET home page. */
router.get('/login', async function(req, res, next) {
  var users = await prisma.User.findMany();
  if (req.session.userId) {
    res.redirect('/studentinfo');
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
      res.redirect('/studentinfo');
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
            res.redirect('/studentinfo');
          }
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
  
  router.get('/studentinfo', authenticate, async (req, res, next) => {
    await restrictAccess('User', req, res, next);
  }, async (req, res) => {
    try {
      const users = await prisma.User.findMany();
      res.render('studentinfo', { title: 'User Page', users: users });
    } catch (err) {
      console.log(err);
      res.status(500).send('Internal server error');
    }
  });

  router.get('/studentDashboard', authenticate, async (req, res, next) => {
    await restrictAccess('User', req, res, next);
  }, async (req, res) => {
    try {
      const users = await prisma.User.findMany();
      res.render('studentDashboard', { title: 'User Page', users: users });
    } catch (err) {
      console.log(err);
      res.status(500).send('Internal server error');
    }
  });

  router.post('/setDeleteEmail', (req, res) => {
    const { email } = req.body;
    req.session.deleteEmail = email;
    return res.sendStatus(200);
  });
  
  router.post('/deleteUser', async (req, res) => {
    const { password } = req.body;
    const deleteEmail = req.session.deleteEmail;
  
    try {
      const loggedInUserId = req.session.userId;
      const loggedInUser = await prisma.user.findUnique({
        where: { id: loggedInUserId },
      });
  
      if (!loggedInUser) {
        return res.json({ success: false, message: 'User not found.' });
      }
  
      // Compare the password of the logged-in admin user with the provided password
      const match = await bcrypt.compare(password, loggedInUser.password);
      if (!match) {
        return res.json({ success: false, message: 'Incorrect password.' });
      }
  
      const userToDelete = await prisma.user.findUnique({
        where: { email: deleteEmail.toLowerCase() },
        include: { student: true }, // Include the associated student info
      });
  
      if (!userToDelete) {
        return res.json({ success: false, message: 'User not found.' });
      }
  
      // Delete the associated student info
      if (userToDelete.student) {
        await prisma.student_Info.delete({
          where: { id: userToDelete.student.id },
        });
      }
  
      // Delete the user from the database
      await prisma.user.delete({
        where: { email: deleteEmail.toLowerCase() },
      });
  
      return res.json({ success: true });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });
  
  app.use('/', router);
  
  module.exports = app;