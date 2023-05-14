const express = require('express');
const router = express.Router();

const {PrismaClient, Prisma} = require("@prisma/client")
const prisma = new PrismaClient

/* GET home page. */
router.get('/manager', async function(req, res, next) {
  var users = await prisma.User.findMany()
        if (!req.session.userId) {
            return res.redirect('/login');
        } else {
            return res.redirect('/manager');
        }
  res.render('manager', { title: 'Manager', users: users });
});


module.exports = router;
