var express = require('express');
var router = express.Router();

const {PrismaClient, Prisma} = require("@prisma/client")
var prisma = new PrismaClient

/* GET users listing. */
router.get('/users', async function(req, res, next) {
  var users = await prisma.User.findMany()
  
  res.render('user', { title: 'Users', users: users });
});

module.exports = router;
