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

/* GET home page. */
router.get('/login', async function(req, res, next) {
  var users = await prisma.User.findMany()
  res.render('index', { title: 'Express', users: users });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // check if user already has an active session
  if (req.session.userId) {
    return res.redirect('/user');
  }

  try {
    const user = await prisma.User.findUnique({
      where: { email: email },
    });

    if (!user) {
      res.render('index', { errorMessage: `Incorrect Email / Password.` });
    } else {
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const userId = user.id;
        req.session.userId = userId;
        console.log(req.session.userId);
        res.redirect('/user');
      } else {
        res.render('index', { errorMessage: `Incorrect Password. ` });
      }
    }
  } catch (err) {
    console.log(err);
    console.log(req.session.userId);
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

module.exports = router;
