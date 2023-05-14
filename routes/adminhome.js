const express = require('express');
const router = express.Router();

const {PrismaClient} = require("@prisma/client")
const prisma = new PrismaClient

/* GET home page. */
router.get('/admin', async function(req, res, next) {
  var users = await prisma.User.findMany()
        if (!req.session.userId) {
            return res.redirect('/login');
        } else {
            return res.redirect('/admin');
        }
  res.render('admin', { title: 'Admin', users: users });
});


module.exports = router;
