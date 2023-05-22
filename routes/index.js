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
  var users = await prisma.User.findMany();
  if (req.session.userId) {
    res.redirect('/studentDashboard');
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
      res.redirect('/adminDashboard');
    } else if (user.usertype === 'Manager') {
      res.redirect('/managerDashboard');
    } else {
      res.redirect('/studentDashboard');
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
            res.redirect('/adminDashboard');
          } else if (user.usertype === 'Manager') {
            res.redirect('/managerDashboard');
          } else {
            res.redirect('/studentDashboard');
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
router.use('/adminDashboard', authenticate, restrictAccess.bind(null, 'Admin'));
router.get('/adminDashboard', async (req, res) => {
  try {
    const users = await prisma.User.findMany();
    res.render('adminDashboard', { title: 'Admin Page', users: users });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.use('/adminUserTable', authenticate, restrictAccess.bind(null, 'Admin'));
router.get('/adminUserTable', async (req, res) => {
  try {
    const users = await prisma.User.findMany();
    res.render('adminUserTable', { title: 'Admin Page', users: users });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.use('/managerDashboard', authenticate, restrictAccess.bind(null, 'Manager'));
router.get('/managerDashboard', async (req, res) => {
  try {
    const users = await prisma.User.findMany();
    res.render('managerDashboard', { title: 'Manager Page', users: users });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.use('/managerUserTable', authenticate, restrictAccess.bind(null, 'Manager'));
router.get('/managerUserTable', async (req, res) => {
  try {
    const users = await prisma.User.findMany();
    res.render('managerUserTable', { title: 'Manager Page', users: users });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.use('/studentDashboard', authenticate, restrictAccess.bind(null, 'User'));
router.get('/studentDashboard', async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await prisma.User.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('studentDashboard', { title: 'User Page', user: user });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

router.get('/logs', authenticate, restrictAccess.bind(null, 'Admin'), (req, res) => {
  prisma.log.findMany()
    .then((logs) => {
      res.render('logs', { logs });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

router.post('/logAction', async (req, res) => {
  const { action, email } = req.body;

  try {
    await prisma.log.create({
      data: {
        action,
        email,
        timestamp: new Date(),
      },
    });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
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

    // Log the delete action before performing the deletion
    await prisma.Log.create({
      data: {
        action: 'Delete',
        email: deleteEmail,
        timestamp: new Date(),
      },
    });

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
    console.error(err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});
app.use('/', router);
module.exports = app;