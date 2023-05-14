const express = require('express');
const router = express.Router();
const validator = require('email-validator');
const crypto = require('crypto');

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient();

/* GET home page. */
router.get('/register', async (req, res, next) => {
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
    return res.render('register', { message: 'Password must be: 8 characters minimum, at least one number, one lowercase letter, one uppercase letter, and one special character' });
  }

  const salt = crypto.randomBytes(16).toString('hex'); // generate a random salt
  const hash = crypto.createHash('sha256'); // create a new hash object
  hash.update(password + salt); // update the hash with the password and salt
  const hashedPassword = hash.digest('hex'); // get the digest (hashed value) as a hex string

  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    return res.render('register', { errorMessage: `Email already exists`});
  } else {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        salt,
        usertype
      }
    });
    return res.redirect('/login');
  }
});

module.exports = router;
