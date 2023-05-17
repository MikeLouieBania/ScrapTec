const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/userinfo', async (req, res) => {
  const users = await prisma.user.findMany();
  res.render('userinfo', { title: 'User Info', users });
});

module.exports = router;