const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/* GET users listing. */
router.get('/user', async function(req, res, next) {
  const users = await prisma.user.findMany();
  res.render('user', { title: 'Users', users: users });
});

module.exports = router;
