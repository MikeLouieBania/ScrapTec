const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/* GET users listing. */
router.get('/user', async function(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const users = await prisma.user.findMany();

  res.render('user', { title: 'Users', users });
});

module.exports = router;
s