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
}));

/* GET home page. */
router.get('/login', async function(req, res, next) {
  var users = await prisma.User.findMany()
  res.render('index', { title: 'Express', users: users });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

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
        res.redirect('/user');
      } else {
        res.render('index', { errorMessage: `Incorrect Password. ` });
      }
    }
  } catch (err) {
    console.log(err);
    res.render('index', { errorMessage: `Something went wrong.` });
  }
});

router.get('/logout', async (req, res) => {  
  try {
    req.session.destroy();
    res.redirect('/index');
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
