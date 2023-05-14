const express = require('express');
const router = express.Router();
const session = require('express-session');
const app = express();
app.use(express.json());

const {PrismaClient, Prisma} = require("@prisma/client")
var prisma = new PrismaClient

/* GET home page. */
router.get('/manager', async function(req, res, next) {
  var users = await prisma.User.findMany()

  res.render('manager', { title: 'Express', users: users });
});


module.exports = router;
