const express = require('express');
const router = express.Router();
const validator = require('email-validator');
const bcrypt = require('bcrypt');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/register', async (req, res) => {
  const users = await prisma.user.findMany();
  res.render('register', { title: 'Express', users });
});

router.post('/register', async (req, res) => {
  const { email, password, usertype } = req.body;

  if (!validator.validate(email)) {
    return res.render('register', { errorMessage: 'Invalid email address' });
  }

  const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.render('register', {
      errorMessage:
        'Password must be: 8 characters minimum, at least one number, one lowercase letter, one uppercase letter, and one special character'
    });
  }

  const saltRounds = 12;
  const salt = await bcrypt.genSalt(saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    return res.render('register', { errorMessage: 'Email already exists, please choose a different one' });
  } else {
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        usertype
      }
    });

    res.redirect('/login');
  }
});

module.exports = router;
