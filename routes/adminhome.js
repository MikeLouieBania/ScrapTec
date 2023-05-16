const express = require('express');
const router = express.Router();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/* GET home page. */
router.get('/admin', async function(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const users = await prisma.user.findMany();

  res.render('admin', { title: 'Admin', users });
});

module.exports = router;
