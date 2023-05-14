const express = require('express');
const router = express.Router();
const session = require('express-session');
const app = express();
app.use(express.json());
const bcrypt = require('bcrypt');

const {PrismaClient, Prisma} = require("@prisma/client")
const prisma = new PrismaClient();

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
        session.userId = userId;
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
    const userId = null;
    delete session.userId;
    res.redirect('/index');
  } catch (err) {
    console.log(userId);
    res.status(500).send('Internal server error');
  }
});

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
}));

module.exports = router;
