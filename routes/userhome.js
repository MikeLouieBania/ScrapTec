var express = require('express');
const session = require('express-session');
var router = express.Router();

const {PrismaClient} = require("@prisma/client")
var prisma = new PrismaClient

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 86400000 // 24 hours
  }
}));


/* GET users listing. */
router.get('/user', async function(req, res, next) {
  var users = await prisma.User.findMany()
  res.render('user', { title: 'Users', users: users });
});

module.exports = router;
